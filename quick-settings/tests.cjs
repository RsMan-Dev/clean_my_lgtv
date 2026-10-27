const { test } = require('node:test');
const assert = require('node:assert/strict');
const SaveQueue = require('./app/save-queue');
const { createEngine, contextualDescriptor } = require('./service/engine');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Every local control has one page, a unique ID and a matching server allowlist', () => {
  const manifest = require('./service/catalog'), {allowed} = require('./service/engine');
  assert.equal(new Set(manifest.settings.map(d=>d.id)).size,manifest.settings.length);
  for (const def of manifest.settings) {
    assert.ok(manifest.pages.some(p=>p.id===def.page && p.section===def.section));
    assert.ok(allowed[def.category].includes(def.key));
  }
  const quick=manifest.settings.filter(d=>d.quick).map(d=>d.key);
  assert.ok(quick.indexOf('soundOutput') < quick.indexOf('soundOutputDigital'));
});
test('LG shortcuts launch only approved screens, never arbitrary app IDs or methods', async () => {
  const calls=[];
  const engine=createEngine(async (...args)=>{calls.push(args);return {returnValue:true};});
  for (const target of ['constructor','__proto__','reset','com.webos.app.browser']) {
    await assert.rejects(engine.original({target}),/inconnu/);
  }
  assert.equal(calls.length,0);
  await engine.original({target:'Bluetooth'});
  assert.deepEqual(calls[0],['launch',{id:'com.palm.app.settings',params:{target:'Bluetooth'}},'com.webos.applicationManager']);
  await engine.original({target:'network'});
  assert.equal(calls[1][1].id,'com.webos.app.firstuse-overlay');
});
test('New categories preserve native booleans and reject compound settings', async () => {
  let value=false; const writes=[];
  const engine=createEngine(async (method,args)=>{
    if(method==='getSystemSettingDesc') return {results:[{key:'highContrast',dimension:[],ui:{active:true,visible:true},values:{arrayExt:[{value:true},{value:false}]}}]};
    if(method==='getSystemSettings') return {returnValue:true,settings:{highContrast:value},dimension:{}};
    writes.push(args);value=args.settings.highContrast;return {returnValue:true};
  });
  await engine.set({category:'option',key:'highContrast',value:true,previous:false,dimension:{}});
  assert.equal(writes[0].settings.highContrast,true);
  assert.equal(Object.hasOwnProperty.call(writes[0],'dimension'),false);
  value={nested:true};
  await assert.rejects(engine.set({category:'option',key:'highContrast',value:false,previous:value,dimension:{}}),/panneau LG/);
  assert.equal(writes.length,1);
});

test('A delayed LG descriptor update refreshes availability and subscriptions are released', () => {
  const vm = require('node:vm'), fs = require('node:fs');
  const { EventEmitter } = require('node:events');
  const methods = {}, subscriptions = [], replies = [];
  class Service {
    constructor() { this.activityManager = {create() {}}; }
    register(name, handler, cancel) { methods[name] = {handler,cancel}; }
    subscribe(uri, params) {
      const handle = new EventEmitter(); handle.cancel = () => { handle.cancelled = true; };
      subscriptions.push({uri,params,handle}); return handle;
    }
  }
  vm.runInNewContext(fs.readFileSync(__dirname + '/service/service.js','utf8'), {
    require: name => name === 'webos-service' ? Service : require('./service/' + name.slice(2)),
    setInterval() {}, setTimeout, clearTimeout
  });
  const message = {isSubscription:true,uniqueToken:'test',respond: reply => replies.push(reply)};
  methods.watch.handler(message);
  const values = subscriptions.find(s => s.params.category === 'sound' && s.uri.endsWith('/getSystemSettings'));
  const desc = subscriptions.find(s => s.params.category === 'sound' && s.uri.endsWith('/getSystemSettingDesc'));
  const emit = (s,payload) => s.handle.emit('response',{payload:{returnValue:true,...payload}});
  emit(values,{settings:{soundOutput:'tv_speaker'}});
  emit(desc,{results:[{key:'soundOutputDigital',ui:{active:false}}]});
  assert.equal(replies.length,1);
  emit(values,{settings:{soundOutput:'external_arc'}});
  assert.equal(replies.length,2);
  // The first read can still see active:false. A later descriptor must notify again.
  emit(desc,{results:[{key:'soundOutputDigital',ui:{active:true}}]});
  assert.equal(replies.length,3);
  emit(desc,{results:[{key:'soundOutputDigital',ui:{active:true}}]});
  assert.equal(replies.length,3);
  methods.watch.cancel(message);
  assert.ok(subscriptions.every(s => s.handle.cancelled));
  emit(desc,{results:[{key:'soundOutputDigital',ui:{active:false}}]});
  assert.equal(replies.length,3);
});

test('A slider burst writes only the latest value; flush preserves it on close', async () => {
  const calls = [];
  const queue = new SaveQueue(async args => { calls.push(args); return { value: args.value, dimension: {} }; }, () => {}, () => {}, 100);
  queue.register('a', 40, { key: 'backlight', dimension: {} });
  for (let value = 41; value <= 65; value++) queue.update('a', value);
  assert.equal(calls.length, 0);
  await queue.flush();
  assert.deepEqual(calls.map(item => [item.previous, item.value]), [[40,65]]);
});
test('Input during a slow write remains responsive and is not overwritten by its response', async () => {
  const calls = [];
  let release;
  const queue = new SaveQueue(async args => {
    calls.push(args);
    if (calls.length === 1) await new Promise(resolve => { release = resolve; });
    return { value: args.value, dimension: {} };
  }, () => {}, () => {}, 0);
  queue.register('a', 40, { dimension: {} }); queue.update('a', 41);
  await wait(10); queue.update('a', 45); queue.update('a', 48);
  assert.equal(queue.items.get('a').desired, 48);
  release(); await queue.flush();
  assert.deepEqual(calls.map(item => [item.previous,item.value]), [[40,41],[41,48]]);
  assert.equal(queue.items.get('a').desired, 48);
});
test('Reverting during an in-flight write sends the revert, without losing it', async () => {
  let release; const calls = [];
  const queue = new SaveQueue(async args => {
    calls.push(args.value);
    if (calls.length === 1) await new Promise(resolve => { release = resolve; });
    return { value: args.value, dimension: {} };
  }, () => {}, () => {}, 0);
  queue.register('a', 40, {}); queue.update('a', 41); await wait(10);
  queue.update('a', 40); release(); await queue.flush(); assert.deepEqual(calls,[41,40]);
});
test('Failure is visible, does not retry forever, and does not block another control', async () => {
  const failures = [];
  const queue = new SaveQueue(async args => {
    if (args.key === 'a') throw new Error('context changed');
    return { value: args.value, dimension: {} };
  }, () => {}, item => failures.push(item.id), 0);
  queue.register('a', 1, {key:'a'}); queue.register('b', 1, {key:'b'});
  queue.update('a', 2); queue.update('b', 3); await queue.flush();
  assert.deepEqual(failures,['a']); assert.equal(queue.items.get('b').saved,3);
  assert.equal(queue.items.get('a').desired,1);
});

function fixture() {
  const state = { backlight:40, pictureMode:'cinema', soundOutputDigital:'pcm', soundOutput:'external_arc', lgSoundSync:'off' };
  const writes = [];
  const luna = async (method, params) => {
    const category = params.category;
    const dimension = category === 'sound' ? {audioInput:'hdmi1',soundMode:'standard',soundOutput:'external_arc'} :
      {input:'hdmi1',pictureMode:state.pictureMode,dynamicRange:'sdr'};
    if (method === 'getSystemSettings') return {returnValue:true,settings:{...state},dimension};
    if (method === 'getSystemSettingDesc') return {returnValue:true,results:params.keys.map(key => ({
      key, ui:{active:true,visible:true}, vtype:key === 'backlight' ? 'Range' : 'ArrayExt',
      dimension:key === 'soundOutputDigital' ? ['audioInput'] : key === 'pictureMode' ? ['input','dynamicRange'] : ['input','pictureMode'],
      values:key === 'backlight' ? {range:{min:0,max:100,interval:1}} :
        {arrayExt:(key === 'pictureMode' ? ['cinema','game'] : ['pcm','auto','passThrough']).map(value=>({value,active:true,visible:true}))}
    }))};
    writes.push(params); Object.assign(state,params.settings); return {returnValue:true};
  };
  return { engine:createEngine(luna), state, writes };
}
test('Server rejects stale context, stale values, unknown keys and out-of-range writes', async () => {
  const {engine,writes} = fixture();
  const base = {category:'picture',key:'backlight',value:41,previous:40,dimension:{input:'hdmi1',pictureMode:'cinema',dynamicRange:'sdr'}};
  for (const args of [{...base,previous:39},{...base,dimension:{input:'hdmi2'}},{...base,value:101},{...base,key:'factoryReset'}]) {
    await assert.rejects(engine.set(args));
  }
  assert.equal(writes.length,0);
});
test('Writes project dimensions per setting and allow a confirmed mode change', async () => {
  const {engine,writes} = fixture();
  const result = await engine.set({category:'picture',key:'pictureMode',value:'game',previous:'cinema',
    dimension:{input:'hdmi1',pictureMode:'cinema',dynamicRange:'sdr'}});
  assert.equal(result.value,'game'); assert.equal(result.contextChanged,true);
  assert.deepEqual(writes[0].dimension,{input:'hdmi1',dynamicRange:'sdr'});
});
test('Digital output accepts only supported enumerated values', async () => {
  const {engine,writes} = fixture();
  const args = {category:'sound',key:'soundOutputDigital',value:'passThrough',previous:'pcm',
    dimension:{audioInput:'hdmi1',soundMode:'standard',soundOutput:'external_arc'}};
  await assert.rejects(engine.set({...args,value:'unknown'}));
  assert.equal((await engine.set(args)).value,'passThrough');
  assert.deepEqual(writes[0].dimension,{audioInput:'hdmi1'});
});
test('Digital output is unavailable on TV/Bluetooth, on locked optical, or without a proven route', () => {
  const desc = {key:'soundOutputDigital',ui:{active:true,visible:true}};
  for (const route of ['tv_speaker','bt_soundbar','headphone','tv_speaker_external_arc',undefined]) {
    assert.equal(contextualDescriptor(desc,{soundOutput:route}).ui.active,false);
  }
  assert.equal(contextualDescriptor(desc,{soundOutput:'external_optical',lgSoundSync:'on'}).ui.active,false);
  assert.equal(contextualDescriptor(desc,{soundOutput:'external_arc'}).ui.active,true);
  assert.equal(contextualDescriptor(desc,{soundOutput:'external_optical',lgSoundSync:'off'}).ui.active,true);
  assert.equal(desc.ui.active,true);
});
test('Context gating protects writes as well as the displayed descriptor', async () => {
  const {engine,state,writes} = fixture(); state.soundOutput='tv_speaker';
  const response=await engine.read({groups:{sound:['soundOutputDigital']}});
  assert.equal(response.groups.sound.descriptors[0].ui.active,false);
  await assert.rejects(engine.set({category:'sound',key:'soundOutputDigital',value:'auto',previous:'pcm',
    dimension:response.groups.sound.dimension}),/Indisponible/);
  assert.equal(writes.length,0);
});
