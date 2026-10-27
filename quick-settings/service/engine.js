'use strict';
const manifest = require('./catalog');
const allowed = Object.create(null);
for (const def of manifest.settings) (allowed[def.category] ||= []).push(def.key);
const contextKeys = { picture: ['pictureMode'], sound: ['soundMode', 'soundOutput', 'lgSoundSync'], time: [] };
const comparable = (a, b) => String(a) === String(b);
function equalDimension(a = {}, b = {}, ignored = '') {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every(key => key === ignored || a[key] === b[key]);
}
function choices(desc) {
  return ((desc.values || {}).arrayExt || []).filter(item => item.active !== false && item.visible !== false).map(item => item.value);
}
function contextualDescriptor(desc, settings) {
  if (desc.key !== 'soundOutputDigital') return desc;
  const route = settings.soundOutput;
  // LG Settings b6: route gating in addition to the database's UI descriptor.
  // Combined TV+ARC needs a Harmony-device probe; fail closed until implemented.
  const digitalRoute = ['external_arc','external_optical','wow_cast','tv_speaker_wow_cast'].includes(route);
  const lockedSync = route === 'external_optical' && settings.lgSoundSync === 'on';
  if (digitalRoute && !lockedSync) return desc;
  return { ...desc, ui: { ...desc.ui, active: false },
    reason: lockedSync ? 'Désactive LG Sound Sync pour régler ce format.' :
      'Ce réglage nécessite une sortie numérique compatible.' };
}
function validate(desc, value) {
  if (!desc || !desc.ui || desc.ui.active === false || desc.ui.visible === false) {
    throw new Error('Indisponible dans le mode actuel');
  }
  if (desc.vtype === 'Range') {
    const range = (desc.values || {}).range;
    if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max) ||
      !Number.isInteger(value) || value < range.min || value > range.max ||
      (value - range.min) % (range.interval || 1)) throw new Error('Valeur hors limites');
  } else if (!choices(desc).some(item => comparable(item, value))) throw new Error('Option indisponible');
}

function createEngine(luna) {
  let writeTail = Promise.resolve();
  async function readCategory(category, requested) {
    if (!allowed[category]) throw new Error('Catégorie inconnue');
    const keys = requested || allowed[category];
    if (!Array.isArray(keys) || !keys.length || !keys.every(key => allowed[category].includes(key))) {
      throw new Error('Réglage inconnu');
    }
    const queryKeys = [...new Set([...keys, ...(contextKeys[category] || [])])];
    const [values, desc] = await Promise.all([
      luna('getSystemSettings', { category, keys: queryKeys }),
      luna('getSystemSettingDesc', { category, keys })
    ]);
    if (!values.settings || !desc.results) throw new Error(values.errorText || desc.errorText || 'Lecture impossible');
    return { category, settings: values.settings, dimension: values.dimension || {},
      descriptors: desc.results.map(item => contextualDescriptor(item, values.settings)) };
  }
  async function read(args) {
    const groups = args.groups;
    if (!groups || typeof groups !== 'object' || !Object.keys(groups).length) throw new Error('Liste vide');
    const entries = await Promise.all(Object.entries(groups).map(async ([category, keys]) => {
      try { return [category, await readCategory(category, keys)]; }
      catch (error) { return [category, { error: error.message }]; }
    }));
    return { returnValue: true, groups: Object.fromEntries(entries) };
  }
  async function set(args) {
    const { category, key, value, previous, dimension } = args;
    if (!allowed[category] || !allowed[category].includes(key)) throw new Error('Réglage inconnu');
    if (!dimension || typeof dimension !== 'object') throw new Error('Contexte manquant');
    const before = await readCategory(category, [key]);
    // Compare only dimensions returned for this setting, not unrelated panel dimensions.
    if (Object.keys(before.dimension).some(name => before.dimension[name] !== dimension[name]) ||
        !comparable(before.settings[key], previous)) throw new Error('Le réglage ou la source a changé. Actualise le panneau.');
    const desc = before.descriptors.find(item => item.key === key);
    validate(desc, value);
    const writeDimension = Object.fromEntries((desc.dimension || []).map(name => [name, before.dimension[name]]));
    if (Object.values(writeDimension).some(item => item === undefined)) throw new Error('Contexte incomplet');
    if (!['string','number','boolean'].includes(typeof before.settings[key])) throw new Error('Utilise le panneau LG pour ce réglage');
    const converted = typeof before.settings[key] === 'number' ? Number(value) :
      typeof before.settings[key] === 'boolean' ? String(value) === 'true' : String(value);
    // LG rejects an explicit empty dimension for global settings (DB error).
    const response = await luna('setSystemSettings', { category,
      ...(Object.keys(writeDimension).length ? {dimension:writeDimension} : {}),
      settings: { [key]: converted } });
    if (!response.returnValue) throw new Error(response.errorText || 'Modification refusée');
    const after = await luna('getSystemSettings', { category, keys: [...new Set([key, ...(contextKeys[category] || [])])] });
    if (!after.returnValue || !comparable(after.settings[key], value) ||
      !equalDimension(before.dimension, after.dimension || {}, key)) {
      throw new Error('La télé n’a pas confirmé la modification. Actualise le panneau.');
    }
    return { returnValue: true, value: after.settings[key], dimension: after.dimension || {},
      contextChanged: desc.vtype !== 'Range' };
  }
  return {
    read,
    set(args) {
      const job = writeTail.then(() => set(args));
      writeTail = job.catch(() => {});
      return job;
    },
    async original(args = {}) {
      const target = args.target;
      if (target !== undefined && !Object.hasOwnProperty.call(manifest.targets,target)) throw new Error('Écran LG inconnu');
      const launch = target === undefined ? {id:'com.palm.app.settings'} : manifest.targets[target];
      const result = await luna('launch', launch, 'com.webos.applicationManager');
      if (!result.returnValue) throw new Error(result.errorText || 'Ouverture impossible');
      return result;
    }
  };
}
module.exports = { createEngine, equalDimension, validate, choices, allowed, contextualDescriptor };
