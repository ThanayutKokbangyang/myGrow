import{execFileSync}from'node:child_process';
import{mkdirSync,readFileSync,readdirSync,rmSync,statSync,writeFileSync}from'node:fs';
import{extname,join,relative,resolve}from'node:path';

const root=resolve('.'),staticDir=join(root,'.site-static'),dist=join(root,'dist');
rmSync(staticDir,{recursive:true,force:true});
rmSync(dist,{recursive:true,force:true});
execFileSync(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'build','--outDir',staticDir,'--emptyOutDir'],{stdio:'inherit'});
const files=[];const walk=dir=>{for(const name of readdirSync(dir)){const file=join(dir,name);statSync(file).isDirectory()?walk(file):files.push(file)}};walk(staticDir);
const assets={};for(const file of files){const path='/'+relative(staticDir,file).replaceAll('\\','/');assets[path]={data:readFileSync(file).toString('base64'),ext:extname(file).slice(1)}}
mkdirSync(join(dist,'server'),{recursive:true});mkdirSync(join(dist,'.openai'),{recursive:true});
writeFileSync(join(dist,'server/index.js'),`const STATIC_ASSETS=${JSON.stringify(assets)};\n${readFileSync(join(root,'worker/index.js'),'utf8')}`);
console.log(`Built Worker with ${files.length} embedded assets`);
