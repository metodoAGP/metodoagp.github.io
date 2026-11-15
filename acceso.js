/* métodoAGP · acceso provisional mientras la web está en construcción.
   Para abrir la web al público: cambia ABIERTO a true (o borra este archivo y sus líneas <script src="acceso.js">). */
(function(){
"use strict";
var ABIERTO = false;
var HASH = "6aa265a62fb526e7786a83ed3b0da0e7b718785bc982d45f07295525bb660552";
var KEY = "agp-acceso-v1";
if(ABIERTO) return;

function ok(){ try{ return localStorage.getItem(KEY)===HASH; }catch(e){ try{ return sessionStorage.getItem(KEY)===HASH; }catch(e2){ return false; } } }
function remember(){ try{ localStorage.setItem(KEY,HASH); }catch(e){ try{ sessionStorage.setItem(KEY,HASH); }catch(e2){} } }
if(ok()) return;

/* SHA-256 en JavaScript puro (funciona también sin HTTPS) */
function sha256(s){
  var K=[],H=[],i,j,c=0;
  function r(x,n){return (x>>>n)|(x<<(32-n));}
  for(i=2;c<64;i++){var p=1;for(j=2;j*j<=i;j++){if(i%j===0){p=0;break;}}
    if(p){ if(c<8)H[c]=(Math.pow(i,.5)*4294967296)|0; K[c++]=(Math.pow(i,1/3)*4294967296)|0; }}
  var b=unescape(encodeURIComponent(s)),l=b.length,w=[];
  for(i=0;i<l;i++)w[i>>2]|=b.charCodeAt(i)<<(24-(i%4)*8);
  w[l>>2]|=0x80<<(24-(l%4)*8); w[(((l+8)>>6)<<4)+15]=l*8;
  for(var o=0;o<w.length;o+=16){
    var a=H.slice(0),x=[];
    for(i=0;i<64;i++){
      if(i<16)x[i]=w[o+i]|0; else{var g=x[i-15],d=x[i-2];
        x[i]=(x[i-16]+(r(g,7)^r(g,18)^(g>>>3))+x[i-7]+(r(d,17)^r(d,19)^(d>>>10)))|0;}
      var e=a[4],t1=(a[7]+(r(e,6)^r(e,11)^r(e,25))+((e&a[5])^(~e&a[6]))+K[i]+x[i])|0;
      var t2=((r(a[0],2)^r(a[0],13)^r(a[0],22))+((a[0]&a[1])^(a[0]&a[2])^(a[1]&a[2])))|0;
      a=[(t1+t2)|0,a[0],a[1],a[2],(a[3]+t1)|0,a[4],a[5],a[6]];
    }
    for(i=0;i<8;i++)H[i]=(H[i]+a[i])|0;
  }
  var out="";for(i=0;i<8;i++)out+=("00000000"+(H[i]>>>0).toString(16)).slice(-8);
  return out;
}

var de=document.documentElement;
de.className+=" agp-lock";
var st=document.createElement("style");
st.textContent="html.agp-lock{background:#f4f2ee}html.agp-lock body>*:not(#agp-gate){display:none!important}"+
"#agp-gate{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:#f4f2ee;color:#1f2124;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;z-index:2147483647}"+
"#agp-gate form{background:#fff;border:1px solid #d9d6d0;border-radius:14px;padding:32px 28px;width:min(380px,100%);text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08)}"+
"#agp-gate img{width:72px;height:72px}"+
"#agp-gate h1{margin:14px 0 4px;font:800 30px/1 'Barlow Condensed','Arial Narrow',Arial,sans-serif;letter-spacing:.01em}"+
"#agp-gate h1 span{color:#e5532d}"+
"#agp-gate p{margin:0 0 18px;color:#666a70;font-size:14px;line-height:1.45}"+
"#agp-gate input{width:100%;padding:12px 14px;border:1.5px solid #cfcbc4;border-radius:8px;font:inherit;background:#fff;color:inherit}"+
"#agp-gate input:focus{outline:2px solid #e5532d;outline-offset:1px;border-color:#e5532d}"+
"#agp-gate button{margin-top:12px;width:100%;padding:12px 14px;border:0;border-radius:8px;background:#1f2124;color:#fff;font:600 15px inherit;font-family:inherit;cursor:pointer}"+
"#agp-gate button:hover{background:#e5532d}"+
"#agp-gate .err{min-height:20px;margin:10px 0 0;color:#c92f26;font-size:13px}"+
"#agp-gate small{display:block;margin-top:16px;color:#8a8d92;font-size:12px}";
(document.head||de).appendChild(st);

function build(){
  var g=document.createElement("div"); g.id="agp-gate";
  g.innerHTML='<form autocomplete="off"><img src="logo.png" alt="" width="72" height="72">'+
    '<h1>método<span>AGP</span></h1>'+
    '<p>Estamos construyendo esta web. Introduce la contraseña para acceder.</p>'+
    '<input type="password" id="agp-pw" placeholder="Contraseña" aria-label="Contraseña" autocomplete="off" autofocus>'+
    '<button type="submit">Entrar</button><div class="err" id="agp-err" role="alert"></div>'+
    '<small>Expertos en Rentabilidad · expertosenrentabilidad@gmail.com</small></form>';
  document.body.appendChild(g);
  var f=g.querySelector("form"),inp=g.querySelector("#agp-pw"),err=g.querySelector("#agp-err");
  setTimeout(function(){inp.focus();},50);
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var v=inp.value.trim().toLowerCase();
    if(sha256("agp|"+v)===HASH){ remember(); de.className=de.className.replace(/\s*agp-lock/,""); g.parentNode.removeChild(g); st.parentNode.removeChild(st); }
    else{ err.textContent="Contraseña incorrecta."; inp.select(); }
  });
}
if(document.body) build(); else document.addEventListener("DOMContentLoaded",build);
})();
