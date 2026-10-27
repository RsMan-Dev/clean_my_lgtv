// Bundle with the minifier already included in the LG CLI; no extra dependency.
const fs = require('fs');
const path = require('path');
const { minify } = require('./.tools/node_modules/@webos-tools/cli/node_modules/terser');
async function build() {
  const source = path.join(__dirname,'app'), out = path.join(__dirname,'.build/app');
  fs.mkdirSync(out,{recursive:true});
  const files = ['catalog.js','save-queue.js','main.js'];
  const code = {'tv-motion.js':fs.readFileSync(path.join(__dirname,'../shared/tv-motion.js'),'utf8'),
    'schema.js':fs.readFileSync(path.join(__dirname,'service/catalog.js'),'utf8'),
    ...Object.fromEntries(files.map(name=>[name,fs.readFileSync(path.join(source,name),'utf8')]))};
  const result = await minify(code,{ecma:2020,compress:{passes:2},mangle:true,format:{comments:false}});
  if (!result.code) throw Error('Empty bundle');
  fs.writeFileSync(path.join(out,'bundle.js'),result.code);
  for (const name of fs.readdirSync(source)) {
    if (name.endsWith('.js')) continue;
    if (name === 'index.html') {
      const html = fs.readFileSync(path.join(source,name),'utf8')
        .replace(/<script src="(?:\.\.\/\.\.\/shared\/tv-motion|catalog|save-queue|main)\.js" defer><\/script>/g,'')
        .replace('</head>','<script src="bundle.js" defer></script>\n</head>');
      fs.writeFileSync(path.join(out,name),html);
    } else fs.copyFileSync(path.join(source,name),path.join(out,name));
  }
  console.log('Browser bundle: '+Buffer.byteLength(result.code)+' bytes');
}
build().catch(error=>{console.error(error);process.exitCode=1});
