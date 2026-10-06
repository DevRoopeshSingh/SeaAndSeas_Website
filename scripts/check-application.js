'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const crypto=require('node:crypto');
process.chdir(path.resolve(__dirname,'..'));
function run(command,args){
  const r=spawnSync(command,args,{encoding:'utf8'});
  if(r.error||r.status!==0)throw new Error(r.error?.message||r.stderr||r.stdout||command+' failed');
}
function files(dir,extension){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name),extension):e.name.endsWith(extension)?[path.join(dir,e.name)]:[]);
}
try{
  const php=[...fs.readdirSync('.').filter(f=>f.endsWith('.php')),...files('includes','.php'),...files('scripts','.php'),...files('phpmailer','.php')];
  for(const f of php)run('php',['-l',f]);
  const js=[...files('js','.js'),...files('scripts','.js'),...files('tests','.js'),...files('lib','.js')];
  for(const f of js)run(process.execPath,['--check',f]);
  console.log(`Syntax OK: ${php.length} PHP and ${js.length} JavaScript files.`);
  if(process.argv.includes('--build')){
    const schema=JSON.parse(fs.readFileSync('js/application-schema.json','utf8'));
    const html=fs.readFileSync('apply.html','utf8');
    const names=new Set([...html.matchAll(/\bname=["']([^"']+)["']/g)].map(m=>m[1]));
    for(const key of Object.keys(schema.fields))if(!names.has(key))throw new Error('Missing online field: '+key);
    if(crypto.createHash('sha256').update(fs.readFileSync(schema.template)).digest('hex')!==schema.sha256)throw new Error('Template fingerprint mismatch.');
    run('php',['scripts/application-preflight.php','--template-only']);
    for(const f of ['submit_application.php','api.php','download_application.php','migrations/001_applications.sql','.htaccess','web.config'])if(!fs.existsSync(f))throw new Error('Missing deployment file: '+f);
    console.log(`Static deployment checks OK: ${Object.keys(schema.fields).length} scalar fields, ${Object.keys(schema.repeats).length} repeat groups, pinned DOCX. No bundling or TypeScript compilation is needed.`);
  }
}catch(e){console.error(e.message);process.exitCode=1;}
