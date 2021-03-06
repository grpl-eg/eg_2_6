package OpenILS::Utils::Cronscript;

# ---------------------------------------------------------------
# Copyright (C) 2010 Equinox Software, Inc
# Author: Joe Atzberger <jatzberger@esilibrary.com>
# Portions Copyright (C) 2011 Merrimack Valley Library Consortium
# Author: Jason Stephenson <jstephenson@mvlc.org>
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# ---------------------------------------------------------------

# The purpose of this module is to consolidate the common aspects
# of various cron tasks that all need the same things:
#    ~ non-duplicative processing, i.e. lockfiles and lockfile checking
#    ~ opensrf_core.xml file location 
#    ~ common options like help and debug

use strict;
use warnings;

use Getopt::Long qw(:DEFAULT GetOptionsFromArray);
use OpenSRF::System;
use OpenSRF::AppSession;
use OpenSRF::Utils::JSON;
use OpenSRF::EX qw(:try);
use OpenILS::Utils::Fieldmapper;
use OpenILS::Utils::Lockfile;
use OpenILS::Utils::CStoreEditor q/:funcs/;
use OpenILS::Application::AppUtils;

use File::Basename qw/fileparse/;

use Data::Dumper;
use Carp;

# Added for authentication
use Digest::MD5 qw/md5_hex/;

our @extra_opts = (     # additional keys are stored here
    # 'addlopt'
);

our $debug = 0;

my $apputils = 'OpenILS::Application::AppUtils';

sub _default_self {
    return {
    #   opts       => {},
    #   opts_clean => {},
    #   default_opts_clean => {},
        default_opts       => {
            'lock-file=s'   => OpenILS::Utils::Lockfile::default_filename,
            'osrf-config=s' => '/openils/conf/opensrf_core.xml',
            'debug'         => 0,
            'verbose+'      => 0,
            'help'          => 0,
          # 'internal_var'  => 'XYZ',
        },
    #   lockfile => undef,
    #   session => undef,
    #   bootstrapped => 0,
    #   got_options => 0,
        auto_get_options_4_bootstrap => 1,
    };
}

sub is_clean {
    my $key = shift   or  return 1;
    $key =~ /[=:].*$/ and return 0;
    $key =~ /[+!]$/   and return 0;
    return 1;
}

sub clean {
    my $key = shift or return;
    $key =~ s/[=:].*$//;
    $key =~ s/[+!]$//;
    return $key;
}

sub fuzzykey {                      # when you know the hash you want from, but not the exact key
    my $self = shift or return;
    my $key  = shift or return;
    my $target = @_ ? shift : 'opts_clean';
    foreach (map {clean($_)} keys %{$self->{default_opts}}) {  # TODO: cache
        $key eq $_ and return $self->{$target}->{$_};
    }
}

# MyGetOptions
# A wrapper around GetOptions
# {opts} does two things for GetOptions (see Getopt::Long)
#  (1) maps command-line options to the *other* variables where values are stored (in opts_clean)
#  (2) provides hashspace for the rest of the arbitrary options from the command-line
#
# TODO: allow more options to be passed here, maybe mimic Getopt::Long::GetOptions style
#
# If an arrayref argument is passed, then @ARGV will NOT be touched.
# Instead, the array will be passed to GetOptionsFromArray.
#

sub MyGetOptions {
    my $self = shift;
    my $arrayref = @_ ? shift : undef;
    if ($arrayref and ref($arrayref) ne 'ARRAY') {
        carp "MyGetOptions argument is not an array ref.  Expect GetOptionsFromArray to explode";
    }
    $self->{got_options} and carp "MyGetOptions called after options were already retrieved previously";
    my @keys = sort {is_clean($b) <=> is_clean($a)} keys %{$self->{default_opts}};
    $debug and print "KEYS: ", join(", ", @keys), "\n";
    foreach (@keys) {
        my $clean = clean($_);
        my $place = $self->{default_opts_clean}->{$clean};
        $self->{opts_clean}->{$clean} = $place;  # prepopulate default
        # $self->{opts}->{$_} = $self->{opts_clean}->{$clean};                 # pointer for GetOptions
        $self->{opts}->{$_} = sub {
            my $opt = shift;
            my $val = shift;
            ref ( $self->{opts_clean}->{$opt} ) and ref($self->{opts_clean}->{$opt}) eq 'SCALAR'
            and ${$self->{opts_clean}->{$opt}} = $val;  # set the referent's value
            $self->{opts_clean}->{$opt} = $val;     # burn the map, stick the value there
        };                 # pointer for GetOptions
    }
    $arrayref  ? GetOptionsFromArray($arrayref, $self->{opts}, @keys)
               : GetOptions(                    $self->{opts}, @keys) ;
   
    foreach (@keys) {
        delete $self->{opts}->{$_};     # now remove the mappings from (1) so we just have (2)
    }
    $self->clean_mirror('opts');        # populate clean_opts w/ cleaned versions of (2), plus everything else

    print $self->help() and exit if $self->{opts_clean}->{help};
    $self->new_lockfile();
    $self->{got_options}++;
    return wantarray ? %{$self->{opts_clean}} : $self->{opts_clean};
}

sub new_lockfile {
    my $self = shift;
    $debug and $OpenILS::Utils::Lockfile::debug = $debug;
    unless ($self->{opts_clean}->{nolockfile} || $self->{default_opts_clean}->{nolockfile}) {
        $self->{lockfile_obj} = OpenILS::Utils::Lockfile->new($self->first_defined('lock-file'));
        $self->{lockfile}     = $self->{lockfile_obj}->filename;
    }
}

sub first_defined {
    my $self = shift;
    my $key  = shift or return;
    foreach (qw(opts_clean opts default_opts_clean default_opts)) {
        defined $self->{$_}->{$key} and return $self->{$_}->{$key};
    }
    return;
}

sub clean_mirror {
    my $self  = shift;
    my $dirty = @_ ? shift : 'default_opts';
    foreach (keys %{$self->{$dirty}}) {
        defined $self->{$dirty}->{$_} or next;
        $self->{$dirty . '_clean'}->{clean($_)} = $self->{$dirty}->{$_};
    }
}

sub new {
    my $class = shift;
    my $self  = _default_self;
    bless ($self, $class);
    $self->init(@_);
    $debug and print "new ",  __PACKAGE__, " obj: ", Dumper($self);
    return $self;
}

sub add_and_purge {
    my $self = shift;
    my $key  = shift;
    my $val  = shift;
    my $clean = clean($key);
    my @others = grep {/$clean/ and $_ ne $key} keys %{$self->{default_opts}};
    unless (@others) {
        $debug and print "unique key $key => $val\n";
        $self->{default_opts}->{$key} = $val;   # no purge, just add
        return;
    }
    foreach (@others) {
        $debug and print "variant of $key => $_\n";
        if ($key ne $clean) {    # if it is a dirtier key, delete the clean one
            delete $self->{default_opts}->{$_};
            $self->{default_opts}->{$key} = $val;
        } else {                 # else update the dirty one
            $self->{default_opts}->{$_} = $val;
        }
    }
}

sub init {      # not INIT
    my $self = shift;
    my $opts  = @_ ? shift : {};    # user can specify more default options to constructor
# TODO: check $opts is hashref; then check verbose/debug first.  maybe check negations e.g. "no-verbose" ?
    @extra_opts = keys %$opts;
    foreach (@extra_opts) {        # add any other keys w/ default values
        $debug and print "init() adding option $_, default value: $opts->{$_}\n";
        $self->add_and_purge($_, $opts->{$_});
    }
    $self->clean_mirror;
    return $self;
}

sub usage {
    # my $self = shift;
    return "\nUSAGE: $0 [OPTIONS]";
}

sub options_help {
    my $self = shift;
    my $chunk = @_ ? shift : '';
    return <<HELP

COMMON OPTIONS:
    --osrf-config </path/to/config_file>  Default: $self->{default_opts_clean}->{'osrf-config'}
                 Specify OpenSRF core config file.

    --lock-file </path/to/file_name>      Default: $self->{default_opts_clean}->{'lock-file'}
                 Specify lock file.     

HELP
    . $chunk . <<HELP;
    --debug      Print server responses to STDOUT for debugging
    --verbose    Set verbosity
    --help       Show this help message
HELP
}

sub help {
    my $self = shift;
    return $self->usage() . "\n" . $self->options_help(@_) . $self->example();
}

sub example {
    return "\n\nEXAMPLES:\n\n    $0 --osrf-config /my/other/opensrf_core.xml\n";
}

# the proper order is: MyGetOptions, bootstrap, session.
# But the latter subs will check to see if they need to call the preceeding one(s).  

sub session {
    my $self = shift or return;
    $self->{bootstrapped} or $self->bootstrap();
    @_ or croak "session() called without required argument (app_name, e.g. 'open-ils.acq')";
    return OpenSRF::AppSession->create(@_);
}

sub bootstrap {
    my $self = shift or return;
    if ($self->{auto_get_options_4_bootstrap} and not $self->{got_options}) {
        $debug and print "Automatically calling MyGetOptions before bootstrap\n";
        $self->MyGetOptions();
    }
    try {
        $debug and print "bootstrap lock-file  : ", $self->first_defined('lock-file'), "\n";
        $debug and print "bootstrap osrf-config: ", $self->first_defined('osrf-config'), "\n";
        OpenSRF::System->bootstrap_client(config_file => $self->first_defined('osrf-config'));
        Fieldmapper->import(IDL => OpenSRF::Utils::SettingsClient->new->config_value("IDL"));
        $self->{bootstrapped} = 1;
    } otherwise {
        $self->{bootstrapped} = 0;
        warn shift;
    };
}

sub editor_init {
    my $self = shift or return;
    OpenILS::Utils::CStoreEditor::init();   # no return value to check
    $self->{editor_inited} = 1;
}

sub editor {
    my $self = shift or return;
    $self->{bootstrapped}  or $self->bootstrap();
    $self->{editor_inited} or $self->editor_init();
    return new_editor(@_);
}

# Die on an event. Takes an optional third parameter for the textcode
# of an event to die on. If the event textcode does not match the
# third parameter, will warn on the event instead of dying.
sub die_event {
    my $self = shift;
    my $e = shift;
    my $name = shift;
    if ($apputils->event_code($e)) {
        if (!defined($name) || $apputils->event_equals($e,$name)) {
            croak(Dumper $e);
        } else {
            carp(Dumper $e);
        }
    }
}

# Prints warning on an even. Takes an optional third parameter for the
# textcode of an event to warn on.
sub warn_event {
    my $self = shift;
    my $e = shift;
    my $name = shift;
    if ($apputils->event_code($e)
            && (!defined($name) || $apputils->event_equals($e, $name))) {
        carp(Dumper $e);
    }
}

# Authenticate with the open-ils.auth module.
# Takes a hash ref of arguments:
# {
#   username => username to authenticate as,
#   password => the user's password,
#   workstation => the workstation to use (optional),
#   type => the type of login (optional, but defaults to staff)
# }
#
# returns the authtoken or undef on failure.
# Also stores the authtoken and authtime as fields on the object.
sub authenticate {
    my $self = shift or return;
    my $args = shift or return;
    if ($args && ref($args) eq 'HASH') {
        # Default to staff in case the back end ever stops doing so.
        $args->{type} = 'staff' unless (defined($args->{type}));

        my $session = $self->session('open-ils.auth');
        my $seed = $session->request(
            'open-ils.auth.authenticate.init', $args->{'username'}
        )->gather(1);

        $args->{password} = md5_hex($seed . md5_hex($args->{password}));
        my $req = $session->request(
            'open-ils.auth.authenticate.complete', $args
        );

        my $response = $req->gather(1);
        if ($response && ref($response) eq 'HASH' && $response->{payload}) {
            $self->{authtoken} = $response->{payload}->{authtoken};
            $self->{authtime} = $response->{payload}->{authtime};
        } else {
            $self->{authtoken} = undef;
            $self->{authtime} = undef;
            carp("Authentication failed");
        }
        $session->disconnect();
        return $self->authtoken;
    } else {
        return undef;
    }
}

# Deletes the session for our authtoken if we have logged in with the
# authenticate method.
sub logout {
    my $self = shift or return;
    my $token = shift || $self->{authtoken};
    if ($token) {
        my $session = $self->session('open-ils.auth');
        if ($session->request('open-ils.auth.session.delete', $token)->gather(1)) {
            if ($token eq $self->{authtoken}) {
                $self->{authtoken} = undef;
                $self->{authtime} = undef;
            }
        } else {
            carp("Not authenticated");
        }
        $session->disconnect();
    } else {
        carp("No authtoken");
    }
}

sub authtoken {
    my $self = shift;
    return $self->{authtoken};
}

sub authtime {
    my $self = shift;
    return $self->{authtime};
}

sub cache {
    my $self = shift;
    my $cache = "OpenSRF::Utils::Cache";
    $cache->use;
    $self->{memcache} = $cache->new('global') unless $self->{memcache};
    return $self->{memcache};
}

1;
__END__

=pod

=head1 NAME

OpenILS::Utils::Cronscript - Consolidated options handling and utility
methods for any script (not just cron, really)

=head1 SYNOPSIS

    use OpenILS::Utils::Cronscript;

    my %defaults = (
        'min=i'      => 0,          # keys are Getopt::Long style options
        'max=i'      => 999,        # values are default values
        'user=s'     => 'admin',
        'password=s' => '',
        'nolockfile' => 1,
    );

    my $core = OpenILS::Utils::Cronscript->new(\%defaults);
    my $opts = $core->MyGetOptions();   # options now in, e.g.: $opts->{max}
    $core->bootstrap;

You can skip alot of the above if you're happy with the defaults:

    my $script = OpenILS::Utils::Cronscript->new();

If you just don't want a lock file:

    my $core = OpenILS::Utils::Cronscript->new({nolockfile=>1});

Or if you don't need any additional options and just want to get a
session going:

    use OpenILS::Utils::Cronscript;
    my $session = OpenILS::Utils::Cronscript->new()->session('open-ils.acq');

Cronscript gives you access to many useful methods:

You can login if necessary:

    my $account = {
        username => 'admin',
        password => 'password',
        workstation => 'workstation_name', # optional
        type => 'staff' # optional, but staff is the default
    };
    my $authtoken = $core->authenticate($account);

You can logout a session given its authtoken:

    $core->logout($authtoken);

Or, if you've authenticated with the authenticate method, you can
logout the most recently authenticated session:

    $core->logout();

If you have logged in with the authenticate method, you can retrieve
your current authtoken or authtime values:

    my $token = $core->authtoken;
    my $authtime = $core->authtime;

You can create a CStoreEdtor object:

    my $editor = $core->editor(); # With defaults.
    my $editor = $core->editor(authtoken=>$authtoken); # with a given
                                                       # session
    my $editor = $core->editor(xact=>1); # With transactions or any
                                         # other CStoreEditor options.

You can create OpenSRF AppSesions to run commands:

    my $pcrud = $core->session('open-ils.pcrud');
    #...Do some pcrud stuff here.

You can print warnings or die on events:

    my $evt ...;
    $core->warn_event($evt);
    $core->die_event($evt);

Or only on certain events:

     $core->warn_event($evt, 'PERM_FAILURE');
     $core->die_event($evt, 'PERM_FAILURE');

Includes a shared debug flag so you can turn debug mode on and off:

    $OpenILS::Utils::Cronscript::debug = 1; # Debugging on
    $OpenILS::Utils::Cronscript::debug = 0; # Debugging off

Includes OpenILS::Application::Apputils so using AppUtils methods is
as simple as:

    my $apputils = 'OpenILS::Application::AppUtils';
    $apputils->event_code($evt);

Uses and imports the OpenILS::Utils::Fieldmapper so you don't have to.

=head1 DESCRIPTION

There are a few main problems when writing a new script for Evergreen.

=head2 Initialization

The runtime environment for the application requires a lot of
initialization, but during normal operation it has already occured
(when Evergreen was started).  So most of the EG code never has to
deal with this problem, but standalone scripts do.  The timing and
sequence of requisite events is important and not obvious.

=head2 Common Options, Consistent Options

We need several common options for each script that accesses the
database or uses EG data objects and methods.  Logically, these
options often deal with initialization.  They should take the B<exact>
same form(s) for each script and should not be dependent on the local
author to copy and paste them from some reference source.  We really
don't want to encourage (let alone force) admins to use C<--config>,
C<--osrf-confg>, C<-c>, and C<@ARGV[2]> for the same purpose in
different scripts, with different default handling, help descriptions
and error messages (or lack thereof).

This suggests broader problem of UI consistency and uniformity, also
partially addressed by this module.

=head2 Lockfiles

A lockfile is necessary for a script that wants to prevent possible
simultaneous execution.  For example, consider a script that is
scheduled to run frequently, but that experiences occasional high
load: you wouldn't want crontab to start running it again if the first
instance had not yet finished.

But the code for creating, writing to, checking for, reading and
cleaning up a lockfile for the script bloats what might otherwise be a
terse method call.  Conscript handles lockfile generation and removal
automatically.

=head1 OPTIONS

The common options (and default values) are:

    'lock-file=s'   => OpenILS::Utils::Lockfile::default_filename,
    'osrf-config=s' => '/openils/conf/opensrf_core.xml',
    'debug'         => 0,
    'verbose+'      => 0,
    'help'          => 0,

=head1 SEE ALSO

    Getopt::Long
    OpenILS::Application::AppUtils
    OpenILS::Utils::Fieldmapper
    OpenILS::Utils::Lockfile

=head1 AUTHORS

    Joe Atzberger <jatzberger@esilibrary.com>
    Jason Stephenson <jstephenson@mvlc.org>

=cut

