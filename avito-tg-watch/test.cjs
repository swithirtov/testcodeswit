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
const sandbox={chrome,URL,AbortSignal,console,Date,WatchDetector:{transition},WatchFormat:require('./format.js'),importScripts:no,fetch:async()=>{calls++;return {ok:!fail,status:fail?503:200,json:async()=>({ok:!fail})}}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(__dirname+'/background.js','utf8'),sandbox);
async function snap(n){onMessage({type:'snapshot',snapshot:{...s(n),found:true}},{tab:{id:1,url:'https://www.avito.ru/profile/messenger'}},no);await vm.runInContext('chain',sandbox);}
(async()=>{await snap(2);assert.equal(calls,1);await snap(2);assert.equal(calls,1);fail=true;await snap(3);assert.equal(calls,2);assert.equal(data.baseline.count,2);assert.ok(data.lastError);fail=false;await snap(3);assert.equal(calls,3);assert.equal(data.baseline.count,3);assert.equal(data.lastError,'');await snap(3);assert.equal(calls,3);console.log('PASS: 10 detector cases + worker deduplication, retry, credentials isolation');})().catch(e=>{console.error(e);process.exitCode=1});

const {format}=require('./format.js');
const f=format({name:'Иван <admin>',preview:'A & B <script>',url:'https://www.avito.ru/profile/messenger/123'},'https://www.avito.ru/profile/messenger');
assert.ok(f.text.includes('Иван &lt;admin&gt;'));assert.ok(f.text.includes('A &amp; B &lt;script&gt;'));assert.equal(f.reply_markup.inline_keyboard[0][0].text,'Открыть чат ↗');
assert.equal(format({name:'Иван'},'https://www.avito.ru/profile/messenger').reply_markup.inline_keyboard[0][0].text,'Открыть Авито ↗');
// Content extraction integration with a mapped chat list (no live Avito assumed).
{
 const row={getClientRects:()=>[{}],textContent:'Иван Привет 1',getAttribute:k=>k==='data-id'?'chat-42':null,matches:()=>false,querySelector:s=>s===':name'?{textContent:'Иван'}:s===':preview'?{textContent:'Привет, обложку сделаешь?'}:s===':badge'?{textContent:'1',getClientRects:()=>[{}]}:null};
 const sent=[];const doc={body:{},querySelectorAll:s=>s===':rows'?[row]:[],querySelector:()=>null};
 const context={document:doc,location:{origin:'https://www.avito.ru'},URL,CSS:{escape:s=>s},MutationObserver:class{observe(){}},setTimeout,clearTimeout,chrome:{runtime:{onMessage:{addListener:()=>{}},sendMessage:(msg,cb)=>{if(cb)cb({mapping:{row:':rows',name:':name',preview:':preview',badge:':badge'},selector:''});else sent.push(msg);return Promise.resolve();}}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/content.js','utf8'),context);
 assert.equal(sent[0].snapshot.messages[0].name,'Иван');
 assert.equal(sent[0].snapshot.messages[0].preview,'Привет, обложку сделаешь?');
 assert.equal(sent[0].snapshot.rows['chat-42'],JSON.stringify(['Иван','Привет, обложку сделаешь?',1]));
 console.log('PASS: mapped DOM name, preview, identity extraction + escaped Telegram HTML');
}
{
 const {atPoint,redDot}=require('./picker.js');
 const box=(left,top,width,height,extra={})=>({getBoundingClientRect:()=>({left,top,right:left+width,bottom:top+height,width,height}),...extra});
 const row=box(0,0,900,120),menu=box(745,60,40,40),dot=box(769,72,12,12,{pointerEvents:'none'}),shield=box(0,0,1400,900);
 assert.equal(atPoint([shield,row,menu,dot],775,78,shield),dot);
 assert.equal(redDot(dot,{backgroundColor:'rgb(255, 62, 90)'}),true);
 assert.equal(redDot(menu,{backgroundColor:'rgb(255, 255, 255)'}),false);
 assert.equal(atPoint([shield,row,menu,dot],800,110,shield),row);
 console.log('PASS: decorative dot selected beneath shield; menu rejected');
}

{
 const {unreadDot}=require('./picker.js');
 const el={getBoundingClientRect:()=>({width:14,height:14})};
 const style=(e,p)=>p==='::before'?{width:'12px',height:'12px',backgroundColor:'rgb(255, 64, 107)'}:{backgroundColor:'rgba(0, 0, 0, 0)'};
 assert.equal(unreadDot(el,style),true);
 assert.equal(unreadDot(el,()=>({width:'12px',height:'12px',backgroundColor:'color(srgb 1 0.25 0.42)'})),true);
 assert.equal(unreadDot(el,()=>({width:'12px',height:'12px',backgroundColor:'rgb(20, 20, 20)'})),false);
 assert.equal(unreadDot(el,()=>({width:'12px',height:'12px',backgroundColor:'rgb(255, 64, 107)',opacity:'0'})),false);
 console.log('PASS: CSS pseudo-element dot, sRGB color, hidden and non-red dots');
}
