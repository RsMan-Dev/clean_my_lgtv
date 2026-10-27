// Build both applications from their shared UI source and create installable IPKs.
const path=require('node:path');
const {spawnSync}=require('node:child_process');
function run(command,args,cwd) {
  const result=spawnSync(command,args,{cwd,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error('Build failed: '+command);
}
const cli=path.join(__dirname,'quick-settings/.tools/node_modules/.bin/ares-package');
try {
  for(const app of ['quick-settings','launcher']) {
    const cwd=path.join(__dirname,app);
    run(process.execPath,['build.cjs'],cwd);
    run(cli,app==='quick-settings'?['.build/app','service','-o','.']:['.build/app','-o','.'],cwd);
  }
} catch(error) { console.error(error);process.exitCode=1; }
