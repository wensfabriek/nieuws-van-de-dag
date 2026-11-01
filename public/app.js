(function(){
let DATA={items:[],videos:[],fetched:0};

/* ---------- configuration (kept per device) ---------- */
const DEFAULT_CFG={
  sections:[
    {key:"landelijk",name:"Landelijk nieuws",tab:"Landelijk",type:"news",visible:true},
    {key:"limburg",name:"Limburgs nieuws",tab:"Limburgs",type:"news",visible:true,midden:true},
    {key:"weert",name:"Weerter nieuws",tab:"Weerter",type:"news",visible:true},
    {key:"uit",name:"Uittips",tab:"Uittips",type:"uit",visible:true},
    {key:"sport",name:"Sport",tab:"Sport",type:"sport",visible:true},
    {key:"economie",name:"Economie",tab:"Economie",type:"news",visible:true}
  ],
  sources:[
    {id:"nu",name:"NU.nl",site:"https://www.nu.nl",section:"landelijk",on:true,actueel:true,color:"#B91C1C"},
    {id:"limburger",name:"De Limburger",site:"https://www.limburger.nl",section:"limburg",on:true,actueel:true,color:"#1D4ED8"},
    {id:"l1",name:"L1 Nieuws",site:"https://www.l1.nl",section:"limburg",on:true,actueel:true,color:"#0369A1"},
    {id:"wdg",name:"Weert De Gekste",site:"https://www.weertdegekste.nl",section:"weert",on:true,actueel:true,color:"#0F766E"},
    {id:"nw24",name:"Nederweert24",site:"https://www.nederweert24.nl",section:"weert",on:true,actueel:true,color:"#4D7C0F"},
    {id:"gastvrij",name:"Gastvrij Weert",site:"https://gastvrijweert.nl/activiteiten/",section:"uit",on:true,actueel:false,color:"#7C3AED"},
    {id:"nu-sport",name:"NU.nl Sport",site:"https://www.nu.nl/sport",section:"sport",on:true,actueel:false,color:"#B91C1C"},
    {id:"limburger-sport",name:"De Limburger Sport",site:"https://www.limburger.nl/sport",section:"sport",on:true,actueel:false,color:"#1D4ED8"},
    {id:"yt-espn",name:"ESPN Nederland",site:"https://www.youtube.com/@ESPNNL",section:"sport",on:true,actueel:false,color:"#C81E1E",video:true},
    {id:"yt-lfc",name:"Liverpool FC",site:"https://www.youtube.com/@LiverpoolFC",section:"sport",on:true,actueel:false,color:"#9F1239",video:true},
    {id:"yt-laliga",name:"LaLiga",site:"https://www.youtube.com/@LaLiga",section:"sport",on:true,actueel:false,color:"#EA580C",video:true},
    {id:"yt-fcb",name:"FC Barcelona",site:"https://www.youtube.com/@fcbarcelona",section:"sport",on:true,actueel:false,color:"#1E3A8A",video:true},
    {id:"nu-eco",name:"NU.nl Economie",site:"https://www.nu.nl/economie",section:"economie",on:true,actueel:false,color:"#B91C1C"},
    {id:"limburger-eco",name:"De Limburger Economie",site:"https://www.limburger.nl",section:"economie",on:true,actueel:false,color:"#1D4ED8"}
  ],
  clubs:["PSV","Ajax","Feyenoord","VVV","Fortuna","MVV","Roda","Liverpool","Barcelona"]
};
const PALETTE=["#9D174D","#C2410C","#0E7490","#6D28D9","#15803D","#B45309","#0F766E"];
const HOME_N=12, ACTUEEL_N=12, MAX_N=100, HOURS=48, UIT_DAYS=7;
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const clone=o=>JSON.parse(JSON.stringify(o));
let cfg=store.get("kiosk.cfg.v4",null)||clone(DEFAULT_CFG);
function saveCfg(){store.set("kiosk.cfg.v4",cfg)}
const readNow=new Set(store.get("kiosk.read",[]));
let readAtLoad=new Set(readNow);

const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const srcById=id=>cfg.sources.find(s=>s.id===id);
const secByKey=k=>cfg.sections.find(s=>s.key===k);
let ALL=[],byId={};
function setData(d){DATA=d;DATA.videos=DATA.videos||[];ALL=DATA.items.concat(DATA.videos);byId=Object.fromEntries(ALL.map(i=>[i.id,i]))}
function markRead(id){if(readNow.has(id))return;readNow.add(id);store.set("kiosk.read",[...readNow].slice(-2000))}
function live(i){const s=srcById(i.src);return s&&s.on&&secByKey(s.section)}
function fresh(i){return i.pub>=Date.now()-HOURS*3600e3}

/* ---------- selection ---------- */
function clubRe(){const c=cfg.clubs.filter(Boolean).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));return c.length?new RegExp("(^|[^\\p{L}])("+c.join("|")+")(?![\\p{L}])","iu"):null}
function isFootball(i){return /voetbal/i.test(i.cat||"")||/voetbal|eredivisie|keuken kampioen|champions league/i.test(i.title)}
function sectionItems(key){
  const sec=secByKey(key);if(!sec)return[];
  const list=DATA.items.filter(i=>live(i)&&srcById(i.src).section===key);
  if(sec.type==="uit"){
    const t0=new Date();t0.setHours(0,0,0,0);const from=t0.getTime()/1000,to=from+UIT_DAYS*86400;
    return list.filter(i=>i.start>=from&&i.start<to).sort((a,b)=>a.start-b.start||String(a.time).localeCompare(b.time)).slice(0,MAX_N);
  }
  let l=list.filter(i=>!i.start&&fresh(i));
  if(sec.type==="sport"){const re=clubRe();l=l.filter(i=>!isFootball(i)||(re&&re.test(i.title+" "+i.intro)))}
  l.sort(sec.midden?(a,b)=>(b.midden?1:0)-(a.midden?1:0)||b.pub-a.pub:(a,b)=>b.pub-a.pub);
  return l.slice(0,MAX_N);
}
function sectionVideos(key){
  const re=clubRe();if(!re)return[];
  return DATA.videos.filter(v=>live(v)&&srcById(v.src).section===key&&re.test(v.title)).sort((a,b)=>b.pub-a.pub).slice(0,30);
}
let actueelIds=null;
function actueel(){
  if(actueelIds)return actueelIds.map(id=>byId[id]).filter(i=>i&&live(i));
  const pool=DATA.items.filter(i=>live(i)&&!i.start&&srcById(i.src).actueel&&fresh(i)).sort((a,b)=>b.pub-a.pub);
  const pick=pool.filter(i=>!readAtLoad.has(i.id)).slice(0,ACTUEEL_N);
  if(pick.length<ACTUEEL_N)pick.push(...pool.filter(i=>readAtLoad.has(i.id)).slice(0,ACTUEEL_N-pick.length));
  pick.sort((a,b)=>b.pub-a.pub);actueelIds=pick.map(i=>i.id);return pick;
}

/* ---------- rendering helpers ---------- */
const dayFmt=new Intl.DateTimeFormat("nl-NL",{weekday:"short",day:"numeric",month:"short"});
const timeFmt=new Intl.DateTimeFormat("nl-NL",{hour:"2-digit",minute:"2-digit"});
const isToday=d=>d.toDateString()===new Date().toDateString();
function stamp(i){
  if(i.start){const d=new Date(i.start*1000);return (isToday(d)?"vandaag":dayFmt.format(d))+(i.time?" · "+i.time:"")}
  const d=new Date(i.pub),mins=Math.round((Date.now()-i.pub)/60000);
  if(mins>=0&&mins<60)return mins+" min geleden";
  return (isToday(d)?"vandaag":dayFmt.format(d))+" · "+timeFmt.format(d);
}
function meta(i,showTime){
  const s=srcById(i.src);const t=i.start||showTime;
  const themes=i.start&&i.themes?i.themes.slice(0,2).map(t=>`<span class="pill">${esc(t)}</span>`).join(""):"";
  return `<div class="meta"><span class="src"><span class="dot" style="background:${s.color}"></span>${esc(i.org||s.name)}</span>${t?`<span>${esc(stamp(i))}</span>`:""}${themes}${i.premium?'<span class="pill plus">Plus</span>':""}</div>`;
}
function pic(i,cls){const s=srcById(i.src);return i.img?`<div class="${cls}" style="background-image:url('${i.img}')"></div>`:`<div class="${cls}" style="background:linear-gradient(135deg,${s.color},var(--ink))">${esc(i.cat||s.name)}</div>`}
function card(i,o){o=o||{};return `<button class="item${o.lead?" lead":""}${readNow.has(i.id)?" read":""}" data-open="${esc(i.id)}">${pic(i,"thumb")}<div class="txt"><h3>${esc(i.title)}</h3>${meta(i,o.time)}</div></button>`}
function rail(key){
  const v=sectionVideos(key);
  if(!v.length)return `<div class="rail-empty">${DATA.videos.length?"Geen samenvattingen van je clubs in de afgelopen dagen.":"Samenvattingen verschijnen hier zodra YouTube als bron bereikbaar is."} Je clubs stel je in onder Instellingen › Voetbal.</div>`;
  return `<div class="rail" role="list">${v.map(x=>`<a class="vid" role="listitem" href="${esc(x.link)}" rel="noopener"><div class="pic" style="${x.img?`background-image:url('${x.img}')`:""}"></div><div class="t"><h4>${esc(x.title)}</h4><div class="meta"><span class="src"><span class="dot" style="background:${srcById(x.src).color}"></span>${esc(srcById(x.src).name)}</span><span>${esc(stamp(x))}</span></div></div></a>`).join("")}</div>`;
}
const chevron='<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
const visibleSections=()=>cfg.sections.filter(s=>s.visible);
function moreLabel(s,n){return s.type==="uit"?`Alle uittips komende ${UIT_DAYS} dagen (${n})`:`Alles uit ${s.name} (${n})`}

/* ---------- navigation state ---------- */
let current="";                 // current route
const scrollMemo={};            // scroll position per list route
let ctx=null;                   // article swipe context {origin,list,entry,idx,pushed}
let listOnScreen=[];            // article ids in the order they appear on the current list page
let settingsTab=store.get("kiosk.setTab","secties");

function chrome(mode,title){
  const date=new Date().toLocaleDateString("nl-NL",innerWidth<480?{weekday:"short",day:"numeric",month:"short"}:{weekday:"long",day:"numeric",month:"long"});
  $("mast").innerHTML=`<button class="logo" id="logo" aria-label="Nieuws van de Dag, naar de voorpagina"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="#FFFFFF"/><circle cx="16" cy="15" r="6.5" fill="#F26B1D"/><path d="M16 4.5v2.5M7.5 8l1.8 1.8M24.5 8l-1.8 1.8M4.5 15H7M25 15h2.5" stroke="#F26B1D" stroke-width="2" stroke-linecap="round"/><rect x="1" y="17" width="30" height="14" rx="0" fill="#FFFFFF"/><path d="M7 21.5h18M7 25.5h12" stroke="#3A6B9C" stroke-width="2.2" stroke-linecap="round"/><rect x="1" y="1" width="30" height="30" rx="8" fill="none" stroke="#FFFFFF" stroke-width="2"/></svg><span>Nieuws <b>van de</b> Dag</span></button><div class="right">${esc(mode==="home"?date:title)}</div>`;
  const showTabs=mode==="home"||mode==="section";
  $("tabs").hidden=!showTabs;
  if(showTabs)$("tabs").innerHTML=[{key:"actueel",tab:"Actueel"},...visibleSections()].map(s=>`<button class="tab" data-tab="${esc(s.key)}" aria-current="${mode==="section"&&current==="s-"+s.key}">${esc(s.tab||s.name)}</button>`).join("");
  $("navHome").toggleAttribute("aria-current",mode==="home");if(mode==="home")$("navHome").setAttribute("aria-current","page");
  $("navSet").toggleAttribute("aria-current",mode==="settings");if(mode==="settings")$("navSet").setAttribute("aria-current","page");
  $("navBack").disabled=mode==="home";
}
function homeView(){
  chrome("home");listOnScreen=[];
  const a=actueel();a.forEach(i=>listOnScreen.push(i.id));
  let h=`<div class="sec-h" id="sec-actueel"><h2>Actueel</h2></div>`;
  h+=a.length?a.map((i,n)=>card(i,{lead:n===0})).join(""):`<div class="empty">Geen actuele berichten van de afgelopen ${HOURS} uur.</div>`;
  for(const s of visibleSections()){
    const list=sectionItems(s.key);
    h+=`<div class="sec-h" id="sec-${esc(s.key)}"><h2>${esc(s.name)}</h2></div>`;
    if(s.type==="sport")h+=rail(s.key);
    if(!list.length){h+=`<div class="empty">Geen berichten van de afgelopen ${s.type==="uit"?UIT_DAYS+" dagen":HOURS+" uur"}.</div>`;continue}
    const top=list.slice(0,HOME_N);top.forEach(i=>{if(!listOnScreen.includes(i.id))listOnScreen.push(i.id)});
    h+=top.map(i=>card(i)).join("");
    h+=`<button class="more" data-go="s-${esc(s.key)}">${esc(moreLabel(s,list.length))} ${chevron}</button>`;
  }
  const f=new Date(DATA.fetched);
  h+=`<p class="foot">Bijgewerkt ${isToday(f)?"vandaag":esc(dayFmt.format(f))} om ${esc(timeFmt.format(f))}</p>`;
  $("view").innerHTML=h;
}
function sectionView(key){
  const s=secByKey(key);if(!s)return homeView();
  chrome("section",s.name);
  const list=sectionItems(key);listOnScreen=list.map(i=>i.id);
  let h=`<div class="sec-h"><h2>${esc(s.name)}</h2><span class="n">${s.type==="uit"?`komende ${UIT_DAYS} dagen`:`afgelopen ${HOURS} uur`}</span></div>`;
  if(s.type==="sport")h+=rail(key);
  let last="";
  list.forEach(i=>{
    let g="";
    if(s.type==="uit"){const d=new Date(i.start*1000);g=isToday(d)?"Vandaag":d.toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long"})}
    else if(s.midden)g=i.midden?"Midden-Limburg":"Rest van Limburg";
    if(g&&g!==last){h+=`<div class="sub-h">${esc(g)}</div>`;last=g}
    h+=card(i,{time:true});
  });
  if(!list.length)h+=`<div class="empty">Nog geen berichten.</div>`;
  $("view").innerHTML=h;
}
function articleView(id,anim){
  const i=byId[id];if(!i||!srcById(i.src))return homeView();
  markRead(id);
  const s=srcById(i.src);const sec=secByKey(s.section);
  chrome("article",sec?sec.name:"");
  const blocks=i.full||[];
  const body=blocks.map(p=>p.startsWith("## ")?`<h2>${esc(p.slice(3))}</h2>`:`<p>${esc(p)}</p>`).join("");
  const note=blocks.length?"":(i.premium?`<div class="note">Dit is een Plus-artikel. Het hele stuk lees je op ${esc(s.name)} met je eigen abonnement.</div>`:i.start?"":`<div class="note">${esc(s.name)} deelt alleen de intro. Het volledige artikel lees je op hun site.</div>`);
  const facts=i.start?`<div class="row">${(i.themes||[]).map(t=>`<span class="pill">${esc(t)}</span>`).join("")}${i.price?`<span class="pill">Entree: ${esc(i.price)}</span>`:""}</div>`:"";
  const nxt=ctx&&ctx.list[ctx.idx+1]?byId[ctx.list[ctx.idx+1]]:null;
  $("view").innerHTML=`<article class="art${anim?" swipe-"+anim:""}" id="art">${pic(i,"hero")}<div class="in gutter">${meta(i,true)}<h1>${esc(i.title)}</h1>${facts}
    ${i.intro?`<p class="lede">${esc(i.intro)}</p>`:""}${body?`<div class="body">${body}</div>`:""}${note}
    <div class="row"><a class="btn${blocks.length?" ghost":""}" href="${esc(i.link)}" rel="noopener">${blocks.length?"Origineel bekijken op ":"Lees verder op "}${esc(i.src==="gastvrij"?"Gastvrij Weert":s.name)}</a></div>
    ${nxt?`<button class="nextbar" id="nextBtn"><div><div class="lbl">Volgend artikel</div><div class="tt">${esc(nxt.title)}</div></div>${chevron}</button>`:""}
  </div></article>`;
}

/* ---------- settings ---------- */
const up='<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',down='<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
function sw(id,attr,checked,label){return `<label class="tog">${label}<span class="switch"><input type="checkbox" id="${id}" ${attr} ${checked?"checked":""}><span></span></span></label>`}
function settingsView(){
  chrome("settings","Instellingen");
  const tabs=[["secties","Secties"],["bronnen","Bronnen"],["voetbal","Voetbal"],["overig","Overig"]];
  let h=`<div class="seg" role="group" aria-label="Onderdelen">${tabs.map(([k,n])=>`<button data-settab="${k}" aria-pressed="${settingsTab===k}">${n}</button>`).join("")}</div>`;
  const count=id=>ALL.filter(i=>i.src===id).length;
  if(settingsTab==="secties"){
    h+=`<div class="card"><h2>Secties en tabs</h2><p>Pas de namen en de volgorde aan. De volgorde geldt voor de tabs bovenin en voor de voorpagina.</p>`;
    cfg.sections.forEach((s,n)=>{
      const srcs=cfg.sources.filter(x=>x.section===s.key);
      h+=`<div class="sect"><div class="top"><div class="names">
        <label class="f" for="sn-${s.key}">Naam<input type="text" id="sn-${s.key}" data-secname="${s.key}" value="${esc(s.name)}"></label>
        <label class="f" for="st-${s.key}">Tabnaam<input type="text" id="st-${s.key}" data-sectab="${s.key}" value="${esc(s.tab||"")}" placeholder="${esc(s.name)}"></label></div>
        <div class="order"><button class="icon" data-move="${s.key}" data-dir="-1" aria-label="${esc(s.name)} omhoog" ${n===0?"disabled":""}>${up}</button><button class="icon" data-move="${s.key}" data-dir="1" aria-label="${esc(s.name)} omlaag" ${n===cfg.sections.length-1?"disabled":""}>${down}</button></div></div>
        <div class="row" style="justify-content:space-between">${sw("sv-"+s.key,`data-secvis="${s.key}"`,s.visible,"Tonen")}<span class="hint">${{news:"Nieuws",sport:"Sport met samenvattingen",uit:"Uittips"}[s.type]||""}</span></div>
        <div class="chips">${srcs.length?srcs.map(x=>`<span class="chip${x.on?"":" off"}"><span class="dot" style="background:${x.color}"></span>${esc(x.name)}</span>`).join(""):'<span class="hint">Nog geen bronnen in deze sectie. Koppel ze onder Bronnen.</span>'}</div>
        ${s.type==="uit"?"":`<button class="link" data-delsec="${s.key}">Sectie verwijderen</button>`}</div>`;
    });
    h+=`</div><div class="card"><h2>Sectie toevoegen</h2><form id="addSec">
      <label class="f" for="nsName">Naam<input type="text" id="nsName" required placeholder="Bijvoorbeeld Tech"></label>
      <label class="f" for="nsType">Soort<select id="nsType"><option value="news">Nieuws</option><option value="sport">Sport met samenvattingen</option></select></label>
      <button class="btn" type="submit">Sectie toevoegen</button></form></div>`;
  }
  if(settingsTab==="bronnen"){
    const opts=sel=>cfg.sections.map(s=>`<option value="${s.key}" ${s.key===sel?"selected":""}>${esc(s.name)}</option>`).join("");
    const row=x=>`<div class="srcrow"><span class="dot" style="background:${x.color};width:12px;height:12px"></span>
      <div class="info"><span class="name">${esc(x.name)}</span><span class="sub">${count(x.id)?count(x.id)+(x.video?" video's":" berichten"):"nog niets opgehaald"}${x.video?" · YouTube":""}</span>
      <select id="ss-${x.id}" data-srcsec="${x.id}" aria-label="Sectie voor ${esc(x.name)}">${opts(x.section)}${secByKey(x.section)?"":`<option selected value="">Geen sectie</option>`}</select>
      ${x.custom?`<button class="link" data-delsrc="${x.id}">Verwijderen</button>`:""}</div>
      <div class="ctl">${sw("on-"+x.id,`data-srcon="${x.id}"`,x.on,"Aan")}${x.video||(secByKey(x.section)||{}).type==="uit"?"":sw("ac-"+x.id,`data-srcac="${x.id}"`,x.actueel,"In Actueel")}</div></div>`;
    h+=`<div class="card"><h2>Alle bronnen</h2><p>Per sectie gegroepeerd. Kies waar een bron hoort en of hij ook in Actueel verschijnt.</p>`;
    cfg.sections.forEach(s=>{const l=cfg.sources.filter(x=>x.section===s.key);if(l.length)h+=`<h3>${esc(s.name)}</h3><div>${l.map(row).join("")}</div>`});
    const orphan=cfg.sources.filter(x=>!secByKey(x.section));if(orphan.length)h+=`<h3>Zonder sectie</h3><div>${orphan.map(row).join("")}</div>`;
    h+=`</div><div class="card"><h2>Bron toevoegen</h2><form id="addSrc">
      <label class="f" for="fName">Naam<input type="text" id="fName" required placeholder="Bijvoorbeeld 1Limburg"></label>
      <label class="f" for="fSite">Website of RSS-feed<input type="url" id="fSite" required placeholder="https://"></label>
      <label class="f" for="fSec">Sectie<select id="fSec">${opts(cfg.sections[0]&&cfg.sections[0].key)}</select></label>
      <button class="btn" type="submit">Bron toevoegen</button><p class="hint">Nieuwe bronnen krijgen berichten bij de volgende keer ophalen.</p></form></div>
      <div class="card"><h2>Bronnen met inlog</h2><p>Inloggen met je eigen abonnement, zoals bij De Limburger, komt pas in de echte app-versie, met veilige opslag van je gegevens. Plus-artikelen open je tot die tijd op de site zelf.</p></div>`;
  }
  if(settingsTab==="voetbal"){
    h+=`<div class="card"><h2>Mijn clubs</h2><p>In de sectie Sport zie je alleen samenvattingen en voetbalberichten van deze clubs. Andere sporten blijven zichtbaar.</p>
      <div class="chips">${cfg.clubs.map((c,n)=>`<span class="chip">${esc(c)}<button data-delclub="${n}" aria-label="${esc(c)} verwijderen">×</button></span>`).join("")||'<span class="hint">Nog geen clubs.</span>'}</div>
      <form id="addClub" class="row"><input type="text" id="clubName" placeholder="Club toevoegen, bijv. AZ" style="flex:1" aria-label="Club toevoegen"><button class="btn small" type="submit">Toevoegen</button></form></div>
      <div class="card"><h2>Videokanalen</h2><p>Gratis officiële samenvattingen op YouTube. ESPN Nederland heeft de Eredivisie en de Keuken Kampioen Divisie, dus ook VVV, MVV, Roda en Fortuna.</p>
      <div>${cfg.sources.filter(x=>x.video).map(x=>`<div class="srcrow"><span class="dot" style="background:${x.color};width:12px;height:12px"></span><div class="info"><span class="name">${esc(x.name)}</span><span class="sub">${esc(x.site.replace("https://www.",""))}</span></div><div class="ctl">${sw("vo-"+x.id,`data-srcon="${x.id}"`,x.on,"Aan")}</div></div>`).join("")}</div></div>`;
  }
  if(settingsTab==="overig"){
    h+=`<div class="card"><h2>Gelezen artikelen</h2><p>Geopende artikelen worden lichter getoond en verdwijnen bij je volgende bezoek uit Actueel.</p><div class="row"><button class="btn ghost" id="clearRead">Gelezen-markeringen wissen</button></div></div>
      <div class="card"><h2>Standaardinstellingen</h2><p>Zet secties, bronnen en clubs terug naar de beginsituatie.</p><div class="row"><button class="btn ghost" id="resetAll">Alles herstellen</button></div></div>
      <p class="hint">Instellingen en gelezen artikelen worden op dit apparaat bewaard.</p>`;
  }
  $("view").innerHTML=h;
}

/* ---------- routing ---------- */
function route(anim){
  const h=location.hash.slice(1);
  if(current&&!current.startsWith("a-"))scrollMemo[current]=window.scrollY;
  const prev=current;current=h;
  if(h.startsWith("a-")){
    if(!ctx||ctx.list[ctx.idx]!==h.slice(2)){
      const fromList=listOnScreen.length?listOnScreen:(homeView(),listOnScreen);
      const i=Math.max(0,fromList.indexOf(h.slice(2)));
      ctx={origin:prev&&!prev.startsWith("a-")?prev:"",list:fromList.indexOf(h.slice(2))>=0?fromList.slice():[h.slice(2)],entry:i,idx:i,pushed:false};
      if(ctx.list.length===1)ctx.entry=ctx.idx=0;
    }
    articleView(h.slice(2),anim);window.scrollTo(0,0);return;
  }
  ctx=null;
  if(h.startsWith("s-"))sectionView(h.slice(2));
  else if(h==="instellingen")settingsView();
  else homeView();
  window.scrollTo(0,scrollMemo[h]||0);
}
function openArticle(id){
  const i=listOnScreen.indexOf(id);
  ctx={origin:current,list:i>=0?listOnScreen.slice():[id],entry:Math.max(0,i),idx:Math.max(0,i),pushed:true};
  scrollMemo[current]=window.scrollY;
  location.hash="a-"+id;
}
function goList(r,fresh){if(fresh)delete scrollMemo[r];location.hash=r}
function goBack(){
  if(ctx){const c=ctx;if(c.pushed){history.back()}else{location.hash=c.origin}return}
  if(sessionNav>0){sessionNav--;history.back()}else location.hash="";
}
let sessionNav=0;
function step(dir){
  if(!ctx)return;
  if(dir>0){if(ctx.idx>=ctx.list.length-1){toast("Dit was het laatste artikel");return}ctx.idx++}
  else{if(ctx.idx<=ctx.entry){goBack();return}ctx.idx--}
  current="a-"+ctx.list[ctx.idx];
  history.replaceState(null,"","#"+current);
  articleView(ctx.list[ctx.idx],dir>0?"r":"l");window.scrollTo(0,0);
}
window.addEventListener("hashchange",()=>route());

/* swipe on article pages: finger to the right = next article, to the left = previous / back */
let tx=null,ty=null;
document.addEventListener("touchstart",e=>{if(!current.startsWith("a-")||e.touches.length>1)return;tx=e.touches[0].clientX;ty=e.touches[0].clientY},{passive:true});
document.addEventListener("touchend",e=>{
  if(tx===null)return;const t=e.changedTouches[0];const dx=t.clientX-tx,dy=t.clientY-ty;tx=null;
  if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.8)step(dx>0?1:-1);
},{passive:true});
document.addEventListener("keydown",e=>{if(!current.startsWith("a-")||e.target.matches("input,select,textarea"))return;if(e.key==="ArrowRight")step(1);if(e.key==="ArrowLeft")step(-1)});

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  const t=e.target;
  const o=t.closest("[data-open]");if(o){openArticle(o.dataset.open);return}
  const g=t.closest("[data-go]");if(g){sessionNav++;goList(g.dataset.go,true);return}
  const tb=t.closest("[data-tab]");
  if(tb){const k=tb.dataset.tab;
    if(current===""){const el=$("sec-"+k);if(el)el.scrollIntoView({behavior:"smooth"});return}
    if(k==="actueel"){location.hash="";return}
    delete scrollMemo["s-"+k];history.replaceState(null,"","#s-"+k);route();return}
  if(t.closest("#nextBtn")){step(1);return}
  if(t.closest("#logo")){if(current===""){window.scrollTo({top:0,behavior:"smooth"})}else{ctx=null;delete scrollMemo[""];location.hash=""}return}
  const st=t.closest("[data-settab]");if(st){settingsTab=st.dataset.settab;store.set("kiosk.setTab",settingsTab);settingsView();return}
  const mv=t.closest("[data-move]");if(mv){const i=cfg.sections.findIndex(s=>s.key===mv.dataset.move),j=i+ +mv.dataset.dir;if(j<0||j>=cfg.sections.length)return;const [x]=cfg.sections.splice(i,1);cfg.sections.splice(j,0,x);saveCfg();settingsView();return}
  const ds=t.closest("[data-delsec]");if(ds){const s=secByKey(ds.dataset.delsec);if(ds.dataset.confirm!=="1"){ds.dataset.confirm="1";ds.textContent="Tik nog een keer om "+s.name+" te verwijderen";return}cfg.sections=cfg.sections.filter(x=>x!==s);saveCfg();settingsView();toast(s.name+" verwijderd");return}
  const dsr=t.closest("[data-delsrc]");if(dsr){cfg.sources=cfg.sources.filter(x=>x.id!==dsr.dataset.delsrc);saveCfg();settingsView();toast("Bron verwijderd");return}
  const dc=t.closest("[data-delclub]");if(dc){const c=cfg.clubs.splice(+dc.dataset.delclub,1)[0];saveCfg();settingsView();toast(c+" verwijderd");return}
  if(t.id==="clearRead"){readNow.clear();store.set("kiosk.read",[]);toast("Gelezen-markeringen gewist");return}
  if(t.id==="resetAll"){if(t.dataset.confirm!=="1"){t.dataset.confirm="1";t.textContent="Tik nog een keer om te herstellen";return}cfg=clone(DEFAULT_CFG);saveCfg();actueelIds=null;settingsView();toast("Standaardinstellingen hersteld");return}
});
$("navHome").addEventListener("click",()=>{ctx=null;delete scrollMemo[""];if(current==="")window.scrollTo({top:0,behavior:"smooth"});else location.hash=""});
$("navSet").addEventListener("click",()=>{if(current!=="instellingen"){sessionNav++;location.hash="instellingen"}});
$("navBack").addEventListener("click",goBack);
document.addEventListener("change",e=>{
  const t=e.target,d=t.dataset;
  if(d.secname!==undefined){const s=secByKey(d.secname);s.name=t.value.trim()||s.name;saveCfg();chrome("settings","Instellingen");toast("Naam opgeslagen")}
  if(d.sectab!==undefined){secByKey(d.sectab).tab=t.value.trim();saveCfg();toast("Tabnaam opgeslagen")}
  if(d.secvis){secByKey(d.secvis).visible=t.checked;saveCfg()}
  if(d.srcon){srcById(d.srcon).on=t.checked;saveCfg();actueelIds=null}
  if(d.srcac){srcById(d.srcac).actueel=t.checked;saveCfg();actueelIds=null}
  if(d.srcsec){srcById(d.srcsec).section=t.value;saveCfg();actueelIds=null;settingsView()}
});
document.addEventListener("submit",e=>{
  e.preventDefault();const id=e.target.id;
  if(id==="addSec"){const name=$("nsName").value.trim();if(!name)return;const key="c"+Date.now().toString(36);cfg.sections.push({key,name,tab:"",type:$("nsType").value,visible:true});saveCfg();settingsView();toast(name+" toegevoegd")}
  if(id==="addSrc"){const name=$("fName").value.trim();cfg.sources.push({id:"s"+Date.now().toString(36),name,site:$("fSite").value.trim(),section:$("fSec").value,on:true,actueel:true,custom:true,color:PALETTE[cfg.sources.length%PALETTE.length]});saveCfg();settingsView();toast(name+" toegevoegd")}
  if(id==="addClub"){const c=$("clubName").value.trim();if(!c)return;if(!cfg.clubs.some(x=>x.toLowerCase()===c.toLowerCase()))cfg.clubs.push(c);saveCfg();settingsView();toast(c+" toegevoegd")}
});
function toast(msg){document.querySelectorAll(".toast").forEach(x=>x.remove());const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),1800)}
/* ---------- data loading ---------- */
let loadedAt=0;
async function load(isReturn){
  try{
    const r=await fetch("data.json?t="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error(r.status);
    const d=await r.json();
    if(isReturn&&d.fetched===DATA.fetched){loadedAt=Date.now();return}
    setData(d);loadedAt=Date.now();
    if(isReturn){readAtLoad=new Set(readNow);actueelIds=null}
    if(!current.startsWith("a-")&&current!=="instellingen"){const y=window.scrollY;route();if(isReturn)window.scrollTo(0,y)}
    else if(!isReturn)route();
  }catch(e){
    if(!DATA.items.length)$("view").innerHTML=`<div class="empty">Het nieuws kon niet worden geladen. Controleer je verbinding en open de app opnieuw.</div>`;
  }
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&Date.now()-loadedAt>5*60e3)load(true)});
$("view").innerHTML=`<div class="empty">Nieuws laden…</div>`;
load(false);
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
