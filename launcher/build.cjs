// Both TV apps bundle the same source module; no runtime dependency or network.
const fs = require('node:fs');
const path = require('node:path');
const {minify} = require('../quick-settings/.tools/node_modules/@webos-tools/cli/node_modules/terser');
async function build() {
  const source=path.join(__dirname,'app'), out=path.join(__dirname,'.build/app');
  fs.mkdirSync(out,{recursive:true});
  const result=await minify({
    'tv-motion.js':fs.readFileSync(path.join(__dirname,'../shared/tv-motion.js'),'utf8'),
    'main.js':fs.readFileSync(path.join(source,'main.js'),'utf8')
  },{ecma:2020,compress:{passes:2},mangle:true,format:{comments:false}});
  if(!result.code)throw Error('Empty launcher bundle');
  fs.writeFileSync(path.join(out,'bundle.js'),result.code);
  for(const name of fs.readdirSync(source)) {
    if(name.endsWith('.js'))continue;
    if(name==='index.html') {
      const html=fs.readFileSync(path.join(source,name),'utf8')
        .replace(/<script src="(?:\.\.\/\.\.\/shared\/tv-motion|main)\.js" defer><\/script>/g,'')
        .replace('</head>','<script src="bundle.js" defer></script>\n</head>');
      fs.writeFileSync(path.join(out,name),html);
    } else fs.copyFileSync(path.join(source,name),path.join(out,name));
  }
  console.log('Launcher bundle: '+Buffer.byteLength(result.code)+' bytes');
}
build().catch(error=>{console.error(error);process.exitCode=1;});
