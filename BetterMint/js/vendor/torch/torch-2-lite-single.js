/*!
 * Torch (c) 2024, Chess.com, LLC
 */var IS_ASYNCIFY = 1;
(function () {
var Torch;
function INIT_ENGINE() {

var Torch = (() => {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  if (typeof __filename !== 'undefined') _scriptDir = _scriptDir || __filename;
  return (
function(Torch) {
  Torch = Torch || {};


var c;c||(c=typeof Torch !== 'undefined' ? Torch : {});var aa,l;c.ready=new Promise(function(a,b){aa=a;l=b});
"undefined"!==typeof global&&"[object process]"===Object.prototype.toString.call(global.process)&&"undefined"!==typeof fetch&&("undefined"===typeof XMLHttpRequest&&(global.XMLHttpRequest=function(){var a,b={open:function(e,f){a=f},send:function(){require("fs").readFile(a,function(e,f){b.readyState=4;e?(console.error(e),b.status=404,b.onerror(e)):(b.status=200,b.response=f,b.onreadystatechange(),b.onload())})}};return b}),fetch=null);c.print=function(a){c.listener?c.listener(a):console.log(a)};
c.printErr=function(a){c.listener?c.listener(a):console.error(a)};c.terminate=function(){"undefined"!==typeof PThread&&PThread.ga()};var ba=Object.assign({},c),v=[],w="./this.program",x=(a,b)=>{throw b;},ca="object"==typeof window,z="function"==typeof importScripts,da="object"==typeof process&&"object"==typeof process.versions&&"string"==typeof process.versions.node,A="",ea,B,fs,fa,ha;
if(da)A=z?require("path").dirname(A)+"/":__dirname+"/",ha=()=>{fa||(fs=require("fs"),fa=require("path"))},ea=function(a,b){ha();a=fa.normalize(a);return fs.readFileSync(a,b?void 0:"utf8")},B=a=>{a=ea(a,!0);a.buffer||(a=new Uint8Array(a));return a},1<process.argv.length&&(w=process.argv[1].replace(/\\/g,"/")),v=process.argv.slice(2),process.on("uncaughtException",function(a){if(!(a instanceof C))throw a;}),process.on("unhandledRejection",function(a){throw a;}),x=(a,b)=>{if(noExitRuntime||0<D)throw process.exitCode=
a,b;b instanceof C||E("exiting due to exception: "+b);process.exit(a)},c.inspect=function(){return"[Emscripten Module object]"};else if(ca||z)z?A=self.location.href:"undefined"!=typeof document&&document.currentScript&&(A=document.currentScript.src),_scriptDir&&(A=_scriptDir),0!==A.indexOf("blob:")?A=A.substr(0,A.replace(/[?#].*/,"").lastIndexOf("/")+1):A="",ea=a=>{var b=new XMLHttpRequest;b.open("GET",a,!1);b.send(null);return b.responseText},z&&(B=a=>{var b=new XMLHttpRequest;b.open("GET",a,!1);
b.responseType="arraybuffer";b.send(null);return new Uint8Array(b.response)});var ia=c.print||console.log.bind(console),E=c.printErr||console.warn.bind(console);Object.assign(c,ba);ba=null;c.arguments&&(v=c.arguments);c.thisProgram&&(w=c.thisProgram);c.quit&&(x=c.quit);var G;c.wasmBinary&&(G=c.wasmBinary);var noExitRuntime=c.noExitRuntime||!0;"object"!=typeof WebAssembly&&H("no native wasm support detected");var ja,I=!1,ka="undefined"!=typeof TextDecoder?new TextDecoder("utf8"):void 0;
function la(a,b,e){var f=b+e;for(e=b;a[e]&&!(e>=f);)++e;if(16<e-b&&a.subarray&&ka)return ka.decode(a.subarray(b,e));for(f="";b<e;){var h=a[b++];if(h&128){var g=a[b++]&63;if(192==(h&224))f+=String.fromCharCode((h&31)<<6|g);else{var k=a[b++]&63;h=224==(h&240)?(h&15)<<12|g<<6|k:(h&7)<<18|g<<12|k<<6|a[b++]&63;65536>h?f+=String.fromCharCode(h):(h-=65536,f+=String.fromCharCode(55296|h>>10,56320|h&1023))}}else f+=String.fromCharCode(h)}return f}function ma(a){return a?la(J,a,void 0):""}
function na(a,b,e,f){if(0<f){f=e+f-1;for(var h=0;h<a.length;++h){var g=a.charCodeAt(h);if(55296<=g&&57343>=g){var k=a.charCodeAt(++h);g=65536+((g&1023)<<10)|k&1023}if(127>=g){if(e>=f)break;b[e++]=g}else{if(2047>=g){if(e+1>=f)break;b[e++]=192|g>>6}else{if(65535>=g){if(e+2>=f)break;b[e++]=224|g>>12}else{if(e+3>=f)break;b[e++]=240|g>>18;b[e++]=128|g>>12&63}b[e++]=128|g>>6&63}b[e++]=128|g&63}}b[e]=0}}
function oa(a){for(var b=0,e=0;e<a.length;++e){var f=a.charCodeAt(e);55296<=f&&57343>=f&&(f=65536+((f&1023)<<10)|a.charCodeAt(++e)&1023);127>=f?++b:b=2047>=f?b+2:65535>=f?b+3:b+4}return b}function pa(a){var b=oa(a)+1,e=K(b);na(a,L,e,b);return e}var L,J,M,qa=[],ra=[],sa=[],ta=[],ua=!1,D=0;function va(){var a=c.preRun.shift();qa.unshift(a)}var N=0,wa=null,O=null;c.preloadedImages={};c.preloadedAudios={};
function H(a){if(c.onAbort)c.onAbort(a);a="Aborted("+a+")";E(a);I=!0;a=new WebAssembly.RuntimeError(a+". Build with -s ASSERTIONS=1 for more info.");l(a);throw a;}function xa(){return P.startsWith("data:application/octet-stream;base64,")}var P;P="torch-$TORCH_VERSION-lite-single.wasm";if(!xa()){var ya=P;P=c.locateFile?c.locateFile(ya,A):A+ya}function za(){var a=P;try{if(a==P&&G)return new Uint8Array(G);if(B)return B(a);throw"both async and sync fetching of the wasm failed";}catch(b){H(b)}}
function Aa(){return G||!ca&&!z||"function"!=typeof fetch?Promise.resolve().then(function(){return za()}):fetch(P,{credentials:"same-origin"}).then(function(a){if(!a.ok)throw"failed to load wasm binary file at '"+P+"'";return a.arrayBuffer()}).catch(function(){return za()})}function Q(a){for(;0<a.length;){var b=a.shift();if("function"==typeof b)b(c);else{var e=b.T;"number"==typeof e?void 0===b.R?dynCall_v.call(null,e):dynCall_vi.apply(null,[e,b.R]):e(void 0===b.R?null:b.R)}}}
function Ba(a){a instanceof C||"unwind"==a||x(1,a)}function Ca(a){this.L=a-16;this.Z=function(b){M[this.L+4>>2]=b};this.W=function(b){M[this.L+8>>2]=b};this.X=function(){M[this.L>>2]=0};this.V=function(){L[this.L+12>>0]=0};this.Y=function(){L[this.L+13>>0]=0};this.U=function(b,e){this.Z(b);this.W(e);this.X();this.V();this.Y()}}var Da=0,Ea=[null,[],[]],Fa={},Ga;Ga=da?()=>{var a=process.hrtime();return 1E3*a[0]+a[1]/1E6}:()=>performance.now();function Ha(a){if(!ua&&!I)try{a()}catch(b){Ba(b)}}
function Ja(a,b){return setTimeout(function(){Ha(a)},b)}var Ka={};function La(){if(!Ma){var a={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:("object"==typeof navigator&&navigator.languages&&navigator.languages[0]||"C").replace("-","_")+".UTF-8",_:w||"./this.program"},b;for(b in Ka)void 0===Ka[b]?delete a[b]:a[b]=Ka[b];var e=[];for(b in a)e.push(b+"="+a[b]);Ma=e}return Ma}var Ma;function R(a){return 0===a%4&&(0!==a%100||0===a%400)}
function Na(a,b){for(var e=0,f=0;f<=b;e+=a[f++]);return e}var S=[31,29,31,30,31,30,31,31,30,31,30,31],T=[31,28,31,30,31,30,31,31,30,31,30,31];function U(a,b){for(a=new Date(a.getTime());0<b;){var e=a.getMonth(),f=(R(a.getFullYear())?S:T)[e];if(b>f-a.getDate())b-=f-a.getDate()+1,a.setDate(1),11>e?a.setMonth(e+1):(a.setMonth(0),a.setFullYear(a.getFullYear()+1));else{a.setDate(a.getDate()+b);break}}return a}
function Oa(a,b,e,f){function h(d,m,n){for(d="number"==typeof d?d.toString():d||"";d.length<m;)d=n[0]+d;return d}function g(d,m){return h(d,m,"0")}function k(d,m){function n(Ia){return 0>Ia?-1:0<Ia?1:0}var F;0===(F=n(d.getFullYear()-m.getFullYear()))&&0===(F=n(d.getMonth()-m.getMonth()))&&(F=n(d.getDate()-m.getDate()));return F}function r(d){switch(d.getDay()){case 0:return new Date(d.getFullYear()-1,11,29);case 1:return d;case 2:return new Date(d.getFullYear(),0,3);case 3:return new Date(d.getFullYear(),
0,2);case 4:return new Date(d.getFullYear(),0,1);case 5:return new Date(d.getFullYear()-1,11,31);case 6:return new Date(d.getFullYear()-1,11,30)}}function u(d){d=U(new Date(d.J+1900,0,1),d.P);var m=new Date(d.getFullYear()+1,0,4),n=r(new Date(d.getFullYear(),0,4));m=r(m);return 0>=k(n,d)?0>=k(m,d)?d.getFullYear()+1:d.getFullYear():d.getFullYear()-1}var p=M[f+40>>2];f={ba:M[f>>2],aa:M[f+4>>2],N:M[f+8>>2],M:M[f+12>>2],K:M[f+16>>2],J:M[f+20>>2],O:M[f+24>>2],P:M[f+28>>2],ha:M[f+32>>2],$:M[f+36>>2],da:p?
ma(p):""};e=ma(e);p={"%c":"%a %b %d %H:%M:%S %Y","%D":"%m/%d/%y","%F":"%Y-%m-%d","%h":"%b","%r":"%I:%M:%S %p","%R":"%H:%M","%T":"%H:%M:%S","%x":"%m/%d/%y","%X":"%H:%M:%S","%Ec":"%c","%EC":"%C","%Ex":"%m/%d/%y","%EX":"%H:%M:%S","%Ey":"%y","%EY":"%Y","%Od":"%d","%Oe":"%e","%OH":"%H","%OI":"%I","%Om":"%m","%OM":"%M","%OS":"%S","%Ou":"%u","%OU":"%U","%OV":"%V","%Ow":"%w","%OW":"%W","%Oy":"%y"};for(var q in p)e=e.replace(new RegExp(q,"g"),p[q]);var t="Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" "),
y="January February March April May June July August September October November December".split(" ");p={"%a":function(d){return t[d.O].substring(0,3)},"%A":function(d){return t[d.O]},"%b":function(d){return y[d.K].substring(0,3)},"%B":function(d){return y[d.K]},"%C":function(d){return g((d.J+1900)/100|0,2)},"%d":function(d){return g(d.M,2)},"%e":function(d){return h(d.M,2," ")},"%g":function(d){return u(d).toString().substring(2)},"%G":function(d){return u(d)},"%H":function(d){return g(d.N,2)},"%I":function(d){d=
d.N;0==d?d=12:12<d&&(d-=12);return g(d,2)},"%j":function(d){return g(d.M+Na(R(d.J+1900)?S:T,d.K-1),3)},"%m":function(d){return g(d.K+1,2)},"%M":function(d){return g(d.aa,2)},"%n":function(){return"\n"},"%p":function(d){return 0<=d.N&&12>d.N?"AM":"PM"},"%S":function(d){return g(d.ba,2)},"%t":function(){return"\t"},"%u":function(d){return d.O||7},"%U":function(d){var m=new Date(d.J+1900,0,1),n=0===m.getDay()?m:U(m,7-m.getDay());d=new Date(d.J+1900,d.K,d.M);return 0>k(n,d)?g(Math.ceil((31-n.getDate()+
(Na(R(d.getFullYear())?S:T,d.getMonth()-1)-31)+d.getDate())/7),2):0===k(n,m)?"01":"00"},"%V":function(d){var m=new Date(d.J+1901,0,4),n=r(new Date(d.J+1900,0,4));m=r(m);var F=U(new Date(d.J+1900,0,1),d.P);return 0>k(F,n)?"53":0>=k(m,F)?"01":g(Math.ceil((n.getFullYear()<d.J+1900?d.P+32-n.getDate():d.P+1-n.getDate())/7),2)},"%w":function(d){return d.O},"%W":function(d){var m=new Date(d.J,0,1),n=1===m.getDay()?m:U(m,0===m.getDay()?1:7-m.getDay()+1);d=new Date(d.J+1900,d.K,d.M);return 0>k(n,d)?g(Math.ceil((31-
n.getDate()+(Na(R(d.getFullYear())?S:T,d.getMonth()-1)-31)+d.getDate())/7),2):0===k(n,m)?"01":"00"},"%y":function(d){return(d.J+1900).toString().substring(2)},"%Y":function(d){return d.J+1900},"%z":function(d){d=d.$;var m=0<=d;d=Math.abs(d)/60;return(m?"+":"-")+String("0000"+(d/60*100+d%60)).slice(-4)},"%Z":function(d){return d.da},"%%":function(){return"%"}};e=e.replace(/%%/g,"\x00\x00");for(q in p)e.includes(q)&&(e=e.replace(new RegExp(q,"g"),p[q](f)));e=e.replace(/\0\0/g,"%");q=Pa(e);if(q.length>
b)return 0;L.set(q,a);return q.length-1}function V(a){try{a()}catch(b){H(b)}}var W=0,X=null,Y=[],Qa={},Ra={},Sa=0,Ta=null,Ua=[];function Va(a){var b={},e;for(e in a)(function(f){var h=a[f];b[f]="function"==typeof h?function(){Y.push(f);try{return h.apply(null,arguments)}finally{I||(Y.pop()===f||H(void 0),X&&1===W&&0===Y.length&&(W=0,V(c._asyncify_stop_unwind),"undefined"!=typeof Fibers&&Fibers.ia()))}}:h})(e);return b}function Wa(){return new Promise((a,b)=>{Ta={resolve:a,reject:b}})}
function Xa(){var a=Ya(10485772),b=a+12;M[a>>2]=b;M[a+4>>2]=b+10485760;b=Y[0];var e=Qa[b];void 0===e&&(e=Sa++,Qa[b]=e,Ra[e]=b);M[a+8>>2]=e;return a}
function Za(a){if(!I)if(0===W){var b=!1,e=!1;a(()=>{if(!I&&(b=!0,e)){W=2;V(()=>c._asyncify_start_rewind(X));"undefined"!=typeof Browser&&Browser.S.T&&Browser.S.resume();var f=!1;try{var h=(0,c.asm[Ra[M[X+8>>2]]])()}catch(r){h=r,f=!0}var g=!1;if(!X){var k=Ta;k&&(Ta=null,(f?k.reject:k.resolve)(h),g=!0)}if(f&&!g)throw h;}});e=!0;b||(W=1,X=Xa(),V(()=>c._asyncify_start_unwind(X)),"undefined"!=typeof Browser&&Browser.S.T&&Browser.S.pause())}else 2===W?(W=0,V(c._asyncify_stop_rewind),$a(X),X=null,Ua.forEach(f=>
Ha(f))):H("invalid state: "+W)}function Pa(a){var b=Array(oa(a)+1);na(a,b,0,b.length);return b}
var cb={h:function(a){return Ya(a+16)+16},g:function(a,b,e){(new Ca(a)).U(b,e);Da++;throw a;},f:function(){return 0},k:function(){return 0},l:function(){},c:function(){H("")},q:function(a,b){if(0===a)a=Date.now();else if(1===a||4===a)a=Ga();else return M[ab()>>2]=28,-1;M[b>>2]=a/1E3|0;M[b+4>>2]=a%1E3*1E6|0;return 0},r:function(a,b,e){J.copyWithin(a,b,b+e)},d:function(){H("OOM")},a:function(a){Za(b=>Ja(b,a))},o:function(a,b){var e=0;La().forEach(function(f,h){var g=b+e;h=M[a+4*h>>2]=g;for(g=0;g<f.length;++g)L[h++>>
0]=f.charCodeAt(g);L[h>>0]=0;e+=f.length+1});return 0},p:function(a,b){var e=La();M[a>>2]=e.length;var f=0;e.forEach(function(h){f+=h.length+1});M[b>>2]=f;return 0},b:function(a){bb(a)},e:function(){return 0},j:function(a,b,e,f){a=Fa.fa(a);b=Fa.ea(a,b,e);M[f>>2]=b;return 0},m:function(){},i:function(a,b,e,f){for(var h=0,g=0;g<e;g++){var k=M[b>>2],r=M[b+4>>2];b+=8;for(var u=0;u<r;u++){var p=J[k+u],q=Ea[a];0===p||10===p?((1===a?ia:E)(la(q,0)),q.length=0):q.push(p)}h+=r}M[f>>2]=h;return 0},n:function(a,
b,e,f){return Oa(a,b,e,f)}};
(function(){function a(g){g=g.exports;g=Va(g);c.asm=g;ja=c.asm.s;g=ja.buffer;c.HEAP8=L=new Int8Array(g);c.HEAP16=new Int16Array(g);c.HEAP32=M=new Int32Array(g);c.HEAPU8=J=new Uint8Array(g);c.HEAPU16=new Uint16Array(g);c.HEAPU32=new Uint32Array(g);c.HEAPF32=new Float32Array(g);c.HEAPF64=new Float64Array(g);ra.unshift(c.asm.t);N--;c.monitorRunDependencies&&c.monitorRunDependencies(N);0==N&&(null!==wa&&(clearInterval(wa),wa=null),O&&(g=O,O=null,g()))}function b(g){a(g.instance)}function e(g){return Aa().then(function(k){return WebAssembly.instantiate(k,
f)}).then(function(k){return k}).then(g,function(k){E("failed to asynchronously prepare wasm: "+k);H(k)})}var f={a:cb};N++;c.monitorRunDependencies&&c.monitorRunDependencies(N);if(c.instantiateWasm)try{var h=c.instantiateWasm(f,a);return h=Va(h)}catch(g){return E("Module.instantiateWasm callback failed with error: "+g),!1}(function(){return G||"function"!=typeof WebAssembly.instantiateStreaming||xa()||"function"!=typeof fetch?e(b):fetch(P,{credentials:"same-origin"}).then(function(g){return WebAssembly.instantiateStreaming(g,
f).then(b,function(k){E("wasm streaming compile failed: "+k);E("falling back to ArrayBuffer instantiation");return e(b)})})})().catch(l);return{}})();c.___wasm_call_ctors=function(){return(c.___wasm_call_ctors=c.asm.t).apply(null,arguments)};var $a=c._free=function(){return($a=c._free=c.asm.u).apply(null,arguments)};c._main=function(){return(c._main=c.asm.v).apply(null,arguments)};c._command=function(){return(c._command=c.asm.w).apply(null,arguments)};
var Ya=c._malloc=function(){return(Ya=c._malloc=c.asm.x).apply(null,arguments)},ab=c.___errno_location=function(){return(ab=c.___errno_location=c.asm.y).apply(null,arguments)},db=c.stackSave=function(){return(db=c.stackSave=c.asm.A).apply(null,arguments)},eb=c.stackRestore=function(){return(eb=c.stackRestore=c.asm.B).apply(null,arguments)},K=c.stackAlloc=function(){return(K=c.stackAlloc=c.asm.C).apply(null,arguments)},dynCall_vi=c.dynCall_vi=function(){return(dynCall_vi=c.dynCall_vi=c.asm.D).apply(null,
arguments)},dynCall_v=c.dynCall_v=function(){return(dynCall_v=c.dynCall_v=c.asm.E).apply(null,arguments)};c._asyncify_start_unwind=function(){return(c._asyncify_start_unwind=c.asm.F).apply(null,arguments)};c._asyncify_stop_unwind=function(){return(c._asyncify_stop_unwind=c.asm.G).apply(null,arguments)};c._asyncify_start_rewind=function(){return(c._asyncify_start_rewind=c.asm.H).apply(null,arguments)};c._asyncify_stop_rewind=function(){return(c._asyncify_stop_rewind=c.asm.I).apply(null,arguments)};
c.ccall=function(a,b,e,f,h){function g(t){--D;0!==u&&eb(u);return"string"===b?ma(t):"boolean"===b?!!t:t}var k={string:function(t){var y=0;if(null!==t&&void 0!==t&&0!==t){var d=(t.length<<2)+1;y=K(d);na(t,J,y,d)}return y},array:function(t){var y=K(t.length);L.set(t,y);return y}};a=c["_"+a];var r=[],u=0;if(f)for(var p=0;p<f.length;p++){var q=k[e[p]];q?(0===u&&(u=db()),r[p]=q(f[p])):r[p]=f[p]}e=X;f=a.apply(null,r);D+=1;h=h&&h.async;if(X!=e)return Wa().then(g);f=g(f);return h?Promise.resolve(f):f};var Z;
function C(a){this.name="ExitStatus";this.message="Program terminated with exit("+a+")";this.status=a}O=function fb(){Z||gb();Z||(O=fb)};
function gb(a){function b(){if(!Z&&(Z=!0,c.calledRun=!0,!I)){Q(ra);Q(sa);aa(c);if(c.onRuntimeInitialized)c.onRuntimeInitialized();if(hb){var e=a,f=c._main;e=e||[];var h=e.length+1,g=K(4*(h+1));M[g>>2]=pa(w);for(var k=1;k<h;k++)M[(g>>2)+k]=pa(e[k-1]);M[(g>>2)+h]=0;try{var r=f(h,g);bb(r)}catch(u){Ba(u)}finally{}}if(c.postRun)for("function"==typeof c.postRun&&(c.postRun=[c.postRun]);c.postRun.length;)e=c.postRun.shift(),ta.unshift(e);Q(ta)}}a=a||v;if(!(0<N)){if(c.preRun)for("function"==typeof c.preRun&&
(c.preRun=[c.preRun]);c.preRun.length;)va();Q(qa);0<N||(c.setStatus?(c.setStatus("Running..."),setTimeout(function(){setTimeout(function(){c.setStatus("")},1);b()},1)):b())}}c.run=gb;function bb(a){noExitRuntime||0<D||(ua=!0);if(!(noExitRuntime||0<D)){if(c.onExit)c.onExit(a);I=!0}x(a,new C(a))}if(c.preInit)for("function"==typeof c.preInit&&(c.preInit=[c.preInit]);0<c.preInit.length;)c.preInit.pop()();var hb=!0;c.noInitialRun&&(hb=!1);gb();


  return Torch.ready
}
);
})();
if (typeof exports === 'object' && typeof module === 'object')
  module.exports = Torch;
else if (typeof define === 'function' && define['amd'])
  define([], function() { return Torch; });
else if (typeof exports === 'object')
  exports["Torch"] = Torch;
return Torch;
}

if (typeof self !== "undefined" && self.location.hash.split(",")[1] === "worker" || typeof global !== "undefined" && Object.prototype.toString.call(global.process) === "[object process]" && !require("worker_threads").isMainThread) {
    (function() {
        /// Insert worker here
self._origOnmessage = self.onmessage;
self.onmessage = function (e)
{
    if (e.data.cmd === "load") {
        // Preload command that is called once per worker to parse and load the Emscripten code.
        // Module and memory were sent from main thread
        Module["wasmModule"] = e.data.wasmModule;
        Module["wasmMemory"] = e.data.wasmMemory;
        Module["buffer"] = Module["wasmMemory"].buffer;
        Module["ENVIRONMENT_IS_PTHREAD"] = true;
        if (e.data.workerID) {
            Module['workerID'] = e.data.workerID;
        }
        if (e.data.wasmSourceMap) {
            Module['wasmSourceMapData'] = e.data.wasmSourceMap;
        }
        if (e.data.wasmOffsetConverter) {
            Module['wasmOffsetData'] = e.data.wasmOffsetConverter;
        }
        Torch = INIT_ENGINE();
        Torch(Module).then(function (instance)
        {
            Module = instance;
        });
    } else {
        self._origOnmessage(e);
    }
};
    })();
/// Is it a web worker?
} else if (typeof onmessage !== "undefined" && (typeof window === "undefined" || typeof window.document === "undefined") || typeof global !== "undefined" && Object.prototype.toString.call(global.process) === "[object process]") {
    (function ()
    {
        var isNode = typeof global !== "undefined" && Object.prototype.toString.call(global.process) === "[object process]";
        var engine = {};
        var queue = [];
        var wasmPath;

        if (isNode) {
            ///NOTE: Node.js v14-19 needs --experimental-wasm-threads --experimental-wasm-simd
            /// Was it called directly?
            if (require.main === module) {
                (function ()
                {
                    var p = require("path");
                    
                    function assembleWASM(count)
                    {
                        var fs = require("fs");
                        var ext = p.extname(wasmPath);
                        var basename = wasmPath.slice(0, -ext.length);
                        var i;
                        var buffers = [];
                        
                        for (i = 0; i < count; ++i) {
                            buffers.push(fs.readFileSync(basename + "-part-" + i + ".wasm"));
                        }
                        
                        return Buffer.concat(buffers);
                    }
                    
                    wasmPath = p.join(__dirname, p.basename(__filename, p.extname(__filename)) + ".wasm");
                    engine = {
                        locateFile: function (path)
                        {
                            if (path.indexOf(".wasm") > -1) {
                                if (path.indexOf(".wasm.map") > -1) {
                                    /// Set the path to the wasm map.
                                    return wasmPath + ".map"
                                }
                                /// Set the path to the wasm binary.
                                return wasmPath;
                            }
                            /// Set path to worker
                            return __filename;
                        },
                        listener: function onMessage(line)
                        {
                            process.stdout.write(line + "\n");
                        },
                    };
                    
                    if (typeof enginePartsCount === "number") {
                        /// Prepare the wasm data because it is in parts.
                        engine.wasmBinary = assembleWASM(enginePartsCount);
                    }
                }());

                Torch = INIT_ENGINE();
                Torch(engine).then(function ()
                {
                    engine.sendCommand = function (cmd)
                    {
                        ///NOTE: The single-threaded engine needs to specifiy async for "go" commands to prevent memory leaks and other errors.
                        engine.ccall("command", null, ["string"], [cmd], {async: typeof IS_ASYNCIFY !== "undefined" && /^go\b/.test(cmd)});
                    };

                    queue.forEach(engine.sendCommand);
                    queue = null;
                });

                require("readline").createInterface({
                    input: process.stdin,
                    output: process.stdout,
                    historySize: 100,
                }).on("line", function online(line)
                {
                    if (line) {
                        if (engine.sendCommand) {
                            engine.sendCommand(line);
                        } else {
                            queue.push(line);
                        }
                        if (line === "quit" || line === "exit") {
                            process.exit();
                        }
                    }
                }).on("close", function onend()
                {
                    process.exit();
                }).setPrompt("");

            /// Is this a node module?
            } else {
                module.exports = INIT_ENGINE;
            }
        } else {
            (function ()
            {
                var wasmBlob;
                
                function loadBinary(onLoaded)
                {
                    function fetchBinary(path, cb)
                    {
                        fetch(new Request(path)).then(function (response)
                        {
                            return response.blob();
                        }).then(function (wasmData)
                        {
                            cb(wasmData);
                        });
                    }
                    function loadParts(total)
                    {
                        var doneCount = 0;
                        var i;
                        var parts = [];
                        var ext = wasmPath.slice((wasmPath.lastIndexOf(".") - 1 >>> 0) + 1);
                        var basename = wasmPath.slice(0, -ext.length);
                        
                        function createOnDownload(num)
                        {
                            return function onDownload(data)
                            {
                                var wasmBlob;
                                ++doneCount;
                                parts[num] = data;
                                if (doneCount === total) {
                                    wasmBlob = URL.createObjectURL(new Blob(parts));
                                    onLoaded(wasmBlob);
                                }
                            };
                        }
                        for (i = 0; i < total; ++i) {
                            fetchBinary(basename + "-part-" + i + ext, createOnDownload(i));
                        }
                    }
                    if (typeof enginePartsCount === "number") {
                        loadParts(enginePartsCount);
                    } else {
                        onLoaded();
                    }
                }
                
                var args = self.location.hash.substr(1).split(",");
                wasmPath = decodeURIComponent(args[0] || location.origin + location.pathname.replace(/\.js$/i, ".wasm"));
                
                loadBinary(function (wasmBlob)
                {
                    engine = {
                        locateFile: function (path)
                        {
                            if (path.indexOf(".wasm") > -1) {
                                if (path.indexOf(".wasm.map") > -1) {
                                    /// Set the path to the wasm map.
                                    return wasmPath + ".map"
                                }
                                /// Set the path to the wasm binary.
                                return wasmBlob || wasmPath;
                            }
                            /// Set path to worker (self + the worker hash)
                            return self.location.origin + self.location.pathname + "#" + wasmPath + ",worker";
                        },
                        listener: function onMessage(line)
                        {
                            postMessage(line);
                        },
                    }
                    Torch = INIT_ENGINE();
                
                    Torch(engine).then(function checkIfReady()
                    {
                        engine.sendCommand = function (cmd)
                        {
                            ///NOTE: The single-threaded engine needs to specifiy async for "go" commands to prevent memory leaks and other errors.
                            engine.ccall("command", null, ["string"], [cmd], {async: typeof IS_ASYNCIFY !== "undefined" && /^go\b/.test(cmd)});
                            ///NOTE: The engine must be fully initialized before we can close the Pthreads. so we have to check this here, not in onmessage.
                            if (cmd === "quit" || cmd === "exit") {
                                /// Close the Pthreads.
                                try {
                                    engine.terminate();
                                } catch (e) {}
                            }
                        };
                        queue.forEach(engine.sendCommand);
                        queue = null;
                    }).catch(function (e)
                    {
                        /// Sadly, Web Workers will not trigger the error event when errors occur in promises, so we need to create a new context and throw an error there.
                        setTimeout(function throwError()
                        {
                            throw e;
                        }, 1);
                    });
                });
                
                /// Make sure that this is only added once.
                if (!onmessage) {
                    onmessage = function (event)
                    {
                        if (engine.sendCommand) {
                            engine.sendCommand(event.data);
                        } else {
                            queue.push(event.data);
                        }
                        ///NOTE: We check this here, not just in engine.sendCommand, because the engine might never finish loading.
                        if (event.data === "quit" || event.data === "exit") {
                            /// Exit the Web Worker.
                            try {
                                self.close();
                            } catch (e) {}
                        }
                    };
                }
            }());
        }
    }());
} else {
    ///NOTE: If it's a normal browser, the client can use the engine without polluting the global scope.
    if (typeof document === "object" && document.currentScript) {
        document.currentScript._exports = INIT_ENGINE();
    } else {
        Torch = INIT_ENGINE();
    }
}
}());
