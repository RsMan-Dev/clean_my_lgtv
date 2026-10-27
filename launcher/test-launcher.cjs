const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLauncher}=require('../quick-settings/service/launcher');
test('System Home routing needs no foreground subscription and retains explicit LG launch',async()=>{
 const launches=[];
 const engine=createLauncher(async(method,args)=>{launches.push({method,args});return {returnValue:true};},
  {subscribe(){throw Error('Foreground redirection must not restart LG Home');}});
 const status=await engine.launcherWatch();assert.equal(status.routing,'system');
 await engine.launcherLaunch({action:'lgHome'});
 assert.deepEqual(launches,[{method:'launch',args:{id:'com.webos.app.home'}}]);
});
test('Only visible launchpoints can launch, using native HDMI parameters',async()=>{
 const points=[{id:'org.jellyfin.webos',launchPointId:'jellyfin',title:'Jellyfin',iconColor:'#000b25',appDescription:'Une description fournie par l’application.'},
  {id:'com.webos.app.hdmi1',launchPointId:'ps5',params:{id:'uniqueId',value:'-1'}},
  {id:'hidden.app',launchPointId:'hidden',hidden:true}];
 const launches=[];
 const engine=createLauncher(async(method,args)=>{
  if(method==='listLaunchPoints')return {returnValue:true,launchPoints:points};
  launches.push(args);return {returnValue:true};
 });
 const list=await engine.launcherList();assert.equal(list.apps.length,2);
 assert.equal(list.apps[0].description,'Une description fournie par l’application.');
 assert.equal(list.apps[1].description,'');
 assert.equal(list.apps[0].color,'#000b25');assert.equal(list.apps[1].color,'#203447');
 await assert.rejects(engine.launcherLaunch({launchPointId:'hidden'}));
 await assert.rejects(engine.launcherLaunch({launchPointId:'invented',id:'com.palm.app.settings'}));
 await engine.launcherLaunch({launchPointId:'ps5'});
 assert.deepEqual(launches,[{id:'com.webos.app.hdmi1',params:{id:'uniqueId',value:'-1'}}]);
 points.splice(0,1);await assert.rejects(engine.launcherLaunch({launchPointId:'jellyfin'}));
});
