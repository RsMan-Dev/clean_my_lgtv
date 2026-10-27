'use strict';
const assert=require('assert'), fs=require('fs'), os=require('os'), path=require('path'), cp=require('child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'clean-idle-test-'));
const db=path.join(dir,'db.json'), layer=path.join(dir,'layer'), fake=path.join(dir,'luna');
fs.writeFileSync(fake, `#!/usr/bin/env node
const fs=require('fs'); const state=JSON.parse(fs.readFileSync(process.env.TEST_DB));
const uri=process.argv[process.argv.length-2]; let r;
if(uri.endsWith('/getProfiles')) r={returnValue:true,profiles:{idleApp:state.profile}};
else if(uri.endsWith('/getAppInfo')) r=state.installed?{returnValue:true,appInfo:{appCategory:['home']}}:{returnValue:false,errorText:'Invalid appId specified'};
else if(uri.endsWith('/debug/rescan')) { const f=process.env.CLEAN_IDLE_LAYER+'/profile.json'; state.profile.appId=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)).idleApp.appId:'com.webos.app.home'; fs.writeFileSync(process.env.TEST_DB,JSON.stringify(state)); r={returnValue:true}; }
else throw Error(uri); console.log(JSON.stringify(r));
`,{mode:0o755});
const env={...process.env,CLEAN_HOME_STATE:path.join(dir,'state'),CLEAN_IDLE_LAYER:layer,CLEAN_HOME_LUNA:fake,CLEAN_HOME_APP_INDEX:path.join(dir,'index.html'),TEST_DB:db};
const cli=path.join(__dirname,'idle.js');
const run=a=>cp.spawnSync(process.execPath,[cli,a],{env,encoding:'utf8'});
const read=()=>JSON.parse(fs.readFileSync(db));
const save=s=>fs.writeFileSync(db,JSON.stringify(s));
try {
  save({installed:true,profile:{_packageIncluded:true,_configuration:'idleApp.json',support:true,appId:'com.webos.app.home'}});
  let result=run('enable'); assert.strictEqual(result.status,0,result.stderr);
  assert.strictEqual(read().profile.appId,'org.local.cleanlauncher');
  assert.strictEqual(run('enable').status,0);
  fs.writeFileSync(path.join(layer,'other'),'foreign');
  assert.notStrictEqual(run('disable').status,0);
  assert.strictEqual(read().profile.appId,'org.local.cleanlauncher');
  fs.unlinkSync(path.join(layer,'other'));
  assert.strictEqual(run('disable').status,0);
  assert.strictEqual(read().profile.appId,'com.webos.app.home');
  assert.strictEqual(run('enable').status,0);
  const state=read(); state.installed=false; save(state);
  fs.writeFileSync(env.CLEAN_HOME_APP_INDEX,'installed');
  assert.notStrictEqual(run('guard').status,0);
  assert.strictEqual(read().profile.appId,'org.local.cleanlauncher');
  fs.unlinkSync(env.CLEAN_HOME_APP_INDEX);
  assert.strictEqual(run('guard').status,0);
  assert.strictEqual(read().profile.appId,'com.webos.app.home');
  fs.mkdirSync(layer); fs.writeFileSync(path.join(layer,'profile.json'),'foreign');
  assert.notStrictEqual(run('enable').status,0);
  assert.strictEqual(fs.readFileSync(path.join(layer,'profile.json'),'utf8'),'foreign');
  console.log('Idle routing tests passed');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
