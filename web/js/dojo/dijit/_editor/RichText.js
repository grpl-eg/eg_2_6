/*
	Copyright (c) 2004-2009, The Dojo Foundation All Rights Reserved.
	Available via Academic Free License >= 2.1 OR the modified BSD license.
	see: http://dojotoolkit.org/license for details
*/


if(!dojo._hasResource["dijit._editor.RichText"]){
dojo._hasResource["dijit._editor.RichText"]=true;
dojo.provide("dijit._editor.RichText");
dojo.require("dijit._Widget");
dojo.require("dijit._editor.selection");
dojo.require("dijit._editor.range");
dojo.require("dijit._editor.html");
dojo.require("dojo.i18n");
dojo.requireLocalization("dijit.form","Textarea",null,"ROOT,ar,ca,cs,da,de,el,es,fi,fr,he,hu,it,ja,ko,nb,nl,pl,pt,pt-pt,ru,sk,sl,sv,th,tr,zh,zh-tw");
if(!dojo.config["useXDomain"]||dojo.config["allowXdRichTextSave"]){
if(dojo._postLoad){
(function(){
var _1=dojo.doc.createElement("textarea");
_1.id=dijit._scopeName+"._editor.RichText.savedContent";
dojo.style(_1,{display:"none",position:"absolute",top:"-100px",height:"3px",width:"3px"});
dojo.body().appendChild(_1);
})();
}else{
try{
dojo.doc.write("<textarea id=\""+dijit._scopeName+"._editor.RichText.savedContent\" "+"style=\"display:none;position:absolute;top:-100px;left:-100px;height:3px;width:3px;overflow:hidden;\"></textarea>");
}
catch(e){
}
}
}
dojo.declare("dijit._editor.RichText",dijit._Widget,{constructor:function(_2){
this.contentPreFilters=[];
this.contentPostFilters=[];
this.contentDomPreFilters=[];
this.contentDomPostFilters=[];
this.editingAreaStyleSheets=[];
this._keyHandlers={};
this.contentPreFilters.push(dojo.hitch(this,"_preFixUrlAttributes"));
if(dojo.isMoz){
this.contentPreFilters.push(this._fixContentForMoz);
this.contentPostFilters.push(this._removeMozBogus);
}
if(dojo.isSafari){
this.contentPostFilters.push(this._removeSafariBogus);
}
this.onLoadDeferred=new dojo.Deferred();
},inheritWidth:false,focusOnLoad:false,name:"",styleSheets:"",_content:"",height:"300px",minHeight:"1em",isClosed:true,isLoaded:false,_SEPARATOR:"@@**%%__RICHTEXTBOUNDRY__%%**@@",onLoadDeferred:null,isTabIndent:false,disableSpellCheck:false,postCreate:function(){
if("textarea"==this.domNode.tagName.toLowerCase()){
console.warn("RichText should not be used with the TEXTAREA tag.  See dijit._editor.RichText docs.");
}
dojo.publish(dijit._scopeName+"._editor.RichText::init",[this]);
this.open();
this.setupDefaultShortcuts();
},setupDefaultShortcuts:function(){
var _3=dojo.hitch(this,function(_4,_5){
return function(){
return !this.execCommand(_4,_5);
};
});
var _6={b:_3("bold"),i:_3("italic"),u:_3("underline"),a:_3("selectall"),s:function(){
this.save(true);
},m:function(){
this.isTabIndent=!this.isTabIndent;
},"1":_3("formatblock","h1"),"2":_3("formatblock","h2"),"3":_3("formatblock","h3"),"4":_3("formatblock","h4"),"\\":_3("insertunorderedlist")};
if(!dojo.isIE){
_6.Z=_3("redo");
}
for(var _7 in _6){
this.addKeyHandler(_7,true,false,_6[_7]);
}
},events:["onKeyPress","onKeyDown","onKeyUp","onClick"],captureEvents:[],_editorCommandsLocalized:false,_localizeEditorCommands:function(){
if(this._editorCommandsLocalized){
return;
}
this._editorCommandsLocalized=true;
var _8=["div","p","pre","h1","h2","h3","h4","h5","h6","ol","ul","address"];
var _9="",_a,i=0;
while((_a=_8[i++])){
if(_a.charAt(1)!="l"){
_9+="<"+_a+"><span>content</span></"+_a+"><br/>";
}else{
_9+="<"+_a+"><li>content</li></"+_a+"><br/>";
}
}
var _c=dojo.doc.createElement("div");
dojo.style(_c,{position:"absolute",top:"-2000px"});
dojo.doc.body.appendChild(_c);
_c.innerHTML=_9;
var _d=_c.firstChild;
while(_d){
dijit._editor.selection.selectElement(_d.firstChild);
dojo.withGlobal(this.window,"selectElement",dijit._editor.selection,[_d.firstChild]);
var _e=_d.tagName.toLowerCase();
this._local2NativeFormatNames[_e]=document.queryCommandValue("formatblock");
this._native2LocalFormatNames[this._local2NativeFormatNames[_e]]=_e;
_d=_d.nextSibling.nextSibling;
}
dojo.body().removeChild(_c);
},open:function(_f){
if(!this.onLoadDeferred||this.onLoadDeferred.fired>=0){
this.onLoadDeferred=new dojo.Deferred();
}
if(!this.isClosed){
this.close();
}
dojo.publish(dijit._scopeName+"._editor.RichText::open",[this]);
this._content="";
if(arguments.length==1&&_f.nodeName){
this.domNode=_f;
}
var dn=this.domNode;
var _11;
if(dn.nodeName&&dn.nodeName.toLowerCase()=="textarea"){
var ta=(this.textarea=dn);
this.name=ta.name;
_11=this._preFilterContent(ta.value);
dn=this.domNode=dojo.doc.createElement("div");
dn.setAttribute("widgetId",this.id);
ta.removeAttribute("widgetId");
dn.cssText=ta.cssText;
dn.className+=" "+ta.className;
dojo.place(dn,ta,"before");
var _13=dojo.hitch(this,function(){
dojo.style(ta,{display:"block",position:"absolute",top:"-1000px"});
if(dojo.isIE){
var s=ta.style;
this.__overflow=s.overflow;
s.overflow="hidden";
}
});
if(dojo.isIE){
setTimeout(_13,10);
}else{
_13();
}
if(ta.form){
dojo.connect(ta.form,"onsubmit",this,function(){
ta.value=this.getValue();
});
}
}else{
_11=this._preFilterContent(dijit._editor.getChildrenHtml(dn));
dn.innerHTML="";
}
var _15=dojo.contentBox(dn);
this._oldHeight=_15.h;
this._oldWidth=_15.w;
this.savedContent=_11;
if(dn.nodeName&&dn.nodeName=="LI"){
dn.innerHTML=" <br>";
}
this.editingArea=dn.ownerDocument.createElement("div");
dn.appendChild(this.editingArea);
if(this.name!=""&&(!dojo.config["useXDomain"]||dojo.config["allowXdRichTextSave"])){
var _16=dojo.byId(dijit._scopeName+"._editor.RichText.savedContent");
if(_16.value!=""){
var _17=_16.value.split(this._SEPARATOR),i=0,dat;
while((dat=_17[i++])){
var _1a=dat.split(":");
if(_1a[0]==this.name){
_11=_1a[1];
_17.splice(i,1);
break;
}
}
}
this.connect(window,"onbeforeunload","_saveContent");
}
this.isClosed=false;
if(dojo.isIE||dojo.isWebKit||dojo.isOpera){
var ifr=(this.editorObject=this.iframe=dojo.doc.createElement("iframe"));
ifr.id=this.id+"_iframe";
this._iframeSrc=this._getIframeDocTxt();
ifr.style.border="none";
ifr.style.width="100%";
if(this._layoutMode){
ifr.style.height="100%";
}else{
if(dojo.isIE>=7){
if(this.height){
ifr.style.height=this.height;
}
if(this.minHeight){
ifr.style.minHeight=this.minHeight;
}
}else{
ifr.style.height=this.height?this.height:this.minHeight;
}
}
ifr.frameBorder=0;
ifr._loadFunc=dojo.hitch(this,function(win){
this.window=win;
this.document=this.window.document;
if(dojo.isIE){
this._localizeEditorCommands();
}
this.onLoad(_11);
this.savedContent=this.getValue(true);
});
var s="javascript:parent."+dijit._scopeName+".byId(\""+this.id+"\")._iframeSrc";
ifr.setAttribute("src",s);
this.editingArea.appendChild(ifr);
if(dojo.isWebKit){
setTimeout(function(){
ifr.setAttribute("src",s);
},0);
}
}else{
this._drawIframe(_11);
this.savedContent=this.getValue(true);
}
if(dn.nodeName=="LI"){
dn.lastChild.style.marginTop="-1.2em";
}
if(this.domNode.nodeName=="LI"){
this.domNode.lastChild.style.marginTop="-1.2em";
}
dojo.addClass(this.domNode,"RichTextEditable");
},_local2NativeFormatNames:{},_native2LocalFormatNames:{},_localizedIframeTitles:null,_getIframeDocTxt:function(){
var _cs=dojo.getComputedStyle(this.domNode);
var _1f="";
if(dojo.isIE||(!this.height&&!dojo.isMoz)){
_1f="<div>"+_1f+"</div>";
}
var _20=[_cs.fontWeight,_cs.fontSize,_cs.fontFamily].join(" ");
var _21=_cs.lineHeight;
if(_21.indexOf("px")>=0){
_21=parseFloat(_21)/parseFloat(_cs.fontSize);
}else{
if(_21.indexOf("em")>=0){
_21=parseFloat(_21);
}else{
_21="1.0";
}
}
var _22="";
this.style.replace(/(^|;)(line-|font-?)[^;]+/g,function(_23){
_22+=_23.replace(/^;/g,"")+";";
});
var d=dojo.doc;
return [this.isLeftToRight()?"<html><head>":"<html dir='rtl'><head>",(dojo.isMoz?"<title>"+this._localizedIframeTitles.iframeEditTitle+"</title>":""),"<meta http-equiv='Content-Type' content='text/html;'>","<style>","body,html {","\tbackground:transparent;","\tpadding: 1em 0 0 0;","\tmargin: -1em 0 0 0;","}","body{","\ttop:0px; left:0px; right:0px;","\tfont:",_20,";",((this.height||dojo.isOpera)?"":"position: fixed;"),"\tmin-height:",this.minHeight,";","\tline-height:",_21,"}","p{ margin: 1em 0 !important; }",(this.height?"":"body,html{overflow-y:hidden;/*for IE*/} body > div {overflow-x:auto;/*FF:horizontal scrollbar*/ overflow-y:hidden;/*safari*/ min-height:"+this.minHeight+";/*safari*/}"),"li > ul:-moz-first-node, li > ol:-moz-first-node{ padding-top: 1.2em; } ","li{ min-height:1.2em; }","</style>",this._applyEditingAreaStyleSheets(),"</head><body onload='frameElement._loadFunc(window,document)' style='"+_22+"'>",_1f,"</body></html>"].join("");
},_drawIframe:function(_25){
if(!this.iframe){
var ifr=(this.iframe=dojo.doc.createElement("iframe"));
ifr.id=this.id+"_iframe";
var _27=ifr.style;
_27.border="none";
_27.lineHeight="0";
_27.verticalAlign="bottom";
this.editorObject=this.iframe;
this._localizedIframeTitles=dojo.i18n.getLocalization("dijit.form","Textarea");
var _28=dojo.query("label[for=\""+this.id+"\"]");
if(_28.length){
this._localizedIframeTitles.iframeEditTitle=_28[0].innerHTML+" "+this._localizedIframeTitles.iframeEditTitle;
}
ifr._loadFunc=function(win){
};
}
this.iframe.style.width=this.inheritWidth?this._oldWidth:"100%";
if(this._layoutMode){
this.iframe.style.height="100%";
}else{
if(this.height){
this.iframe.style.height=this.height;
}else{
this.iframe.height=this._oldHeight;
}
}
var _2a;
if(this.textarea){
_2a=this.srcNodeRef;
}else{
_2a=dojo.doc.createElement("div");
_2a.style.display="none";
_2a.innerHTML=_25;
this.editingArea.appendChild(_2a);
}
this.editingArea.appendChild(this.iframe);
var _2b=dojo.hitch(this,function(){
if(!this.editNode){
if(!this.document){
try{
if(this.iframe.contentWindow){
this.window=this.iframe.contentWindow;
this.document=this.iframe.contentWindow.document;
}else{
if(this.iframe.contentDocument){
this.window=this.iframe.contentDocument.window;
this.document=this.iframe.contentDocument;
}
}
}
catch(e){
}
if(!this.document){
setTimeout(_2b,50);
return;
}
var _2c=this.document;
_2c.open();
if(dojo.isAIR){
_2c.body.innerHTML=_25;
}else{
_2c.write(this._getIframeDocTxt());
}
_2c.close();
dojo.destroy(_2a);
}
if(!this.document.body){
setTimeout(_2b,50);
return;
}
this.onLoad(_25);
}else{
dojo.destroy(_2a);
this.editNode.innerHTML=_25;
this.onDisplayChanged();
}
});
_2b();
},_applyEditingAreaStyleSheets:function(){
var _2d=[];
if(this.styleSheets){
_2d=this.styleSheets.split(";");
this.styleSheets="";
}
_2d=_2d.concat(this.editingAreaStyleSheets);
this.editingAreaStyleSheets=[];
var _2e="",i=0,url;
while((url=_2d[i++])){
var _31=(new dojo._Url(dojo.global.location,url)).toString();
this.editingAreaStyleSheets.push(_31);
_2e+="<link rel=\"stylesheet\" type=\"text/css\" href=\""+_31+"\"/>";
}
return _2e;
},addStyleSheet:function(uri){
var url=uri.toString();
if(url.charAt(0)=="."||(url.charAt(0)!="/"&&!uri.host)){
url=(new dojo._Url(dojo.global.location,url)).toString();
}
if(dojo.indexOf(this.editingAreaStyleSheets,url)>-1){
return;
}
this.editingAreaStyleSheets.push(url);
if(this.document.createStyleSheet){
this.document.createStyleSheet(url);
}else{
var _34=this.document.getElementsByTagName("head")[0];
var _35=this.document.createElement("link");
_35.rel="stylesheet";
_35.type="text/css";
_35.href=url;
_34.appendChild(_35);
}
},removeStyleSheet:function(uri){
var url=uri.toString();
if(url.charAt(0)=="."||(url.charAt(0)!="/"&&!uri.host)){
url=(new dojo._Url(dojo.global.location,url)).toString();
}
var _38=dojo.indexOf(this.editingAreaStyleSheets,url);
if(_38==-1){
return;
}
delete this.editingAreaStyleSheets[_38];
dojo.withGlobal(this.window,"query",dojo,["link:[href=\""+url+"\"]"]).orphan();
},disabled:false,_mozSettingProps:{"styleWithCSS":false},_setDisabledAttr:function(_39){
this.disabled=_39;
if(!this.isLoaded){
return;
}
_39=!!_39;
if(dojo.isIE||dojo.isWebKit||dojo.isOpera){
var _3a=dojo.isIE&&(this.isLoaded||!this.focusOnLoad);
if(_3a){
this.editNode.unselectable="on";
}
this.editNode.contentEditable=!_39;
if(_3a){
var _3b=this;
setTimeout(function(){
_3b.editNode.unselectable="off";
},0);
}
}else{
try{
this.document.designMode=(_39?"off":"on");
}
catch(e){
return;
}
if(!_39&&this._mozSettingProps){
var ps=this._mozSettingProps;
for(var n in ps){
if(ps.hasOwnProperty(n)){
try{
this.document.execCommand(n,false,ps[n]);
}
catch(e){
}
}
}
}
}
this._disabledOK=true;
},_isResized:function(){
return false;
},onLoad:function(_3e){
if(!this.window.__registeredWindow){
this.window.__registeredWindow=true;
dijit.registerIframe(this.iframe);
}
if(!dojo.isIE&&(this.height||dojo.isMoz)){
this.editNode=this.document.body;
}else{
this.editNode=this.document.body.firstChild;
var _3f=this;
if(dojo.isIE){
var _40=(this.tabStop=dojo.doc.createElement("<div tabIndex=-1>"));
this.editingArea.appendChild(_40);
this.iframe.onfocus=function(){
_3f.editNode.setActive();
};
}
}
this.focusNode=this.editNode;
this._preDomFilterContent(this.editNode);
var _41=this.events.concat(this.captureEvents);
var ap=this.iframe?this.document:this.editNode;
dojo.forEach(_41,function(_43){
this.connect(ap,_43.toLowerCase(),_43);
},this);
if(dojo.isIE){
this.connect(this.document,"onmousedown","_onIEMouseDown");
this.editNode.style.zoom=1;
}
if(dojo.isWebKit){
this._webkitListener=this.connect(this.document,"onmouseup","onDisplayChanged");
}
this.isLoaded=true;
this.attr("disabled",this.disabled);
this.setValue(_3e);
if(this.onLoadDeferred){
this.onLoadDeferred.callback(true);
}
if(this.focusOnLoad){
dojo.addOnLoad(dojo.hitch(this,function(){
setTimeout(dojo.hitch(this,"focus"),this.updateInterval);
}));
}
this.onDisplayChanged();
},onKeyDown:function(e){
if(e.keyCode===dojo.keys.TAB&&this.isTabIndent){
dojo.stopEvent(e);
if(this.queryCommandEnabled((e.shiftKey?"outdent":"indent"))){
this.execCommand((e.shiftKey?"outdent":"indent"));
}
}
if(dojo.isIE){
if(e.keyCode==dojo.keys.TAB&&!this.isTabIndent){
if(e.shiftKey&&!e.ctrlKey&&!e.altKey){
this.iframe.focus();
}else{
if(!e.shiftKey&&!e.ctrlKey&&!e.altKey){
this.tabStop.focus();
}
}
}else{
if(e.keyCode===dojo.keys.BACKSPACE&&this.document.selection.type==="Control"){
dojo.stopEvent(e);
this.execCommand("delete");
}else{
if((65<=e.keyCode&&e.keyCode<=90)||(e.keyCode>=37&&e.keyCode<=40)){
e.charCode=e.keyCode;
this.onKeyPress(e);
}
}
}
}else{
if(dojo.isMoz&&!this.isTabIndent){
if(e.keyCode==dojo.keys.TAB&&!e.shiftKey&&!e.ctrlKey&&!e.altKey&&this.iframe){
var _45=dojo.isFF<3?this.iframe.contentDocument:this.iframe;
_45.title=this._localizedIframeTitles.iframeFocusTitle;
this.iframe.focus();
dojo.stopEvent(e);
}else{
if(e.keyCode==dojo.keys.TAB&&e.shiftKey){
if(this.toolbar){
this.toolbar.focus();
}
dojo.stopEvent(e);
}
}
}
}
return true;
},onKeyUp:function(e){
return;
},setDisabled:function(_47){
dojo.deprecated("dijit.Editor::setDisabled is deprecated","use dijit.Editor::attr(\"disabled\",boolean) instead",2);
this.attr("disabled",_47);
},_setValueAttr:function(_48){
this.setValue(_48);
},_getDisableSpellCheckAttr:function(){
return !dojo.attr(this.document.body,"spellcheck");
},_setDisableSpellCheckAttr:function(_49){
if(this.document){
dojo.attr(this.document.body,"spellcheck",!_49);
}else{
this.onLoadDeferred.addCallback(dojo.hitch(this,function(){
dojo.attr(this.document.body,"spellcheck",!_49);
}));
}
},onKeyPress:function(e){
var c=(e.keyChar&&e.keyChar.toLowerCase())||e.keyCode;
var _4c=this._keyHandlers[c];
var _4d=arguments;
if(_4c&&!e.altKey){
dojo.forEach(_4c,function(h){
if((!!h.shift==!!e.shiftKey)&&(!!h.ctrl==!!e.ctrlKey)){
if(!h.handler.apply(this,_4d)){
e.preventDefault();
}
}
},this);
}
if(!this._onKeyHitch){
this._onKeyHitch=dojo.hitch(this,"onKeyPressed");
}
setTimeout(this._onKeyHitch,1);
return true;
},addKeyHandler:function(key,_50,_51,_52){
if(!dojo.isArray(this._keyHandlers[key])){
this._keyHandlers[key]=[];
}
this._keyHandlers[key].push({shift:_51||false,ctrl:_50||false,handler:_52});
},onKeyPressed:function(){
this.onDisplayChanged();
},onClick:function(e){
this.onDisplayChanged(e);
},_onIEMouseDown:function(e){
if(!this._focused&&!this.disabled){
this.focus();
}
},_onBlur:function(e){
this.inherited(arguments);
var _c=this.getValue(true);
if(_c!=this.savedContent){
this.onChange(_c);
this.savedContent=_c;
}
if(dojo.isMoz&&this.iframe){
var _57=dojo.isFF<3?this.iframe.contentDocument:this.iframe;
_57.title=this._localizedIframeTitles.iframeEditTitle;
}
},_onFocus:function(e){
if(!this.disabled){
if(!this._disabledOK){
this.attr("disabled",false);
}
this.inherited(arguments);
}
},blur:function(){
if(!dojo.isIE&&this.window.document.documentElement&&this.window.document.documentElement.focus){
this.window.document.documentElement.focus();
}else{
if(dojo.doc.body.focus){
dojo.doc.body.focus();
}
}
},focus:function(){
if(!dojo.isIE){
dijit.focus(this.iframe);
}else{
if(this.editNode&&this.editNode.focus){
this.iframe.fireEvent("onfocus",document.createEventObject());
}
}
},updateInterval:200,_updateTimer:null,onDisplayChanged:function(e){
if(this._updateTimer){
clearTimeout(this._updateTimer);
}
if(!this._updateHandler){
this._updateHandler=dojo.hitch(this,"onNormalizedDisplayChanged");
}
this._updateTimer=setTimeout(this._updateHandler,this.updateInterval);
},onNormalizedDisplayChanged:function(){
delete this._updateTimer;
},onChange:function(_5a){
},_normalizeCommand:function(cmd){
var _5c=cmd.toLowerCase();
if(_5c=="formatblock"){
if(dojo.isSafari){
_5c="heading";
}
}else{
if(_5c=="hilitecolor"&&!dojo.isMoz){
_5c="backcolor";
}
}
return _5c;
},_qcaCache:{},queryCommandAvailable:function(_5d){
var ca=this._qcaCache[_5d];
if(ca!=undefined){
return ca;
}
return (this._qcaCache[_5d]=this._queryCommandAvailable(_5d));
},_queryCommandAvailable:function(_5f){
var ie=1;
var _61=1<<1;
var _62=1<<2;
var _63=1<<3;
var _64=1<<4;
var _65=dojo.isWebKit;
function _66(_67){
return {ie:Boolean(_67&ie),mozilla:Boolean(_67&_61),webkit:Boolean(_67&_62),webkit420:Boolean(_67&_64),opera:Boolean(_67&_63)};
};
var _68=null;
switch(_5f.toLowerCase()){
case "bold":
case "italic":
case "underline":
case "subscript":
case "superscript":
case "fontname":
case "fontsize":
case "forecolor":
case "hilitecolor":
case "justifycenter":
case "justifyfull":
case "justifyleft":
case "justifyright":
case "delete":
case "selectall":
case "toggledir":
_68=_66(_61|ie|_62|_63);
break;
case "createlink":
case "unlink":
case "removeformat":
case "inserthorizontalrule":
case "insertimage":
case "insertorderedlist":
case "insertunorderedlist":
case "indent":
case "outdent":
case "formatblock":
case "inserthtml":
case "undo":
case "redo":
case "strikethrough":
case "tabindent":
_68=_66(_61|ie|_63|_64);
break;
case "blockdirltr":
case "blockdirrtl":
case "dirltr":
case "dirrtl":
case "inlinedirltr":
case "inlinedirrtl":
_68=_66(ie);
break;
case "cut":
case "copy":
case "paste":
_68=_66(ie|_61|_64);
break;
case "inserttable":
_68=_66(_61|ie);
break;
case "insertcell":
case "insertcol":
case "insertrow":
case "deletecells":
case "deletecols":
case "deleterows":
case "mergecells":
case "splitcell":
_68=_66(ie|_61);
break;
default:
return false;
}
return (dojo.isIE&&_68.ie)||(dojo.isMoz&&_68.mozilla)||(dojo.isWebKit&&_68.webkit)||(dojo.isWebKit>420&&_68.webkit420)||(dojo.isOpera&&_68.opera);
},execCommand:function(_69,_6a){
var _6b;
this.focus();
_69=this._normalizeCommand(_69);
if(_6a!=undefined){
if(_69=="heading"){
throw new Error("unimplemented");
}else{
if((_69=="formatblock")&&dojo.isIE){
_6a="<"+_6a+">";
}
}
}
if(_69=="inserthtml"){
_6a=this._preFilterContent(_6a);
_6b=true;
if(dojo.isIE){
var _6c=this.document.selection.createRange();
if(this.document.selection.type.toUpperCase()=="CONTROL"){
var n=_6c.item(0);
while(_6c.length){
_6c.remove(_6c.item(0));
}
n.outerHTML=_6a;
}else{
_6c.pasteHTML(_6a);
}
_6c.select();
}else{
if(dojo.isMoz&&!_6a.length){
this._sCall("remove");
}else{
_6b=this.document.execCommand(_69,false,_6a);
}
}
}else{
if((_69=="unlink")&&(this.queryCommandEnabled("unlink"))&&(dojo.isMoz||dojo.isWebKit)){
var a=this._sCall("getAncestorElement",["a"]);
this._sCall("selectElement",[a]);
_6b=this.document.execCommand("unlink",false,null);
}else{
if((_69=="hilitecolor")&&(dojo.isMoz)){
this.document.execCommand("styleWithCSS",false,true);
_6b=this.document.execCommand(_69,false,_6a);
this.document.execCommand("styleWithCSS",false,false);
}else{
if((dojo.isIE)&&((_69=="backcolor")||(_69=="forecolor"))){
_6a=arguments.length>1?_6a:null;
_6b=this.document.execCommand(_69,false,_6a);
}else{
_6a=arguments.length>1?_6a:null;
if(_6a||_69!="createlink"){
_6b=this.document.execCommand(_69,false,_6a);
}
}
}
}
}
this.onDisplayChanged();
return _6b;
},queryCommandEnabled:function(_6f){
if(this.disabled||!this._disabledOK){
return false;
}
_6f=this._normalizeCommand(_6f);
if(dojo.isMoz||dojo.isWebKit){
if(_6f=="unlink"){
this._sCall("hasAncestorElement",["a"]);
}else{
if(_6f=="inserttable"){
return true;
}
}
}
if(dojo.isWebKit){
if(_6f=="copy"){
_6f="cut";
}else{
if(_6f=="paste"){
return true;
}
}
}
var _70=dojo.isIE?this.document.selection.createRange():this.document;
return _70.queryCommandEnabled(_6f);
},queryCommandState:function(_71){
if(this.disabled||!this._disabledOK){
return false;
}
_71=this._normalizeCommand(_71);
return this.document.queryCommandState(_71);
},queryCommandValue:function(_72){
if(this.disabled||!this._disabledOK){
return false;
}
var r;
_72=this._normalizeCommand(_72);
if(dojo.isIE&&_72=="formatblock"){
r=this._native2LocalFormatNames[this.document.queryCommandValue(_72)];
}else{
r=this.document.queryCommandValue(_72);
}
return r;
},_sCall:function(_74,_75){
return dojo.withGlobal(this.window,_74,dijit._editor.selection,_75);
},placeCursorAtStart:function(){
this.focus();
var _76=false;
if(dojo.isMoz){
var _77=this.editNode.firstChild;
while(_77){
if(_77.nodeType==3){
if(_77.nodeValue.replace(/^\s+|\s+$/g,"").length>0){
_76=true;
this._sCall("selectElement",[_77]);
break;
}
}else{
if(_77.nodeType==1){
_76=true;
this._sCall("selectElementChildren",[_77]);
break;
}
}
_77=_77.nextSibling;
}
}else{
_76=true;
this._sCall("selectElementChildren",[this.editNode]);
}
if(_76){
this._sCall("collapse",[true]);
}
},placeCursorAtEnd:function(){
this.focus();
var _78=false;
if(dojo.isMoz){
var _79=this.editNode.lastChild;
while(_79){
if(_79.nodeType==3){
if(_79.nodeValue.replace(/^\s+|\s+$/g,"").length>0){
_78=true;
this._sCall("selectElement",[_79]);
break;
}
}else{
if(_79.nodeType==1){
_78=true;
if(_79.lastChild){
this._sCall("selectElement",[_79.lastChild]);
}else{
this._sCall("selectElement",[_79]);
}
break;
}
}
_79=_79.previousSibling;
}
}else{
_78=true;
this._sCall("selectElementChildren",[this.editNode]);
}
if(_78){
this._sCall("collapse",[false]);
}
},getValue:function(_7a){
if(this.textarea){
if(this.isClosed||!this.isLoaded){
return this.textarea.value;
}
}
return this._postFilterContent(null,_7a);
},_getValueAttr:function(){
return this.getValue();
},setValue:function(_7b){
if(!this.isLoaded){
this.onLoadDeferred.addCallback(dojo.hitch(this,function(){
this.setValue(_7b);
}));
return;
}
if(this.textarea&&(this.isClosed||!this.isLoaded)){
this.textarea.value=_7b;
}else{
_7b=this._preFilterContent(_7b);
var _7c=this.isClosed?this.domNode:this.editNode;
_7c.innerHTML=_7b;
this._preDomFilterContent(_7c);
}
this.onDisplayChanged();
},replaceValue:function(_7d){
if(this.isClosed){
this.setValue(_7d);
}else{
if(this.window&&this.window.getSelection&&!dojo.isMoz){
this.setValue(_7d);
}else{
if(this.window&&this.window.getSelection){
_7d=this._preFilterContent(_7d);
this.execCommand("selectall");
if(dojo.isMoz&&!_7d){
_7d="&nbsp;";
}
this.execCommand("inserthtml",_7d);
this._preDomFilterContent(this.editNode);
}else{
if(this.document&&this.document.selection){
this.setValue(_7d);
}
}
}
}
},_preFilterContent:function(_7e){
var ec=_7e;
dojo.forEach(this.contentPreFilters,function(ef){
if(ef){
ec=ef(ec);
}
});
return ec;
},_preDomFilterContent:function(dom){
dom=dom||this.editNode;
dojo.forEach(this.contentDomPreFilters,function(ef){
if(ef&&dojo.isFunction(ef)){
ef(dom);
}
},this);
},_postFilterContent:function(dom,_84){
var ec;
if(!dojo.isString(dom)){
dom=dom||this.editNode;
if(this.contentDomPostFilters.length){
if(_84){
dom=dojo.clone(dom);
}
dojo.forEach(this.contentDomPostFilters,function(ef){
dom=ef(dom);
});
}
ec=dijit._editor.getChildrenHtml(dom);
}else{
ec=dom;
}
if(!dojo.trim(ec.replace(/^\xA0\xA0*/,"").replace(/\xA0\xA0*$/,"")).length){
ec="";
}
dojo.forEach(this.contentPostFilters,function(ef){
ec=ef(ec);
});
return ec;
},_saveContent:function(e){
var _89=dojo.byId(dijit._scopeName+"._editor.RichText.savedContent");
_89.value+=this._SEPARATOR+this.name+":"+this.getValue();
},escapeXml:function(str,_8b){
str=str.replace(/&/gm,"&amp;").replace(/</gm,"&lt;").replace(/>/gm,"&gt;").replace(/"/gm,"&quot;");
if(!_8b){
str=str.replace(/'/gm,"&#39;");
}
return str;
},getNodeHtml:function(_8c){
dojo.deprecated("dijit.Editor::getNodeHtml is deprecated","use dijit._editor.getNodeHtml instead",2);
return dijit._editor.getNodeHtml(_8c);
},getNodeChildrenHtml:function(dom){
dojo.deprecated("dijit.Editor::getNodeChildrenHtml is deprecated","use dijit._editor.getChildrenHtml instead",2);
return dijit._editor.getChildrenHtml(dom);
},close:function(_8e,_8f){
if(this.isClosed){
return false;
}
if(!arguments.length){
_8e=true;
}
this._content=this.getValue();
var _90=(this.savedContent!=this._content);
if(this.interval){
clearInterval(this.interval);
}
if(this._webkitListener){
this.disconnect(this._webkitListener);
delete this._webkitListener;
}
if(dojo.isIE){
this.iframe.onfocus=null;
}
this.iframe._loadFunc=null;
if(this.textarea){
var s=this.textarea.style;
s.position="";
s.left=s.top="";
if(dojo.isIE){
s.overflow=this.__overflow;
this.__overflow=null;
}
this.textarea.value=_8e?this._content:this.savedContent;
dojo.destroy(this.domNode);
this.domNode=this.textarea;
}else{
this.domNode.innerHTML=_8e?this._content:this.savedContent;
}
dojo.removeClass(this.domNode,"RichTextEditable");
this.isClosed=true;
this.isLoaded=false;
delete this.editNode;
if(this.window&&this.window._frameElement){
this.window._frameElement=null;
}
this.window=null;
this.document=null;
this.editingArea=null;
this.editorObject=null;
return _90;
},destroyRendering:function(){
},destroy:function(){
this.destroyRendering();
if(!this.isClosed){
this.close(false);
}
this.inherited(arguments);
},_removeMozBogus:function(_92){
return _92.replace(/\stype="_moz"/gi,"").replace(/\s_moz_dirty=""/gi,"");
},_removeSafariBogus:function(_93){
return _93.replace(/\sclass="webkit-block-placeholder"/gi,"");
},_fixContentForMoz:function(_94){
return _94.replace(/<(\/)?strong([ \>])/gi,"<$1b$2").replace(/<(\/)?em([ \>])/gi,"<$1i$2");
},_preFixUrlAttributes:function(_95){
return _95.replace(/(?:(<a(?=\s).*?\shref=)("|')(.*?)\2)|(?:(<a\s.*?href=)([^"'][^ >]+))/gi,"$1$4$2$3$5$2 _djrealurl=$2$3$5$2").replace(/(?:(<img(?=\s).*?\ssrc=)("|')(.*?)\2)|(?:(<img\s.*?src=)([^"'][^ >]+))/gi,"$1$4$2$3$5$2 _djrealurl=$2$3$5$2");
}});
}
