// Regression: late responses must never cross an authentication boundary.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
const element = key => {if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',classList:{toggle(){}},querySelectorAll:()=>[]});return elements.get(key)};
const context = vm.createContext({console,URL,AbortSignal,setTimeout,window:{KNOWHOW_CONFIG:{}},document:{querySelector:element,querySelectorAll:()=>[]},fetch:null});
vm.runInContext(fs.readFileSync('app.js','utf8'),context);
const exec = code=>vm.runInContext(code,context);
(async()=>{
 let release;
 context.fetch=()=>new Promise(r=>release=r);
 exec("token='old-token'; user={name:'old',org:'old',role:'member'}");
 const late=exec("api('/api/docs').then(r=>{docs=r.docs;return 'applied'}).catch(e=>e.constructor.name)");
 exec("sessionGeneration++;token='';user=null;docs=[]");
 release({ok:true,json:async()=>({docs:[{name:'must not leak'}]})});
 assert.equal(await late,'StaleSessionError');assert.equal(exec('docs.length'),0);
 let jsonRelease;
 context.fetch=async()=>({ok:true,json:()=>new Promise(r=>jsonRelease=r)});
 const parsing=exec("api('/api/ask').catch(e=>e.constructor.name)");
 await new Promise(r=>setImmediate(r));
 exec('sessionGeneration++');jsonRelease({answer:'must not render'});
 assert.equal(await parsing,'StaleSessionError');
 let headers;
 context.fetch=async(url,options)=>{headers=options.headers;return {ok:true,json:async()=>({})}};
 exec("sessionGeneration++;token='';base='https://new.example'");await exec("api('/api/login',{name:'test'})");
 assert.equal(headers.Authorization,undefined);
 console.log('PASS: delayed response, delayed JSON, new-origin login has no old Bearer');
})().catch(e=>{console.error(e);process.exitCode=1});
