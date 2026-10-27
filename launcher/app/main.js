/* global PalmServiceBridge */
'use strict';
const statusNode = document.getElementById('status');
const drawer = document.getElementById('drawer');
const favoritesNode = document.getElementById('favorites');
const sourcesNode = document.getElementById('sources');
const presets = ['org.jellyfin.webos','com.viki.lg','youtube.leanback.v4','com.crunchyroll.webapp','com.webos.app.discovery'];
let apps = [], favorites = [], editing = false, busy = false, lastFocus = null, clockTimer;
const motion=window.TVMotion ? window.TVMotion.create({root:document}) : null;
function focus(element) { if(!element)return; if(motion)motion.focus(element);else element.focus(); }
let columns=stored('columns',5);
if(!Number.isInteger(columns)||columns<3||columns>6)columns=5;
const metrics = {firstFrameMs:null,readMs:null}; window.launcherMetrics = metrics;
function stored(key,fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
function save(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch (_) { /* Optional cache. */ } }
function call(method,args={}) {
  return new Promise((resolve,reject)=>{
    const bridge = new PalmServiceBridge();
    const timer=setTimeout(()=>{bridge.cancel();reject(Error('Le service ne répond pas'));},6000);
    bridge.onservicecallback=raw=>{
      clearTimeout(timer);
      try { const result=JSON.parse(raw); if(!result.returnValue)throw Error(result.errorText || 'Opération refusée'); resolve(result); }
      catch(error){reject(error);}
    };
    bridge.call('luna://org.local.quicksettings.service/'+method,JSON.stringify(args));
  });
}
function title(app) { return app.title || app.id || ''; }
function changePreview(app) {
  const preview=document.getElementById('source-preview');
  preview.hidden=true;preview.replaceChildren();
  window.dispatchEvent(new CustomEvent('launcherpreviewchange',{detail:{app,container:preview}}));
}
function feature(app) {
  document.getElementById('eyebrow').textContent=app.input?'SOURCE':'APPLICATION';
  document.getElementById('featured').textContent=title(app);
  document.getElementById('description').textContent=app.description || '';
  // The platform integration may render into this container when a real preview is available.
  changePreview(app.input?app:null);
}
function reveal(button) {
  const scroller=drawer.hidden?document.getElementById('browse'):document.getElementById('app-grid');
  if(!scroller.contains(button))return;
  if(motion){motion.reveal(button,scroller,{padding:10});return;}
  const box=button.getBoundingClientRect(),area=scroller.getBoundingClientRect(),padding=10;
  if(box.top<area.top+padding)scroller.scrollTop-=area.top+padding-box.top;
  else if(box.bottom>area.bottom-padding)scroller.scrollTop+=box.bottom-area.bottom+padding;
}
async function launch(args) {
  if(busy)return; busy=true; statusNode.textContent='Ouverture…';
  try { await call('launcherLaunch',args); statusNode.textContent=''; if(args.action==='lgHome')window.close(); }
  catch(error){statusNode.textContent=error.message;}
  finally {busy=false;}
}
function tile(app) {
  const button=document.createElement('button');button.className='tile';button.dataset.id=app.launchPointId;
  button.setAttribute('aria-label',title(app));
  if(/^#[0-9a-f]{6}$/i.test(app.color || ''))button.style.setProperty('--card-color',app.color);
  if(app.icon){const img=document.createElement('img');img.src=app.icon;img.alt='';button.append(img);}
  else {const initial=document.createElement('span');initial.className='initial';initial.textContent=title(app).slice(0,2);button.append(initial);}
  const name=document.createElement('span');name.className='tile-label';name.textContent=title(app);button.append(name);
  button.onfocus=()=>{feature(app);reveal(button);};button.onmouseenter=()=>feature(app);
  button.onclick=()=>launch({launchPointId:app.launchPointId});return button;
}
function render() {
  const previous=document.activeElement.dataset.id;
  const wasCustomize=document.activeElement.id==='customize';
  const favoriteApps=favorites.map(id=>apps.find(app=>app.launchPointId===id)).filter(Boolean);
  favoritesNode.replaceChildren(...favoriteApps.map(app=>{const button=tile(app);button.dataset.focusHeight='150';button.dataset.focusRadius='18';return button;}));
  const customize=document.createElement('button');customize.id='customize';customize.className='tile';
  customize.setAttribute('aria-label','Personnaliser');customize.dataset.focusHeight='150';customize.dataset.focusRadius='18';
  customize.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg><span class="tile-label">Personnaliser</span>';
  const featureCustomize=()=>{document.getElementById('eyebrow').textContent='';document.getElementById('featured').textContent='Personnaliser';document.getElementById('description').textContent='Favoris et disposition';changePreview(null);};
  customize.onfocus=()=>{featureCustomize();reveal(customize);};customize.onmouseenter=featureCustomize;customize.onclick=()=>openDrawer(true);favoritesNode.append(customize);
  const inputs=apps.filter(app=>app.input);
  document.getElementById('source-count').textContent=inputs.length?inputs.length+' sources':'';
  sourcesNode.closest('section').hidden=!inputs.length;
  sourcesNode.replaceChildren(...inputs.map(app=>{
    const button=document.createElement('button');button.className='source';button.dataset.id=app.launchPointId;
    button.innerHTML='<svg viewBox="0 0 32 28" aria-hidden="true"><rect x="2" y="2" width="28" height="18" rx="3"/><path d="M10 25h12M16 20v5"/></svg>';
    const label=document.createElement('span');label.textContent=title(app);
    const match=app.id.match(/hdmi[^0-9]*([0-9]+)/i);
    if(match){const port=document.createElement('small');port.textContent='HDMI '+match[1];label.append(port);}button.append(label);
    button.onfocus=()=>{feature(app);reveal(button);};button.onmouseenter=()=>feature(app);button.onclick=()=>launch({launchPointId:app.launchPointId});return button;
  }));
  const same=[...document.querySelectorAll('main [data-id]')].find(b=>b.dataset.id===previous);
  if(wasCustomize)focus(customize);else if(same)focus(same);else if(document.activeElement===document.body)focus(sourcesNode.querySelector('button') || favoritesNode.querySelector('button'));
}
function populateDrawer() {
  const grid=document.getElementById('app-grid');
  grid.replaceChildren(...apps.filter(app=>!app.input).map(app=>{
    const button=tile(app);
    if(editing){
      button.classList.toggle('chosen',favorites.includes(app.launchPointId));
      button.setAttribute('aria-pressed',String(favorites.includes(app.launchPointId)));
      button.onclick=()=>{
        const index=favorites.indexOf(app.launchPointId);
        if(index>=0)favorites.splice(index,1);
        else if(favorites.length<6)favorites.push(app.launchPointId);
        else {document.getElementById('drawer-help').textContent='Six favoris maximum. Retire une application avant d’en ajouter une.';return;}
        save('favorites',favorites);button.classList.toggle('chosen',favorites.includes(app.launchPointId));
        button.setAttribute('aria-pressed',String(favorites.includes(app.launchPointId)));
      };
    }
    return button;
  }));
}
function openDrawer(edit=false) {
  editing=edit;lastFocus=document.activeElement;
  document.getElementById('columns').hidden=!edit;
  document.getElementById('drawer-title').textContent=edit?'Vos favoris':'Toutes les applications';
  document.getElementById('drawer-help').textContent=edit?'OK pour ajouter ou retirer · Six favoris maximum · Retour pour terminer':'OK pour ouvrir · Retour pour fermer';
  populateDrawer();drawer.hidden=false;document.querySelector('main').setAttribute('inert','');
  focus(document.getElementById('app-grid').querySelector('button') || document.getElementById('drawer-close'));
}
function closeDrawer() {
  drawer.hidden=true;document.querySelector('main').removeAttribute('inert');
  const wasCustomize=lastFocus?.id==='customize';
  render();focus(wasCustomize?document.getElementById('customize'):(lastFocus?.isConnected?lastFocus:(favoritesNode.querySelector('button') || document.getElementById('customize'))));
}
function clock() {
  clearTimeout(clockTimer);const now=new Date();
  document.getElementById('clock').textContent=now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  document.getElementById('date').textContent=now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  if(!document.hidden)clockTimer=setTimeout(clock,60000-now.getSeconds()*1000-now.getMilliseconds());
}
async function refreshApps() {
  const start=performance.now();
  try {
    const result=await call('launcherList');apps=result.apps;metrics.readMs=Math.round(performance.now()-start);
    const saved=stored('favorites',null);
    favorites=Array.isArray(saved)?saved:presets.map(id=>apps.find(app=>app.id===id)?.launchPointId).filter(Boolean);
    favorites=favorites.filter(id=>apps.some(app=>app.launchPointId===id)).slice(0,6);
    save('apps',apps);render();statusNode.textContent='';
  } catch(error){statusNode.textContent=error.message;}
}
document.getElementById('all-apps').onclick=()=>openDrawer();
document.getElementById('settings').onclick=()=>launch({action:'settings'});
function updateColumns() {
  favoritesNode.style.setProperty('--columns',columns);
  document.getElementById('columns').textContent='Colonnes : '+columns;
}
document.getElementById('columns').onclick=()=>{columns=columns===6?3:columns+1;save('columns',columns);updateColumns();};
document.getElementById('lg-home').onclick=()=>launch({action:'lgHome'});
document.getElementById('drawer-close').onclick=closeDrawer;
document.querySelector('footer').addEventListener('focusin',event=>reveal(event.target));
document.addEventListener('keydown',event=>{
  const key=event.keyCode;
  if([37,38,39,40,461,27,405].includes(key))event.preventDefault();
  if(key===461||key===27){if(!drawer.hidden)closeDrawer();else window.close();return;}
  if(key===405){if(drawer.hidden)openDrawer(true);return;}
  if(![37,38,39,40].includes(key))return;
  const controls=[...(drawer.hidden?document.querySelector('main'):drawer).querySelectorAll('button')].filter(b=>b.getClientRects().length);
  const current=document.activeElement,r=current.getBoundingClientRect();
  const x=r.left+r.width/2,y=r.top+r.height/2, horizontal=key===37||key===39;
  const candidates=controls.filter(b=>b!==current).map(button=>{
    const box=button.getBoundingClientRect(),dx=box.left+box.width/2-x,dy=box.top+box.height/2-y;
    const forward=key===37?-dx:key===39?dx:key===38?-dy:dy;
    const cross=Math.abs(horizontal?dy:dx);
    return {button,forward,score:horizontal?forward+cross*4:forward*10000+cross,cross};
  }).filter(c=>c.forward>2&&(!horizontal||c.cross<r.height/2));
  candidates.sort((a,b)=>a.score-b.score);focus(candidates[0]?.button);
});
// handlesRelaunch:true requires explicit activation of an existing webOS card.
document.addEventListener('webOSRelaunch',()=>{
  const platform=window.webOSSystem || window.PalmSystem;
  if(platform)platform.activate();
  if(!drawer.hidden)closeDrawer();clock();refreshApps();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(clockTimer);changePreview(null);}else {clock();refreshApps();}});
window.addEventListener('pagehide',()=>{clearTimeout(clockTimer);changePreview(null);});
updateColumns();apps=stored('apps',[]);favorites=stored('favorites',[]);render();
clock();refreshApps();requestAnimationFrame(()=>{metrics.firstFrameMs=Math.round(performance.now());});
