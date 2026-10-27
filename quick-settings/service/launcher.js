'use strict';
const fs = require('fs');
const imageCache = new Map();
const HOME = 'org.local.cleanlauncher';
function iconData(path) {
  if (imageCache.has(path)) return imageCache.get(path);
  if (typeof path !== 'string' || !/^\/(usr\/palm|media\/(cryptofs|developer)|mnt\/otncabi\/usr\/palm)\//.test(path)) return '';
  try {
    if (fs.statSync(path).size > 300000) return '';
    const data = fs.readFileSync(path);
    const mime = data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' :
      data[0] === 255 && data[1] === 216 ? 'image/jpeg' : '';
    if (!mime) return '';
    const url = 'data:' + mime + ';base64,' + data.toString('base64');
    if (imageCache.size > 40) imageCache.clear();
    imageCache.set(path,url); return url;
  } catch (_) { return ''; }
}
function createLauncher(luna) {
  const enabled = () => fs.existsSync('/var/lib/webosbrew/launcher/enabled');
  async function points() {
    const data = await luna('listLaunchPoints',{},'com.webos.applicationManager');
    if (!data.returnValue || !Array.isArray(data.launchPoints)) throw Error('Liste des applications indisponible');
    return data.launchPoints.filter(item=>item.hidden !== true && item.id !== HOME);
  }
  return {
    async launcherList() {
      const apps = await points();
      return {returnValue:true,apps:apps.map(item=>({id:item.id,launchPointId:item.launchPointId,
        title:item.title || item.id,
        description:typeof item.appDescription === 'string' ? item.appDescription.trim().slice(0,600) : '',
        color:typeof item.iconColor === 'string' && /^#[0-9a-f]{6}$/i.test(item.iconColor) ? item.iconColor : '#203447',
        icon:iconData(item.largeIcon || item.icon),
        input:/^com\.webos\.app\.hdmi\d$/.test(item.id)}))};
    },
    async launcherLaunch(args) {
      let launch;
      if (args.action === 'settings') launch = {id:'org.local.quicksettings'};
      else if (args.action === 'lgHome') launch = {id:'com.webos.app.home'};
      else {
        const point = (await points()).find(item=>item.launchPointId===args.launchPointId);
        if (!point) throw Error('Cette application n’est plus disponible');
        launch = {id:point.id,params:point.params || {}};
      }
      const result = await luna('launch',launch,'com.webos.applicationManager');
      if (!result.returnValue) throw Error(result.errorText || 'Ouverture impossible');
      return result;
    },
    async launcherWatch() {
      // Compatibility for older hooks: routing now happens before an app launches.
      return {returnValue:true,enabled:enabled(),routing:'system'};
    }
  };
}
module.exports = {createLauncher,iconData};
