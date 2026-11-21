/* ═══════════════════════════════════════════════════════════════
   métodoAGP · conexión con la base de datos compartida del taller
   - Páginas del gerente (fichajes, planificador): NUBE.bind(...) + NUBE.start()
     Mantienen los datos locales y los sincronizan con la nube.
   - App del operario: NUBE.client('agp-sb-op') y sus propias llamadas.
   La clave de abajo es la clave PÚBLICA (publishable). La seguridad real
   la dan las reglas por fila de la base de datos.
   ═══════════════════════════════════════════════════════════════ */
(function(){
"use strict";
var URL_="https://rauxafgiklkblnuddcwt.supabase.co",KEY_="sb_publishable_InvC_oz5ks0yjkVLsyRDDw_xd85hokP";
var SDK="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
var FK="agp-fichajes-v1",PK="agp-planificador-demo-v1",SNAP="agp-nube-snap-";
var FASES=["rec","val","apr","pie","esp","pch","cha","pin","mon","ent","arc"];
var INCT=["vac","baja","perm","festivo","retraso","extra"];
var N=window.NUBE={URL:URL_,fotos:{},st:{estado:"off",msg:"",taller:null,email:""}};

/* ── utilidades ── */
function jp(s){try{return JSON.parse(s)}catch(e){return null}}
function lget(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lset(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function ldel(k){try{localStorage.removeItem(k)}catch(e){}}
var UU=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  var b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;
  var h=Array.prototype.map.call(b,function(x){return (x<16?"0":"")+x.toString(16)}).join("");
  return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);
}
N.uuid=uuid;N.isUuid=function(s){return UU.test(String(s))};
N.tok=function(){var a="abcdefghjkmnpqrstuvwxyz23456789",b=new Uint8Array(20),s="";crypto.getRandomValues(b);for(var i=0;i<20;i++)s+=a[b[i]%a.length];return s};
function sj(o){ /* JSON con claves ordenadas: el orden no cambia el resultado */
  if(o===null||typeof o!=="object")return JSON.stringify(o===undefined?null:o);
  if(Array.isArray(o))return "["+o.map(sj).join(",")+"]";
  return "{"+Object.keys(o).filter(function(k){return o[k]!==undefined}).sort().map(function(k){return JSON.stringify(k)+":"+sj(o[k])}).join(",")+"}";
}
function iso(ms){return new Date(ms).toISOString()}
function p2(n){return (n<10?"0":"")+n}
function today(){var d=new Date();return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate())}
function chunks(a,n){var r=[];for(var i=0;i<a.length;i+=n)r.push(a.slice(i,i+n));return r}
function chk(r){if(r&&r.error)throw r.error;return r}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}

/* ── cliente ── */
var CL={},sdkP=null;
function sdk(){
  if(window.supabase&&window.supabase.createClient)return Promise.resolve();
  if(sdkP)return sdkP;
  sdkP=new Promise(function(ok,ko){var s=document.createElement("script");s.src=SDK;s.onload=ok;
    s.onerror=function(){sdkP=null;ko(new Error("No se puede conectar con la nube. Revisa tu conexión a internet."))};document.head.appendChild(s)});
  return sdkP;
}
N.client=function(sk){
  return sdk().then(function(){
    return CL[sk]||(CL[sk]=window.supabase.createClient(URL_,KEY_,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:sk}}));
  });
};
N.msg=function(e){
  var m=(e&&e.message)||String(e||"");
  if(/failed to fetch|networkerror|load failed/i.test(m))return "Sin conexión con la nube";
  if(/invalid login/i.test(m))return "Correo o contraseña incorrectos";
  if(/email not confirmed/i.test(m))return "Falta confirmar el correo";
  if(/rate limit|too many/i.test(m))return "Demasiados intentos. Espera un momento";
  return m;
};

/* ═══════════════ Lado gerente: sincronización ═══════════════ */
var BIND={},SK="agp-sb",C=null,TID=null,running=false,again=false,timer=null,firstDone=false,rt=null,poll=null;

N.bind=function(kind,api){BIND[kind]=api};
function blankF(){return {v:1,emps:[],marks:[],inc:[],jobs:[],ui:{scope:"directa",per:"mes"}}}
function getF(){if(BIND.fich)return BIND.fich.get();var o=jp(lget(FK));return o&&o.emps?(o.jobs=o.jobs||[],o):blankF()}
function putF(o){if(BIND.fich)BIND.fich.put(o);else lset(FK,JSON.stringify(o))}
function persistF(F){if(BIND.fich&&BIND.fich.persist)BIND.fich.persist();else if(!BIND.fich)lset(FK,JSON.stringify(F))}
function getP(){if(BIND.plan)return BIND.plan.get();var o=jp(lget(PK));return o&&o.cards?o:null}
function putP(o){if(BIND.plan)BIND.plan.put(o);else lset(PK,JSON.stringify(o))}
function persistP(P){if(BIND.plan&&BIND.plan.persist)BIND.plan.persist();else if(!BIND.plan)lset(PK,JSON.stringify(P))}
function snapLoad(){return jp(lget(SNAP+TID))||{}}
function snapSave(s){lset(SNAP+TID,JSON.stringify(s))}

/* estado visible (pastilla abajo a la izquierda) */
var badge=null,menu=null;
function css(){
  if(document.getElementById("nb-css"))return;
  var s=document.createElement("style");s.id="nb-css";
  s.textContent=".nb-b{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));z-index:9000;font:600 12.5px/1 Inter,system-ui,sans-serif;background:#14181f;color:#e8ebf1;border:0;border-radius:999px;padding:9px 13px;display:flex;gap:8px;align-items:center;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25)}"+
  ".nb-b i{width:9px;height:9px;border-radius:50%;background:#9aa3b2}.nb-b.ok i{background:#3fbf6b}.nb-b.err i{background:#e5532d}.nb-b.sync i{background:#e0a33a}"+
  ".nb-m{position:fixed;left:max(12px,env(safe-area-inset-left));bottom:56px;z-index:9001;background:#fff;color:#17191d;border:1px solid #d8d5ce;border-radius:12px;padding:8px;display:grid;gap:4px;min-width:220px;box-shadow:0 8px 28px rgba(0,0,0,.2);font:14px Inter,system-ui,sans-serif}"+
  ".nb-m div{padding:6px 10px;color:#6b6e75;font-size:12.5px}.nb-m button{border:0;background:#f0eee9;border-radius:8px;padding:10px 12px;text-align:left;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;color:#17191d}"+
  ".nb-o{position:fixed;inset:0;z-index:9500;background:rgba(20,24,31,.72);display:grid;place-items:center;padding:16px;font-family:Inter,system-ui,sans-serif}"+
  ".nb-c{background:#fbfaf8;color:#17191d;border-radius:18px;padding:22px;width:100%;max-width:380px;display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.4)}"+
  ".nb-c h2{margin:0;font:700 22px/1.1 'Barlow Condensed','Arial Narrow',sans-serif;text-transform:uppercase;letter-spacing:.02em}.nb-c p{margin:0;font-size:14px;color:#55585f}"+
  ".nb-c input{width:100%;min-height:46px;border:1px solid #d8d5ce;border-radius:10px;padding:0 12px;font:16px Inter,system-ui,sans-serif;background:#fff}"+
  ".nb-c button{min-height:48px;border:0;border-radius:10px;background:#e5532d;color:#fff;font:700 16px Inter,system-ui,sans-serif;cursor:pointer}.nb-c button[disabled]{opacity:.6}"+
  ".nb-e{color:#c0321b;font-weight:600;font-size:14px;min-height:18px}";
  document.head.appendChild(s);
}
function paint(){
  css();
  if(!badge){badge=document.createElement("button");badge.type="button";badge.className="nb-b";badge.addEventListener("click",toggleMenu);document.body.appendChild(badge)}
  var s=N.st,t={off:"Sin conexión",conectando:"Conectando…",login:"Sin sesión",sync:"Sincronizando…",ok:"Sincronizado",err:"Error"}[s.estado]||s.estado;
  var cls=s.estado==="ok"?"ok":s.estado==="sync"||s.estado==="conectando"?"sync":"err";
  badge.className="nb-b "+cls;
  badge.innerHTML="<i></i><span>☁ "+esc(s.taller?s.taller.nombre+" · ":"")+esc(s.estado==="err"&&s.msg?s.msg:t)+(s.estado==="ok"&&s.hora?" "+s.hora:"")+"</span>";
}
function toggleMenu(){
  if(menu){menu.remove();menu=null;return}
  menu=document.createElement("div");menu.className="nb-m";
  menu.innerHTML="<div>"+esc(N.st.email||"")+"</div><button data-a=sync>Sincronizar ahora</button><button data-a=out>Cerrar sesión</button>";
  menu.addEventListener("click",function(e){var a=e.target.dataset&&e.target.dataset.a;if(a==="sync"){N.touch(0)}if(a==="out"){N.logout()}menu.remove();menu=null});
  document.body.appendChild(menu);
}
function setSt(estado,msg){N.st.estado=estado;N.st.msg=msg||"";if(estado==="ok"){var d=new Date();N.st.hora=p2(d.getHours())+":"+p2(d.getMinutes())}paint()}

/* pantalla de acceso */
function overlay(html){
  css();var o=document.getElementById("nb-o");if(o)o.remove();
  o=document.createElement("div");o.id="nb-o";o.className="nb-o";o.innerHTML='<form class="nb-c" autocomplete="on">'+html+"</form>";document.body.appendChild(o);return o;
}
function closeOverlay(){var o=document.getElementById("nb-o");if(o)o.remove()}
function showLogin(msg){
  setSt("login");
  var o=overlay('<h2>Entra en tu taller</h2><p>Accede con el correo y la contraseña del gerente. Tus datos quedan guardados en la nube y puedes verlos desde cualquier dispositivo.</p>'+
    '<input id="nb-em" type="email" placeholder="Correo" autocomplete="username" required><input id="nb-pw" type="password" placeholder="Contraseña" autocomplete="current-password" required><div class="nb-e" id="nb-er">'+esc(msg||"")+'</div><button type="submit">Entrar</button>');
  var f=o.querySelector("form"),em=o.querySelector("#nb-em");em.focus();
  f.addEventListener("submit",function(e){e.preventDefault();
    var b=f.querySelector("button"),er=f.querySelector("#nb-er");b.disabled=true;er.textContent="";
    C.auth.signInWithPassword({email:em.value.trim(),password:f.querySelector("#nb-pw").value}).then(function(r){
      chk(r);closeOverlay();return afterLogin(r.data.user)}).catch(function(x){b.disabled=false;er.textContent=N.msg(x)});
  });
}
function askTaller(user){
  var o=overlay('<h2>Crea tu taller</h2><p>Es la primera vez que entras con esta cuenta. Escribe el nombre de tu taller.</p><input id="nb-tn" type="text" placeholder="Nombre del taller" maxlength="120" required><div class="nb-e" id="nb-er"></div><button type="submit">Crear taller</button>');
  var f=o.querySelector("form");f.querySelector("#nb-tn").focus();
  f.addEventListener("submit",function(e){e.preventDefault();var b=f.querySelector("button"),er=f.querySelector("#nb-er");b.disabled=true;er.textContent="";
    C.rpc("crear_taller",{p_nombre:f.querySelector("#nb-tn").value}).then(function(r){chk(r);closeOverlay();return afterLogin(user)}).catch(function(x){b.disabled=false;er.textContent=N.msg(x)})});
}
function afterLogin(user){
  N.st.email=(user&&user.email)||N.st.email;
  return C.from("gerentes").select("taller_id").maybeSingle().then(function(r){
    chk(r);
    if(!r.data){askTaller(user);return null}
    return C.from("talleres").select("id,nombre").eq("id",r.data.taller_id).single().then(function(t){chk(t);TID=t.data.id;N.st.taller=t.data;begin()});
  }).catch(function(e){setSt("err",N.msg(e))});
}
N.start=function(){
  setSt("conectando");
  return N.client(SK).then(function(c){C=c;return c.auth.getSession()}).then(function(r){
    var s=r.data&&r.data.session;
    if(s&&!(s.user&&s.user.is_anonymous))return afterLogin(s.user);
    showLogin();
  }).catch(function(e){setSt("err",N.msg(e))});
};
N.logout=function(){
  stopLive();
  return C.auth.signOut().then(function(){TID=null;N.st.taller=null;N.fotos={};firstDone=false;showLogin()});
};

/* ciclo de sincronización */
function begin(){
  firstDone=false;N.touch(0);
  try{
    if(rt){C.removeChannel(rt);rt=null}
    rt=C.channel("agp-"+TID);
    ["marcas","trabajos","tarjetas","fotos"].forEach(function(t){rt.on("postgres_changes",{event:"*",schema:"public",table:t,filter:"taller_id=eq."+TID},function(){N.touch(900)})});
    rt.subscribe();
  }catch(e){}
  if(poll)clearInterval(poll);
  poll=setInterval(function(){if(!document.hidden)N.touch(0)},45000);
  if(!begin.l){begin.l=1;
    document.addEventListener("visibilitychange",function(){if(!document.hidden&&TID)N.touch(0)});
    window.addEventListener("online",function(){if(TID)N.touch(0)});
  }
}
function stopLive(){if(poll){clearInterval(poll);poll=null}try{if(rt){C.removeChannel(rt);rt=null}}catch(e){}}
N.touch=function(ms){
  if(!TID)return;clearTimeout(timer);
  timer=setTimeout(function(){
    if(running){again=true;return}
    running=true;setSt("sync");
    doSync().then(function(){setSt("ok")}).catch(function(e){
      if(e&&(e.status===401||/jwt|not authenticated/i.test(e.message||""))){showLogin("Tu sesión ha caducado. Entra de nuevo.");return}
      setSt("err",N.msg(e));if(window.console)console.warn("[nube]",e)
    }).then(function(){running=false;if(again){again=false;N.touch(300)}});
  },ms==null?1200:ms);
};

/* ── definición de cada tipo de dato ── */
function prep(F){
  F.emps.forEach(function(e){if(!e.cid)e.cid=uuid();if(!e.tok||e.tok.length<16)e.tok=N.tok()});
  ["marks","jobs","inc"].forEach(function(k){(F[k]||[]).forEach(function(x){if(!N.isUuid(x.id))x.id=uuid()})});
}
function pEmp(e){return sj([e.cid,e.name,e.sec,e.h,e.days,e.from,e.to||null,e.tok])}
function rEmp(e,t){
  var r={id:e.cid,taller_id:t,nombre:e.name,seccion:["chapa","pintura","mecanica","indirecto"].indexOf(e.sec)>-1?e.sec:"indirecto",
    horas_dia:+e.h||8,dias:e.days||[1,2,3,4,5],alta:e.from||today()};
  if(e.to){r.baja=e.to;r.enlace=null}else{r.baja=null;r.enlace=e.tok}
  return r;
}
function sEmp(r){var e={cid:r.id,name:r.nombre,sec:r.seccion,h:+r.horas_dia,days:r.dias||[1,2,3,4,5],from:r.alta,to:r.baja||undefined};if(r.enlace)e.tok=r.enlace;return e}

function pMark(m){return sj([m.id,m.emp,m.ts,m.t,!!m.manual])}
function pJob(j){return sj([j.id,j.emp,j.card,j.st,j.sec,j.s,j.e||null])}
function pInc(i){return sj([i.id,i.emp,i.date,i.type,i.h==null?null:i.h,i.label||null])}
function pCard(c){return sj(c)}

/* mezcla de una lista local con la del servidor (ver notas en el resumen) */
function mix(local,server,snap,idf,proj,inWin,mk,mg){
  var lm={},sm={},out=[],ns={};
  local.forEach(function(l){lm[idf(l)]=l});server.forEach(function(s){sm[idf(s)]=s});
  local.forEach(function(l){
    var id=idf(l),s=sm[id],p=proj(l),was=snap[id];
    if(s){
      if(was!==undefined&&p!==was){out.push(l);ns[id]=was}
      else{var m=mg(l,s);out.push(m);ns[id]=proj(m)}
    }else{
      if(was!==undefined&&inWin(l)){if(p!==was){out.push(l);ns[id]=was}}
      else{out.push(l);if(was!==undefined)ns[id]=was}
    }
  });
  server.forEach(function(s){var id=idf(s);if(lm[id])return;if(snap[id]!==undefined){ns[id]=snap[id];return}var m=mk(s);out.push(m);ns[id]=proj(m)});
  return {list:out,snap:ns};
}

async function paged(build){
  var out=[],from=0,step=1000;
  for(;;){var r=chk(await build().range(from,from+step-1));var d=r.data||[];out=out.concat(d);if(d.length<step)break;from+=step}
  return out;
}

async function pushKind(name,table,keyCol,items,idf,proj,rowf,snap,tid){
  /* items: lista local; sube lo nuevo o cambiado y borra lo eliminado */
  var cur={},up=[];
  items.forEach(function(it){var id=idf(it);cur[id]=1;var r=rowf(it);if(!r)return;if(snap[id]!==proj(it))up.push({it:it,r:r})});
  var del=Object.keys(snap).filter(function(id){return !cur[id]});
  for(var ch of chunks(up,300)){
    chk(await C.from(table).upsert(ch.map(function(x){return x.r}),{onConflict:keyCol}));
    ch.forEach(function(x){snap[idf(x.it)]=proj(x.it)});
  }
  for(var dc of chunks(del,100)){
    var q=C.from(table).delete();
    q=keyCol==="id"?q.in("id",dc):q.eq("taller_id",tid).in("or_num",dc);
    chk(await q);dc.forEach(function(id){delete snap[id]});
  }
}

async function doSync(){
  var tid=TID,snap=snapLoad();["emps","cards","marks","jobs","inc"].forEach(function(k){snap[k]=snap[k]||{}});
  var F=getF(),P=getP();
  prep(F);persistF(F);
  var e2c={};F.emps.forEach(function(e){e2c[e.id]=e.cid});
  var firstSync=!snap.init;

  /* ¿hay datos de ejemplo en este equipo y datos reales en la nube? → manda la nube */
  if(firstSync&&P&&P.seed){
    var cnt=chk(await C.from("tarjetas").select("id",{count:"exact",head:true}));
    if(cnt.count>0){P.cards=[];snap.cards={}}
  }

  /* ── SUBIR ── */
  var act=F.emps.filter(function(e){return !e.to}),baj=F.emps.filter(function(e){return e.to});
  var cur={};F.emps.forEach(function(e){cur[e.cid]=1});
  var upA=act.filter(function(e){return snap.emps[e.cid]!==pEmp(e)}),upB=baj.filter(function(e){return snap.emps[e.cid]!==pEmp(e)});
  for(var ch of chunks(upA,100)){chk(await C.from("operarios").upsert(ch.map(function(e){return rEmp(e,tid)}),{onConflict:"id"}));ch.forEach(function(e){snap.emps[e.cid]=pEmp(e)})}
  for(var e of upB){
    var rb=rEmp(e,tid);rb.user_id=null;   /* una baja corta el acceso del móvil */
    chk(await C.from("operarios").upsert(rb,{onConflict:"id"}));snap.emps[e.cid]=pEmp(e);
  }
  var delE=Object.keys(snap.emps).filter(function(id){return !cur[id]});
  for(var dc of chunks(delE,50)){chk(await C.from("operarios").delete().in("id",dc));dc.forEach(function(id){delete snap.emps[id]})}
  snapSave(snap);

  if(P){
    await pushKind("cards","tarjetas","taller_id,or_num",P.cards,function(c){return String(c.id)},pCard,function(c){
      return {taller_id:tid,or_num:String(c.id),matricula:c.pl||"",vehiculo:c.car||null,color:c.col||null,aseguradora:c.ins||null,prioridad:c.pr||null,
        fase:FASES.indexOf(c.st)>-1?c.st:"rec",fase_desde:c.mv||today(),fecha_salida:c.sal||null,
        horas_chapa:+c.c||0,horas_mecanica:+c.m||0,horas_pintura:+c.p||0,importe:+c.eur||0,datos:{card:c}};
    },snap.cards,tid);
    if(P.seed&&firstSync){delete P.seed;persistP(P)}
    snapSave(snap);
  }
  var tj={};
  (await paged(function(){return C.from("tarjetas").select("id,or_num").eq("taller_id",tid).order("id")})).forEach(function(r){tj[r.or_num]=r.id});
  var ok=function(x){return e2c[x.emp]};
  await pushKind("marks","marcas","id",F.marks.filter(ok),function(m){return m.id},pMark,function(m){
    return {id:m.id,taller_id:tid,operario_id:e2c[m.emp],ts:iso(m.ts),tipo:m.t==="out"?"out":"in",manual:!!m.manual}},snap.marks,tid);
  snapSave(snap);
  await pushKind("jobs","trabajos","id",F.jobs.filter(ok),function(j){return j.id},pJob,function(j){
    var fin=j.e?Math.max(j.e,j.s):null;
    return {id:j.id,taller_id:tid,operario_id:e2c[j.emp],tarjeta_id:tj[String(j.card)]||null,or_num:String(j.card),matricula:j.pl||null,fase:j.st||"cha",
      seccion:j.sec==="pintura"?"pintura":"chapa",inicio:iso(j.s),fin:fin?iso(fin):null}},snap.jobs,tid);
  snapSave(snap);
  await pushKind("inc","incidencias","id",F.inc.filter(function(i){return INCT.indexOf(i.type)>-1&&(i.emp==="ALL"||e2c[i.emp])}),function(i){return i.id},pInc,function(i){
    return {id:i.id,taller_id:tid,operario_id:i.emp==="ALL"?null:e2c[i.emp],tipo:i.type,desde:i.date,hasta:i.date,horas:i.h==null?null:i.h,nota:i.label||null}},snap.inc,tid);
  snapSave(snap);

  /* ── BAJAR ── */
  var since=Date.now()-(firstDone?10:400)*864e5,sinceIso=iso(since);
  var rOp=await paged(function(){return C.from("operarios").select("*").order("id")});
  var rCa=await paged(function(){return C.from("tarjetas").select("id,or_num,fase,datos,matricula,vehiculo,fecha_salida").order("id")});
  var rMa=await paged(function(){return C.from("marcas").select("id,operario_id,ts,tipo,manual").gte("ts",sinceIso).order("ts").order("id")});
  var rTr=await paged(function(){return C.from("trabajos").select("id,operario_id,or_num,matricula,fase,seccion,inicio,fin").gte("inicio",sinceIso).order("inicio").order("id")});
  var rIn=await paged(function(){return C.from("incidencias").select("*").order("id")});
  var rFo=await paged(function(){return C.from("fotos").select("id,ruta,creado,operario_id,tarjetas(or_num)").order("creado").order("id")});
  var sgn=await signFotos(rFo);

  /* se vuelve a leer lo local: el usuario pudo cambiar algo mientras tanto */
  F=getF();P=getP();prep(F);
  var h0F=sj(F),h0P=P?sj(P):"",newP=!P;
  var c2e={},eById={};F.emps.forEach(function(e){c2e[e.cid]=e.id;eById[e.id]=e});
  var all=function(){return true};
  var mE=mix(F.emps,rOp.filter(function(r){return !r.baja||F.emps.some(function(e){return e.cid===r.id})}).map(sEmp),snap.emps,function(e){return e.cid},pEmp,all,
    function(s){return Object.assign({id:s.cid},s)},function(l,s){var m=Object.assign({},l,s);if(!s.tok)m.tok=l.tok;if(s.to===undefined)delete m.to;return m});
  F.emps=mE.list;snap.emps=mE.snap;
  F.emps.forEach(function(e){c2e[e.cid]=e.id});
  var cardOf={};if(P)P.cards.forEach(function(c){cardOf[String(c.id)]=c});
  var win=function(f){return function(x){return f(x)>=since}};
  var mM=mix(F.marks,rMa.filter(function(r){return c2e[r.operario_id]}).map(function(r){return {id:r.id,emp:c2e[r.operario_id],ts:Date.parse(r.ts),t:r.tipo,manual:r.manual||undefined}}),
    snap.marks,function(m){return m.id},pMark,win(function(m){return m.ts}),function(s){return s},function(l,s){return Object.assign({},l,s)});
  F.marks=mM.list;snap.marks=mM.snap;
  var mJ=mix(F.jobs,rTr.filter(function(r){return c2e[r.operario_id]}).map(function(r){var cd=cardOf[r.or_num];
      return {id:r.id,emp:c2e[r.operario_id],card:r.or_num,pl:r.matricula||(cd&&cd.pl)||"",car:(cd&&cd.car)||"",st:r.fase,sec:r.seccion,s:Date.parse(r.inicio),e:r.fin?Date.parse(r.fin):null}}),
    snap.jobs,function(j){return j.id},pJob,win(function(j){return j.s}),function(s){return s},function(l,s){var m=Object.assign({},l,s);if(!s.car)m.car=l.car;return m});
  F.jobs=mJ.list;snap.jobs=mJ.snap;
  var mI=mix(F.inc,rIn.filter(function(r){return !r.operario_id||c2e[r.operario_id]}).map(function(r){
      return {id:r.id,emp:r.operario_id?c2e[r.operario_id]:"ALL",date:r.desde,type:r.tipo,h:r.horas==null?undefined:+r.horas,label:r.nota||undefined}}),
    snap.inc,function(i){return i.id},pInc,all,function(s){return s},function(l,s){return Object.assign({},l,s)});
  F.inc=mI.list;snap.inc=mI.snap;

  if(!P&&rCa.length)P={cards:[],ops:{c:5,m:1,p:4},days:5,hpd:8};
  if(P){
    var srvCards=rCa.map(function(r){var d=r.datos&&r.datos.card;
      return d&&d.id?d:{id:r.or_num,pr:"NORMAL",pl:r.matricula,car:r.vehiculo||"",col:"",ins:"",c:0,m:0,p:0,eur:0,st:r.fase,sal:r.fecha_salida||"",ic:[]}});
    var mC=mix(P.cards,srvCards,snap.cards,function(c){return String(c.id)},pCard,all,function(s){return s},function(l,s){return s});
    P.cards=mC.list;snap.cards=mC.snap;
  }
  snap.init=1;snapSave(snap);

  /* fotos para el planificador (solo en memoria) */
  var fo={};
  rFo.forEach(function(r){var oc=r.tarjetas&&r.tarjetas.or_num;if(!oc)return;
    (fo[oc]=fo[oc]||[]).push({id:r.id,emp:r.operario_id?c2e[r.operario_id]:null,ts:Date.parse(r.creado),d:sgn[r.ruta]||"",ruta:r.ruta,cloud:true})});
  N.fotos=fo;

  var chF=sj(F)!==h0F,chP=!!P&&(newP||sj(P)!==h0P);
  var fsig=Object.keys(fo).sort().map(function(k){return k+":"+fo[k].map(function(x){return x.id+(x.d?"":"!")}).join()}).join("|"),chFo=fsig!==N._fsig;N._fsig=fsig;
  if(chF)putF(F);if(chP)putP(P);
  firstDone=true;
  if(chF||chP||chFo){
    if(BIND.fich&&BIND.fich.refresh)BIND.fich.refresh();
    if(BIND.plan&&BIND.plan.refresh)BIND.plan.refresh();
  }
}

var SIGN={};
async function signFotos(rows){
  var need=rows.map(function(r){return r.ruta}).filter(function(p){return !SIGN[p]||Date.now()-SIGN[p].t>3300000});
  for(var ch of chunks(need,100)){
    try{var r=await C.storage.from("fotos").createSignedUrls(ch,3600);
      (r.data||[]).forEach(function(x){if(x.signedUrl)SIGN[x.path]={u:x.signedUrl,t:Date.now()}})}catch(e){}
  }
  var out={};rows.forEach(function(r){if(SIGN[r.ruta])out[r.ruta]=SIGN[r.ruta].u});return out;
}
N.delFoto=function(id,ruta){
  if(!C)return Promise.resolve();
  return C.storage.from("fotos").remove([ruta]).then(function(){return C.from("fotos").delete().eq("id",id)}).then(function(r){chk(r);N.touch(300)});
};
/* enlace personal del operario */
N.enlaceNuevo=function(){return N.tok()};
})();
