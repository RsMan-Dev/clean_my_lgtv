#!/usr/bin/env node
'use strict';

// Run as root on the TV. No firmware files are modified.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const CUSTOM = 'org.local.cleanlauncher';
const ORIGINAL = 'com.webos.app.home';
const base = process.env.CLEAN_HOME_STATE || '/var/lib/webosbrew/launcher/native-home';
const snapshotPath = path.join(base, 'default-apps.json');
const luna = process.env.CLEAN_HOME_LUNA || '/usr/bin/luna-send';
const appIndex = process.env.CLEAN_HOME_APP_INDEX || '/media/developer/apps/usr/palm/applications/org.local.cleanlauncher/index.html';

function call(service, method, payload, allowFailure) {
  const result = cp.spawnSync(luna, ['-n', '1', '-w', '5000', 'luna://' + service + '/' + method, JSON.stringify(payload)], {
    encoding: 'utf8', input: '', timeout: 7000
  });
  if (result.error || result.status !== 0) throw new Error('Luna call failed: ' + (result.error || result.stderr));
  let response;
  try { response = JSON.parse(result.stdout.trim()); } catch (_) { throw new Error('Invalid Luna response: ' + result.stdout); }
  if (response.returnValue !== true && !allowFailure) throw new Error(method + ': ' + (response.errorText || JSON.stringify(response)));
  return response;
}

function current() {
  const response = call('com.webos.settingsservice', 'getSystemSettings', {category: 'general', keys: ['defaultApps']});
  const value = response.settings && response.settings.defaultApps;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid general.defaultApps');
  return value;
}

function appInfo(id) {
  const response = call('com.webos.applicationManager', 'getAppInfo', {id}, true);
  if (response.returnValue === true) return response.appInfo;
  if (/invalid appid|not found/i.test(response.errorText || '')) return null;
  throw new Error('getAppInfo: ' + (response.errorText || JSON.stringify(response)));
}

function eligible(id) {
  const info = appInfo(id);
  return info && Array.isArray(info.appCategory) && info.appCategory.includes('home');
}

function setHome(id, before) {
  if (!eligible(id)) throw new Error('Home app unavailable or not registered for home: ' + id);
  call('com.webos.applicationManager', 'setDefaultApp', {category: 'home', appId: id});
  const after = current();
  if (after.home !== id) throw new Error('Home setting readback failed');
  for (const key of Object.keys(before)) {
    if (key !== 'home' && JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      throw new Error('Unrelated defaultApps entry changed: ' + key);
    }
  }
  return after;
}

function snapshot(value) {
  fs.mkdirSync(base, {recursive: true, mode: 0o700});
  const tmp = snapshotPath + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  fs.renameSync(tmp, snapshotPath);
}

function previousHome() {
  const saved = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid saved defaultApps');
  if (saved.home === undefined) return ORIGINAL;
  if (typeof saved.home !== 'string' || !saved.home || saved.home === CUSTOM) throw new Error('Invalid saved home destination');
  return saved.home;
}

function main() {
  const action = process.argv[2];
  const before = current();
  if (action === 'status') {
    console.log(JSON.stringify({defaultApps: before, customEligible: eligible(CUSTOM), snapshot: fs.existsSync(snapshotPath)}));
  } else if (action === 'enable') {
    if (!eligible(CUSTOM)) throw new Error('Custom launcher is not registered for home');
    if (before.home === CUSTOM && !fs.existsSync(snapshotPath)) throw new Error('Cannot snapshot an already active custom destination');
    if (before.home !== CUSTOM) snapshot(before);
    if (before.home !== CUSTOM) setHome(CUSTOM, before);
    console.log('Home destination: ' + CUSTOM);
  } else if (action === 'disable') {
    if (before.home !== CUSTOM) { console.log('Home destination already changed; leaving it alone'); return; }
    const target = previousHome();
    setHome(target, before);
    console.log('Home destination restored to ' + target);
  } else if (action === 'guard') {
    // A missing/deleted custom app must not strand Home after boot.
    if (before.home === CUSTOM) {
      const ready = eligible(CUSTOM);
      if (ready === null && fs.existsSync(appIndex)) throw new Error('Launcher registration not ready');
      if (!ready) {
        setHome(previousHome(), before);
        console.log('Missing launcher; restored original destination');
      }
    }
  } else {
    throw new Error('Usage: home.js status|enable|disable|guard');
  }
}

try { main(); } catch (err) { console.error(err.message); process.exitCode = 1; }
