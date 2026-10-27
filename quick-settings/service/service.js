'use strict';
const Service = require('webos-service');
const service = new Service('org.local.quicksettings.service');
const { createEngine, allowed } = require('./engine');
function luna(method, payload, name = 'com.webos.settingsservice') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { request.cancel(); reject(new Error('Le service LG ne répond pas')); }, 4000);
    const request = service.call('luna://' + name + '/' + method, payload, reply => {
      clearTimeout(timer); resolve(reply.payload);
    });
  });
}
const engine = createEngine(luna);
const launcher = require('./launcher').createLauncher(luna,service);
const watchers = new Map();
service.register('watch', message => {
  if (!message.isSubscription) { message.respond({returnValue:false,errorText:'Subscription required'}); return; }
  const handles = [];
  watchers.set(message.uniqueToken, handles);
  message.respond({returnValue:true,subscribed:true});
  for (const [category, keys] of [['sound',['soundOutput','soundMode','lgSoundSync']], ['picture',['pictureMode','energySaving']]]) {
    let initialized = false, last = {}, dimension = {};
    const subscription = service.subscribe('luna://com.webos.settingsservice/getSystemSettings', {category,keys,subscribe:true});
    handles.push(subscription);
    subscription.on('response', reply => {
      const payload = reply.payload;
      if (!payload.returnValue || !payload.settings) return;
      const merged = {...last,...payload.settings}, nextDimension = payload.dimension || dimension;
      const changed = JSON.stringify(merged) !== JSON.stringify(last) || JSON.stringify(nextDimension) !== JSON.stringify(dimension);
      last = merged; dimension = nextDimension;
      if (initialized && changed && watchers.has(message.uniqueToken)) message.respond({returnValue:true,subscribed:true,changed:true});
      initialized = true;
    });
  }
  // LG updates descriptors separately from values (sometimes after the route
  // notification). Observe both, so an early read cannot leave a row hidden.
  for (const [category, keys] of Object.entries(allowed)) {
    let previous;
    const subscription = service.subscribe('luna://com.webos.settingsservice/getSystemSettingDesc', {category,keys,subscribe:true});
    handles.push(subscription);
    subscription.on('response', reply => {
      const payload = reply.payload;
      if (!payload.returnValue || !payload.results) return;
      const next = JSON.stringify(payload.results);
      if (previous !== undefined && next !== previous && watchers.has(message.uniqueToken)) {
        message.respond({returnValue:true,subscribed:true,changed:true});
      }
      previous = next;
    });
  }
}, message => {
  for (const handle of watchers.get(message.uniqueToken) || []) handle.cancel();
  watchers.delete(message.uniqueToken);
});
for (const name of ['read', 'set', 'original','launcherList','launcherLaunch','launcherWatch']) {
  service.register(name, message => {
    Promise.resolve().then(() => (engine[name] || launcher[name])(message.payload || {}))
      .then(result => message.respond(result))
      .catch(error => message.respond({ returnValue: false, errorText: error.message }));
  });
}
// A small idle service avoids a fresh Node startup between interactions. No polling.
service.activityManager.create('keepAlive', () => {});
// LG's bus bindings do not keep Node's event loop referenced. An idle timer does;
// it does no work and never queries the TV (one empty callback per day).
setInterval(() => {}, 86400000);
service.register('ping', message => message.respond({ returnValue: true, version: '0.3.5', watchers:watchers.size }));
