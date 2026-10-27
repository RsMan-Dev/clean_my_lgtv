/* global PalmServiceBridge, SaveQueue */
'use strict';
const catalog = window.settingsCatalog;
const rows = new Map(), bridges = new Set();
const statusNode = document.getElementById('status');
const host = document.getElementById('controls'), modal = document.getElementById('choices');
let motion = null;
if (window.TVMotion) {
  motion = window.TVMotion.create({root:document, resolveRect:element => (element.closest('.row') || element).getBoundingClientRect()});
}
function focus(element) { if (!element) return; if (motion) motion.focus(element); else element.focus(); }
function reveal(element,container) {
  if (motion) motion.reveal(element,container,{padding:10});
  else element.scrollIntoView({block:'nearest'});
}
let section = 'Rapides', page = null, generation = 0, selectedRow = null;
let firstRead = true, contextBridge = null, refreshTimer = null;
let settleTimers = [];
const metrics = { firstFrameMs: null, readMs: null, writes: 0 };
window.quickSettingsMetrics = metrics;

function backend(method, args = {}) {
  return new Promise((resolve, reject) => {
    if (typeof PalmServiceBridge === 'undefined') return reject(new Error('Service disponible sur la télé uniquement'));
    const bridge = new PalmServiceBridge(); bridges.add(bridge);
    const timer = setTimeout(() => { bridge.cancel(); bridges.delete(bridge); reject(new Error('Le service ne répond pas')); }, 15000);
    bridge.onservicecallback = raw => {
      clearTimeout(timer); bridges.delete(bridge);
      try {
        const result = JSON.parse(raw);
        if (!result.returnValue) throw new Error(result.errorText || 'Opération refusée');
        resolve(result);
      } catch (error) { reject(error); }
    };
    bridge.call('luna://org.local.quicksettings.service/' + method, JSON.stringify(args));
  });
}
function label(value, key) {
  if (key === 'gamma') return ({low:'1.9',medium:'2.2',high1:'2.4',high2:'BT.1886'})[value] || value;
  if (key === 'sleepTimer' && /^\d+$/.test(value)) return value + ' min';
  if (key === 'automaticStandBy' && /^\d+$/.test(value)) return value === '0' ? 'Désactivée' : value + ' h';
  return window.settingLabels[value] || String(value);
}
const queue = new SaveQueue(async args => {
  metrics.writes++; return backend('set', args);
}, (item, result) => {
  render(rows.get(item.id));
  if (result && result.contextChanged) {
    for (const row of rows.values()) if (row.def.category === item.meta.category) { row.available = false; render(row); }
    refreshContext();
  }
  if (![...queue.items.values()].some(entry => entry.error)) statusNode.textContent = queue.hasPending() ? 'Application…' : '';
}, (item, error) => {
  const row = rows.get(item.id); if (row) row.available = false;
  statusNode.textContent = error.message; render(row);
});

function render(row) {
  if (!row) return;
  const item = queue.items.get(row.def.id), value = item ? item.desired : undefined;
  row.el.classList.toggle('unavailable', !row.available);
  row.el.hidden = row.platformHidden || (section === 'Rapides' && !row.available);
  row.el.classList.toggle('saving', !!item && (item.dirty || item.saving));
  row.el.classList.toggle('failed', !!item && !!item.error);
  row.control.setAttribute('aria-disabled', String(!row.available));
  row.value.textContent = value === undefined ? '—' : label(value, row.def.key);
  row.note.textContent = row.available ? '' : (row.reason || (row.loaded ? 'Indisponible pour la source ou le mode actuel' : 'Lecture…'));
  row.note.hidden = row.available;
  if (row.range && value !== undefined) {
    row.control.min = row.range.min; row.control.max = row.range.max; row.control.step = row.range.interval || 1;
    row.control.value = Number(value);
    row.control.style.setProperty('--progress', 100 * (Number(value) - row.range.min) / (row.range.max - row.range.min) + '%');
  }
}
function createRow(def, range) {
  const el = document.createElement('div'); el.className = 'row'; el.dataset.id = def.id;
  const value = document.createElement('span'); value.className = 'value';
  const note = document.createElement('p'); note.className = 'secondary';
  const control = document.createElement(range ? 'input' : 'button'); control.dataset.id = def.id;
  if (range) {
    control.type = 'range'; control.id = def.id;
    const line = document.createElement('div'); line.className = 'row-label';
    const name = document.createElement('label'); name.htmlFor = def.id; name.textContent = def.label;
    line.append(name, value); el.append(line, control);
    control.oninput = () => adjust(def.id, Number(control.value));
  } else {
    control.className = 'select';
    const name = document.createElement('span'); name.className = 'name'; name.textContent = def.label;
    const end = document.createElement('span'); end.className = 'chevron'; end.textContent = '›';
    control.append(name, value, end); el.append(control); control.onclick = () => openChoices(def.id);
  }
  control.onfocus = () => {
    document.getElementById('help').textContent = window.settingHelp[def.key] || 'Les changements s’appliquent automatiquement.';
    reveal(el,host);
  };
  el.append(note);
  const row = { def, el, control, value, note, range: range || null, options: [], available: false, loaded: false };
  rows.set(def.id, row); return row;
}
function visibleDefinitions() { return catalog.filter(def => section === 'Rapides' ? def.quick : def.page === page); }
function focusFirst() {
  const control = [...host.querySelectorAll('button,input')].find(item => !item.closest('[hidden]'));
  focus(control || document.querySelector('.tab.selected'));
}
function menuButton(title, note, activate) {
  const button = document.createElement('button'); button.className = 'menu-entry';
  const name = document.createElement('span'); name.textContent = title;
  const hint = document.createElement('span'); hint.className = 'menu-hint'; hint.textContent = note;
  button.append(name,hint); button.onclick = activate;
  button.onfocus = () => reveal(button,host);
  return button;
}
function mountRows() {
  const fragment = document.createDocumentFragment();
  if (section !== 'Rapides' && !page) {
    for (const item of window.settingsManifest.pages.filter(item => item.section === section)) {
      fragment.append(menuButton(item.title,'›',() => selectPage(item.id)));
    }
    for (const item of window.settingsManifest.links.filter(item => item.section === section)) {
      fragment.append(menuButton(item.title,'LG ↗',() => closePanel(item.target)));
    }
    host.replaceChildren(fragment); host.scrollTop = 0; return;
  }
  for (const def of visibleDefinitions()) {
    const numeric = ['backlight','brightness','contrast','sharpness','color','tint','colorTemperature',
      'truMotionJudder','truMotionBlur','avSyncSpdif','audioBalance'].includes(def.key);
    const row = rows.get(def.id) || createRow(def, numeric ? {min:0,max:100,interval:1} : null);
    fragment.append(row.el); render(row);
  }
  if (page) {
    const current = window.settingsManifest.pages.find(item => item.id === page);
    fragment.append(menuButton('Toutes les options LG de cette rubrique','LG ↗',() => closePanel(current.target)));
  }
  host.replaceChildren(fragment);
  host.scrollTop = 0;
}
async function refresh() {
  const token = ++generation, definitions = visibleDefinitions(), groups = {};
  if (!definitions.length) { statusNode.textContent = ''; return; }
  for (const def of definitions) (groups[def.category] ||= []).push(def.key);
  const start = performance.now();
  try {
    const data = await backend('read', { groups });
    if (token !== generation) return;
    metrics.readMs = Math.round(performance.now() - start);
    for (const def of definitions) {
      let row = rows.get(def.id);
      const group = data.groups[def.category];
      const desc = group && !group.error && group.descriptors.find(item => item.key === def.key);
      const range = desc && desc.vtype === 'Range' ? desc.values.range : null;
      // The server descriptor chooses the control, including newly added ranges.
      if (!!range !== (row.control.tagName === 'INPUT')) {
        const old = row, focused = document.activeElement === row.control;
        row = createRow(def,range); old.el.replaceWith(row.el);
        if (focused) focus(row.control);
      }
      row.loaded = true;
      row.range = range;
      row.options = desc ? ((desc.values || {}).arrayExt || []).filter(item => item.visible !== false && item.active !== false).map(item => item.value) : [];
      // Pairing and compound speaker routes need the LG device connection workflow.
      if (def.key === 'soundOutput') row.options = row.options.filter(value =>
        ['tv_speaker','external_arc','external_optical'].includes(value) || value === group.settings[def.key]);
      row.platformHidden = !desc || !['string','number','boolean'].includes(typeof group.settings[def.key]) ||
        (desc.ui && desc.ui.visible === false);
      row.reason = desc && desc.reason;
      row.available = !!desc && desc.ui && desc.ui.visible !== false && desc.ui.active !== false &&
        ['string','number','boolean'].includes(typeof group.settings[def.key]) && (row.range ?
          Number.isFinite(row.range.min) && row.range.max > row.range.min : row.options.length > 1);
      if (group && !group.error) queue.register(def.id, group.settings[def.key], {
        category: def.category, key: def.key, dimension: group.dimension
      });
      render(row);
    }
    const focusedRow = document.activeElement.closest('.row');
    if (firstRead || (focusedRow && focusedRow.hidden) || document.activeElement === document.body) {
      firstRead = false; focusFirst();
    }
    const picture = data.groups.picture;
    if (picture && !picture.error) document.getElementById('context').textContent = label(picture.settings.pictureMode || 'Image', 'pictureMode');
    const error = Object.values(data.groups).find(group => group.error);
    statusNode.textContent = error ? error.error : '';
  } catch (error) {
    if (token !== generation) return;
    statusNode.textContent = error.message;
    for (const def of definitions) { const row = rows.get(def.id); row.available = false; render(row); }
  }
}
function adjust(id, value) {
  const row = rows.get(id);
  if (!row.available) { render(row); return; }
  queue.update(id, value);
}
function closeChoices() {
  modal.hidden = true; document.getElementById('panel').removeAttribute('inert');
  if (selectedRow) focus(selectedRow.control); selectedRow = null;
}
function openChoices(id) {
  const row = rows.get(id);
  if (!row.available || row.range) return;
  selectedRow = row; document.getElementById('choice-title').textContent = row.def.label;
  const list = document.getElementById('choice-list'); list.replaceChildren();
  for (const value of row.options) {
    const button = document.createElement('button'); button.textContent = label(value, row.def.key);
    button.classList.toggle('current', String(value) === String(queue.items.get(id).desired));
    button.onclick = () => { adjust(id, value); closeChoices(); };
    button.onfocus = () => reveal(button,list); list.append(button);
  }
  modal.hidden = false; document.getElementById('panel').setAttribute('inert', '');
  focus(list.querySelector('.current') || list.firstElementChild);
}
async function closePanel(original = false) {
  const pending = queue.hasPending(); await queue.flush();
  if (pending && [...queue.items.values()].some(item => item.error)) {
    statusNode.textContent = 'Une modification a échoué. Actualise ou appuie à nouveau sur Retour.'; return;
  }
  if (original) {
    try { await backend('original',typeof original === 'string' ? {target:original} : {}); }
    catch (error) { statusNode.textContent = error.message; return; }
  }
  window.close();
}
function selectSection(next) {
  section = next; page = null;
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('selected', tab.dataset.section === section);
    tab.setAttribute('aria-current', tab.dataset.section === section ? 'page' : 'false');
  }
  document.getElementById('section-title').textContent = next === 'Rapides' ? 'Réglages rapides' : next;
  document.getElementById('page-back').hidden = true;
  mountRows(); refresh();
}
function selectPage(id) {
  page = id;
  document.getElementById('section-title').textContent = window.settingsManifest.pages.find(item=>item.id===id).title;
  document.getElementById('page-back').hidden = false;
  mountRows(); refresh(); focusFirst();
}
function backPage() { selectSection(section); focusFirst(); }
function refreshContext() {
  settleTimers.forEach(clearTimeout);
  // Route values are committed before LG finishes recalculating descriptors.
  // Bounded settling reads cover missing/early native notifications.
  settleTimers = [0, 250, 1000].map(delay => setTimeout(async () => {
    await queue.flush(); refresh();
  }, delay));
}
for (const tab of document.querySelectorAll('.tab')) {
  tab.onclick = () => { selectSection(tab.dataset.section); focusFirst(); };
  tab.onfocus = () => { if (section !== tab.dataset.section) selectSection(tab.dataset.section); };
}
document.getElementById('close').onclick = () => closePanel();
document.getElementById('original').onclick = () => closePanel(true);
document.getElementById('page-back').onclick = backPage;
document.getElementById('refresh').onclick = async () => { await queue.flush(); refresh(); };
document.addEventListener('keydown', event => {
  const key = event.keyCode;
  if ([38,40,37,39,461,27,406].includes(key)) event.preventDefault();
  if (key === 461 || key === 27) { if (!modal.hidden) closeChoices(); else if (page) backPage(); else closePanel(); return; }
  const focused = document.activeElement;
  if (!modal.hidden) {
    if (key === 38 || key === 40) {
      const options = [...document.querySelectorAll('#choice-list button')], index = options.indexOf(focused);
      focus(options[Math.max(0, Math.min(options.length - 1, index + (key === 40 ? 1 : -1)))]);
    }
    return;
  }
  if (key === 406) { focus(document.querySelector('.tab.selected')); return; }
  if (key === 38 || key === 40) {
    const inNav = !!focused.closest('nav');
    const items = [...document.querySelectorAll(inNav ? 'nav button' : '#close, #page-back, #controls input, #controls button')]
      .filter(item => !item.closest('[hidden]'));
    const index = items.indexOf(focused);
    focus(items[Math.max(0, Math.min(items.length - 1, index + (key === 40 ? 1 : -1)))]);
  } else if (key === 37 || key === 39) {
    if (focused.closest('nav')) { if (key === 39) focusFirst(); return; }
    const row = rows.get(focused.dataset.id);
    if (!row || !row.available) {
      if (key === 37) focus(document.querySelector('.tab.selected'));
      else if (focused.classList.contains('menu-entry')) focused.click();
      return;
    }
    const item = queue.items.get(row.def.id);
    if (row.range) {
      const r = row.range;
      adjust(row.def.id, Math.max(r.min, Math.min(r.max, Number(item.desired) + (key === 39 ? 1 : -1) * (r.interval || 1))));
    } else {
      if (key === 37) focus(document.querySelector('.tab.selected'));
      else openChoices(row.def.id);
    }
  }
});
document.addEventListener('webOSRelaunch', event => { event.preventDefault(); closePanel(); });
function watchContext() {
  if (typeof PalmServiceBridge === 'undefined') return;
  contextBridge = new PalmServiceBridge();
  contextBridge.onservicecallback = raw => {
    try {
      if (!JSON.parse(raw).changed) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refreshContext, 80);
    } catch (_) { /* Read errors are reported by refresh; no polling fallback. */ }
  };
  contextBridge.call('luna://org.local.quicksettings.service/watch', JSON.stringify({subscribe:true}));
}
window.addEventListener('pagehide', () => {
  clearTimeout(refreshTimer); settleTimers.forEach(clearTimeout);
  if (contextBridge) contextBridge.cancel();
});
mountRows(); focusFirst(); watchContext();
requestAnimationFrame(() => { metrics.firstFrameMs = Math.round(performance.now()); });
refresh();
