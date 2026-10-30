const assert=require('node:assert/strict');
const {transition}=require('./detector.js');
const s=(count,rows={},mode='counter')=>({count,rows,mode});
assert.equal(transition(null,s(0)).notify,false);
assert.equal(transition(null,s(2)).notify,true);
let a=transition(null,s(2)).state;
assert.equal(transition(a,s(2)).notify,false);
assert.equal(transition(a,s(3)).notify,true);
assert.equal(transition(a,s(0)).notify,false);
a=transition(a,s(0)).state;
assert.equal(transition(a,s(2)).notify,true);
a=transition(null,s(1,{chat:'a'},'rows')).state;
assert.equal(transition(a,s(1,{chat:'a'},'rows')).notify,false);
assert.equal(transition(a,s(1,{chat:'b'},'rows')).notify,true);
assert.equal(transition(a,s(1,{newChat:'a'},'rows')).notify,true);
// Worker integration: credential isolation, deduplication and Telegram retry.
const fs=require('node:fs'), vm=require('node:vm');
const data={settings:{enabled:true,desktop:false,token:'123:fake_test_token',chatId:'42'}};
let onMessage,calls=0,fail=false;
const no=()=>{};const event={addListener:no};
const chrome={storage:{local:{setAccessLevel:async v=>assert.equal(v.accessLevel,'TRUSTED_CONTEXTS'),get:async keys=>typeof keys==='string'?{[keys]:data[keys]}:Object.fromEntries(keys.map(k=>[k,data[k]])),set:async v=>Object.assign(data,v),remove:async k=>{delete data[k]}}},alarms:{get:async()=>true,create:async()=>{},onAlarm:event},runtime:{onInstalled:event,onStartup:event,onMessage:{addListener:f=>onMessage=f}},notifications:{onClicked:event,onClosed:event,create:async()=>{},clear:no},tabs:{get:async()=>({id:1}),query:async()=>[],sendMessage:async()=>{},create:no},windows:{update:no}};
const sandbox={chrome,URL,AbortSignal,console,Date,WatchDetector:{transition},importScripts:no,fetch:async()=>{calls++;return {ok:!fail,status:fail?503:200,json:async()=>({ok:!fail})}}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(__dirname+'/background.js','utf8'),sandbox);
async function snap(n){onMessage({type:'snapshot',snapshot:{...s(n),found:true}},{tab:{id:1,url:'https://www.avito.ru/profile/messenger'}},no);await vm.runInContext('chain',sandbox);}
(async()=>{await snap(2);assert.equal(calls,1);await snap(2);assert.equal(calls,1);fail=true;await snap(3);assert.equal(calls,2);assert.equal(data.baseline.count,2);assert.ok(data.lastError);fail=false;await snap(3);assert.equal(calls,3);assert.equal(data.baseline.count,3);assert.equal(data.lastError,'');await snap(3);assert.equal(calls,3);console.log('PASS: 10 detector cases + worker deduplication, retry, credentials isolation');})().catch(e=>{console.error(e);process.exitCode=1});
