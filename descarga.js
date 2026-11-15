/* métodoAGP · descarga protegida de la plantilla.
   El archivo plantilla.bin está cifrado (AES-256): sin la contraseña no se puede abrir, aunque alguien conozca su dirección. */
(function(){
"use strict";
var FILE="plantilla.bin", NAME="Plantilla_Metodo_AGP.xlsx";
var st=document.createElement("style");
st.textContent="#pl-bg{position:fixed;inset:0;z-index:99998;background:rgba(31,33,36,.55);display:flex;align-items:center;justify-content:center;padding:20px;font-family:Inter,system-ui,sans-serif}"+
"#pl-box{background:#fff;border-radius:16px;max-width:380px;width:100%;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,.3);text-align:center;color:#1f2124}"+
"#pl-box h3{margin:0 0 8px;font-size:20px}#pl-box p{margin:0 0 16px;font-size:15px;color:#5a5d62}"+
"#pl-box input{width:100%;box-sizing:border-box;padding:13px 14px;font-size:16px;border:1.5px solid #d6d3cb;border-radius:10px;margin-bottom:10px}"+
"#pl-box button{width:100%;padding:13px;font-size:16px;font-weight:600;border:0;border-radius:10px;background:#1f2124;color:#fff;cursor:pointer}"+
"#pl-box button.g{background:none;color:#5a5d62;font-weight:500;margin-top:4px}#pl-err{color:#c0392b;font-size:14px;min-height:20px;margin-bottom:6px}";
document.head.appendChild(st);
function open_(){
  var bg=document.createElement("div"); bg.id="pl-bg";
  bg.innerHTML='<div id="pl-box" role="dialog" aria-modal="true"><h3>Plantilla de datos</h3><p>Introduce la contraseña para descargarla.</p><input id="pl-pw" type="password" placeholder="Contraseña" autocomplete="off"><div id="pl-err"></div><button id="pl-ok">Descargar</button><button class="g" id="pl-no">Cancelar</button></div>';
  document.body.appendChild(bg);
  var i=bg.querySelector("#pl-pw"),e=bg.querySelector("#pl-err"); i.focus();
  function close(){ bg.remove(); }
  bg.querySelector("#pl-no").onclick=close;
  bg.addEventListener("click",function(ev){ if(ev.target===bg) close(); });
  async function go(){
    e.textContent="";
    try{
      if(!(window.crypto&&crypto.subtle)) throw new Error("nocrypto");
      var buf=await (await fetch(FILE,{cache:"no-store"})).arrayBuffer();
      var u=new Uint8Array(buf), salt=u.slice(0,16), iv=u.slice(16,28), ct=u.slice(28);
      var km=await crypto.subtle.importKey("raw",new TextEncoder().encode(i.value.trim().toLowerCase()),"PBKDF2",false,["deriveKey"]);
      var key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:salt,iterations:200000,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["decrypt"]);
      var plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:iv},key,ct);
      var url=URL.createObjectURL(new Blob([plain],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
      var a=document.createElement("a"); a.href=url; a.download=NAME; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){URL.revokeObjectURL(url);},4000); close();
    }catch(x){ e.textContent = (x&&x.message==="nocrypto") ? "Abre la web con https para descargar." : "Contraseña incorrecta."; }
  }
  bg.querySelector("#pl-ok").onclick=go;
  i.addEventListener("keydown",function(ev){ if(ev.key==="Enter") go(); if(ev.key==="Escape") close(); });
}
document.addEventListener("click",function(ev){
  var t=ev.target.closest&&ev.target.closest("[data-plantilla]"); if(t){ ev.preventDefault(); open_(); }
});
})();
