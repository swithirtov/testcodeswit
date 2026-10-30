const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {advance}=require('./detector.js');
const s=(count,epoch='page')=>({count,epoch,found:true});
assert.equal(advance(null,s(29)).notify,false);
assert.equal(advance(s(29),s(29)).notify,false);
assert.equal(advance(s(29),s(30)).notify,true);
assert.equal(advance(s(29),s(0)).notify,false);
assert.equal(advance(s(29),s(30,'reload')).notify,false);
let now=100000,listener,calls=[];const data={settings:{enabled:true,desktop:false,token:'123:test',chatId:'42'}};
const event={addListener:()=>{}};
const chrome={storage:{local:{setAccessLevel:async()=>{},get:async keys=>typeof keys==='string'?{[keys]:data[keys]}:Object.fromEntries(keys.map(k=>[k,data[k]])),set:async v=>Object.assign(data,v),remove:async()=>{}}},alarms:{get:async()=>true,onAlarm:event},runtime:{onInstalled:event,onStartup:event,onMessage:{addListener:f=>listener=f}},notifications:{onClicked:event},tabs:{get:async()=>({})}};
const scope={chrome,importScripts:()=>{},WatchDetector:{advance},Date:class extends Date{static now(){return now;}},AbortSignal,fetch:async(url,opts)=>{calls.push(JSON.parse(opts.body));return {ok:true,json:async()=>({ok:true})}}};vm.createContext(scope);vm.runInContext(fs.readFileSync(__dirname+'/background.js','utf8'),scope);
async function snap(n,epoch='page'){listener({type:'counterSnapshot',snapshot:s(n,epoch)},{tab:{id:1}},()=>{});await vm.runInContext('chain',scope);}
(async()=>{
 await snap(29);assert.equal(calls.length,0);
 await snap(30);assert.equal(calls.length,1);
 for(let i=0;i<50;i++){await snap(29);await snap(30);now+=10;}
 assert.equal(calls.length,1);
 listener({type:'snapshot',snapshot:{count:99,mode:'details',rows:{a:'MY MESSAGE'},messages:[{preview:'MY MESSAGE'}]}},{tab:{id:1}},()=>{});
 listener({type:'autoSnapshot',snapshot:{count:100}},{tab:{id:1}},()=>{});
 await vm.runInContext('chain',scope);assert.equal(calls.length,1);
 now+=61000;await snap(31);assert.equal(calls.length,2);
 await snap(99,'reload');assert.equal(calls.length,2);
 assert.ok(!JSON.stringify(calls).includes('MY MESSAGE'));
 console.log('PASS: quiet startup/reload, no repeats, 100 oscillations rate-limited, old text and auto events ignored');
})().catch(e=>{console.error(e);process.exitCode=1});
