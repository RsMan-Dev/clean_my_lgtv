'use strict';
const { execFile } = require('child_process');
const keys = ['backlight', 'brightness', 'contrast', 'sharpness'];

function luna(method, payload, service = 'com.webos.settingsservice') {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/luna-send', ['-n', '1', '-w', '4000', 'luna://' + service + '/' + method,
      JSON.stringify(payload)], { timeout: 5000, maxBuffer: 128 * 1024 }, (error, stdout) => {
      try {
        if (error) throw error;
        const response = JSON.parse(stdout);
        if (!response.returnValue) throw new Error(response.errorText || 'LG service unavailable');
        resolve(response);
      } catch (failure) { reject(failure); }
    });
  });
}

async function read() {
  const [values, description] = await Promise.all([
    luna('getSystemSettings', { category: 'picture', keys }),
    luna('getSystemSettingDesc', { category: 'picture', keys })
  ]);
  return { returnValue: true, settings: values.settings, dimension: values.dimension,
    descriptors: description.results };
}

function equalDimension(left, right) {
  if (!left || !right) return false;
  const names = Object.keys(left).sort();
  return JSON.stringify(names) === JSON.stringify(Object.keys(right).sort()) &&
    names.every(key => left[key] === right[key]);
}

async function main(operation, args) {
  if (operation === 'read') return read();
  if (operation === 'original') {
    return luna('launch', { id: 'com.palm.app.settings' }, 'com.webos.applicationManager');
  }
  if (operation !== 'set' || !keys.includes(args.key)) throw new Error('Unknown operation');
  const before = await read();
  if (!equalDimension(before.dimension, args.dimension) || Number(before.settings[args.key]) !== args.previous) {
    throw new Error('The picture context changed.');
  }
  const desc = before.descriptors.find(item => item.key === args.key);
  const range = desc && desc.values && desc.values.range;
  if (!range || !desc.ui || desc.ui.active === false || desc.ui.visible === false ||
      !Number.isInteger(args.value) || args.value < range.min || args.value > range.max ||
      (args.value - range.min) % (range.interval || 1) !== 0) {
    throw new Error('Value is not allowed in this picture mode.');
  }
  await luna('setSystemSettings', { category: 'picture', dimension: before.dimension,
    settings: { [args.key]: args.value } });
  const after = await read();
  if (!equalDimension(after.dimension, before.dimension) || Number(after.settings[args.key]) !== args.value) {
    throw new Error('The TV did not confirm this value.');
  }
  return after;
}

if (require.main === module) {
  Promise.resolve().then(() => {
    const args = process.argv[3] ? JSON.parse(Buffer.from(process.argv[3], 'base64').toString('utf8')) : {};
    return main(process.argv[2], args);
  }).then(result => process.stdout.write(JSON.stringify(result) + '\n'))
    .catch(error => process.stdout.write(JSON.stringify({ returnValue: false, errorText: error.message }) + '\n'));
}
module.exports = { equalDimension, main };
