#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const CUSTOM = 'org.local.cleanlauncher';
const ORIGINAL = 'com.webos.app.home';
const base = process.env.CLEAN_HOME_STATE || '/var/lib/webosbrew/launcher/native-home';
const layer = process.env.CLEAN_IDLE_LAYER || '/var/webos-profile/testLayer';
const luna = process.env.CLEAN_HOME_LUNA || '/usr/bin/luna-send';
const appIndex = process.env.CLEAN_HOME_APP_INDEX || '/media/developer/apps/usr/palm/applications/org.local.cleanlauncher/index.html';
const marker = path.join(base, 'idle-original.json');
const profileFile = path.join(layer, 'profile.json');
const content = JSON.stringify({idleApp:{appId:CUSTOM}}) + '\n';

function call(service, method, params, allowFailure) {
  const result = cp.spawnSync(luna, ['-n','1','-w','5000','luna://' + service + '/' + method, JSON.stringify(params)], {encoding:'utf8',input:'',timeout:7000});
  if (result.error || result.status !== 0) throw new Error('Luna call failed: ' + (result.error || result.stderr));
  let reply;
  try { reply = JSON.parse(result.stdout.trim()); } catch (_) { throw new Error('Invalid Luna response'); }
  if (reply.returnValue !== true && !allowFailure) throw new Error(method + ': ' + (reply.errorText || 'failed'));
  return reply;
}
function profile() {
  const p = call('com.webos.service.systemprofile','getProfiles',{names:['idleApp']}).profiles;
  if (!p || !p.idleApp || typeof p.idleApp !== 'object') throw new Error('Missing idleApp profile');
  return p.idleApp;
}
function eligible() {
  const r = call('com.webos.applicationManager','getAppInfo',{id:CUSTOM},true);
  if (r.returnValue === true) return !!(r.appInfo && Array.isArray(r.appInfo.appCategory) && r.appInfo.appCategory.includes('home'));
  if (/invalid appid|not found/i.test(r.errorText || '')) return null;
  throw new Error('Cannot check launcher registration: ' + (r.errorText || 'unknown error'));
}
function reload() { call('com.webos.service.systemprofile','debug/rescan',{}); }
function owned() {
  return fs.existsSync(profileFile) && fs.readFileSync(profileFile,'utf8') === content;
}
function validateOriginal(p) {
  if (p.appId !== ORIGINAL || p.support !== true || p._packageIncluded !== true || p._configuration !== 'idleApp.json') throw new Error('Unexpected idleApp profile; refusing override');
}
function install() {
  const p = profile();
  validateOriginal(p);
  if (!eligible()) throw new Error('Launcher is missing or not registered for home');
  if (fs.existsSync(layer)) throw new Error('Profile test layer already exists; refusing to overwrite it');
  fs.mkdirSync(base,{recursive:true,mode:0o700});
  fs.writeFileSync(marker,JSON.stringify(p,null,2)+'\n',{mode:0o600});
  fs.mkdirSync(layer);
  fs.writeFileSync(profileFile,content,{flag:'wx',mode:0o644});
  reload();
  const after = profile();
  if (after.appId !== CUSTOM || after.support !== p.support || after._configuration !== p._configuration || after._packageIncluded !== p._packageIncluded) throw new Error('Idle profile readback mismatch; run disable');
}
function disable() {
  if (!fs.existsSync(marker)) throw new Error('Idle snapshot missing');
  if (fs.existsSync(layer)) {
    if (!owned() || fs.readdirSync(layer).length !== 1) throw new Error('Profile test layer changed; refusing removal');
    fs.unlinkSync(profileFile);
    fs.rmdirSync(layer);
    reload();
  }
  const expected = JSON.parse(fs.readFileSync(marker,'utf8'));
  if (JSON.stringify(profile()) !== JSON.stringify(expected)) throw new Error('Original idle profile readback mismatch');
  fs.unlinkSync(marker);
}
function main() {
  const action=process.argv[2];
  if (action === 'status') console.log(JSON.stringify({profile:profile(),owned:owned(),snapshot:fs.existsSync(marker)}));
  else if (action === 'enable') {
    if (fs.existsSync(marker)) {
      if (!owned() || profile().appId !== CUSTOM || !eligible()) throw new Error('Existing idle override requires inspection');
    } else install();
    console.log('Idle destination: ' + CUSTOM);
  } else if (action === 'disable') {
    disable(); console.log('Original idle profile restored');
  } else if (action === 'guard') {
    if (!fs.existsSync(marker)) return;
    const ready=eligible();
    if (ready === null && fs.existsSync(appIndex)) throw new Error('Launcher registration not ready');
    if (!ready) { disable(); return; }
    if (!fs.existsSync(layer)) {
      const saved = JSON.parse(fs.readFileSync(marker,'utf8'));
      if (JSON.stringify(profile()) !== JSON.stringify(saved)) throw new Error('Idle profile changed; refusing reapply');
      install();
    } else if (!owned() || profile().appId !== CUSTOM) throw new Error('Idle override changed; refusing to modify it');
  } else throw new Error('Usage: idle.js status|enable|disable|guard');
}
try { main(); } catch (err) { console.error(err.message); process.exitCode=1; }
