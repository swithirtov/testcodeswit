importScripts('detector.js');
let chain=Promise.resolve();
async function init(){
 await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
 if(!await chrome.alarms.get('scan'))await chrome.alarms.create('scan',{periodInMinutes:0.5});
}
init().catch(()=>{});
chrome.runtime.onInstalled.addListener(async()=>{
 const d=await chrome.storage.local.get('settings');const old=d.settings||{};
 await chrome.storage.local.set({settings:{enabled:false,token:old.token||'',chatId:old.chatId||'',desktop:old.desktop!==false},selector:'',zeroSelector:'',baseline:null,monitorTab:null,status:null,lastError:''});
 await chrome.storage.local.remove(['mapping','autoMapping','autoState','autoStatus','baselines']);await init();
});
chrome.runtime.onStartup.addListener(()=>init());
async function settings(){return (await chrome.storage.local.get('settings')).settings||{};}
async function telegram(cfg,text){
 if(!/^\d+:[A-Za-z0-9_-]+$/.test(cfg.token||''))throw Error('Проверь токен бота');
 if(!/^-?\d+$/.test(cfg.chatId||''))throw Error('Проверь Chat ID');
 let r;try{r=await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:cfg.chatId,text,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:'Открыть Авито ↗',url:'https://www.avito.ru/profile/messenger'}]]},link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(10000)});}catch{throw Error('Telegram недоступен. Проверь интернет.');}
 const d=await r.json();if(!r.ok||!d.ok)throw Error('Telegram: проверь токен, Chat ID и /start у своего бота');
}
async function snapshot(msg,sender){
 const cfg=await settings();if(!cfg.enabled||!sender.tab)return;
 const d=await chrome.storage.local.get(['baseline','monitorTab','lastAttempt']);
 if(d.monitorTab && d.monitorTab!==sender.tab.id){try{await chrome.tabs.get(d.monitorTab);return;}catch{}}
 const s=msg.snapshot;if(!s||typeof s.epoch!=='string')return;
 await chrome.storage.local.set({monitorTab:sender.tab.id,status:{found:s.found,count:s.count,at:Date.now(),details:s.details}});
 if(!s.found || !Number.isInteger(s.count)||s.count<0||s.count>99999)return;
 const result=WatchDetector.advance(d.baseline,s);
 if(!result.notify){await chrome.storage.local.set({baseline:result.state});return;}
 if(d.lastAttempt && Date.now()-d.lastAttempt<60000){await chrome.storage.local.set({baseline:result.state});return;}
 await chrome.storage.local.set({lastAttempt:Date.now()});
 try{
  if(cfg.token&&cfg.chatId)await telegram(cfg,`🔔 <b>Новые непрочитанные · Авито</b>\n\nСчётчик вырос: <b>${d.baseline.count} → ${s.count}</b>`);
  else if(!cfg.desktop)throw Error('Укажи Telegram или включи уведомления Windows');
  if(cfg.desktop)await chrome.notifications.create('avito',{type:'basic',iconUrl:'icon.png',title:'Непрочитанные на Авито',message:`Счётчик вырос: ${d.baseline.count} → ${s.count}`}).catch(()=>{});
  await chrome.storage.local.set({baseline:result.state,lastSent:Date.now(),lastError:''});
 }catch(e){await chrome.storage.local.set({lastError:e.message});}
}
chrome.notifications.onClicked.addListener(()=>chrome.tabs.create({url:'https://www.avito.ru/profile/messenger'}));
async function scan(){
 if(!(await settings()).enabled)return;
 const d=await chrome.storage.local.get('monitorTab');const tabs=await chrome.tabs.query({url:['https://www.avito.ru/*','https://avito.ru/*']});
 const tab=tabs.find(t=>t.id===d.monitorTab)||tabs.find(t=>/messenger/.test(t.url))||tabs[0];
 if(!tab){await chrome.storage.local.set({lastError:'Открой Авито'});return;}
 try{await chrome.tabs.sendMessage(tab.id,{type:'scan'});}catch{await chrome.storage.local.set({lastError:'Обнови вкладку Авито после обновления расширения'});}
}
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='scan')scan();});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(sender.tab){
  // Old rich-message and auto-reply events are deliberately not supported.
  if(msg.type==='counterSnapshot')chain=chain.then(()=>snapshot(msg,sender)).catch(()=>{});
  else if(msg.type==='getCounter'){chrome.storage.local.get(['selector','zeroSelector']).then(reply);return true;}
  else if(msg.type==='counterPicked'){chrome.storage.local.set({selector:String(msg.selector),zeroSelector:String(msg.zeroSelector||''),baseline:null,monitorTab:sender.tab.id});}
  return;
 }
 (async()=>{
  if(msg.type==='load')return chrome.storage.local.get(['settings','status','lastSent','lastError','selector']);
  if(msg.type==='save'){
   const c=msg.settings;if(c.enabled && (!!c.token!==!!c.chatId))throw Error('Заполни оба поля Telegram или оставь оба пустыми');
   const old=await settings();await chrome.storage.local.set({settings:{enabled:!!c.enabled,desktop:!!c.desktop,token:String(c.token||''),chatId:String(c.chatId||'')},lastError:''});
   if(!old.enabled && c.enabled)await chrome.storage.local.set({baseline:null});
   await scan();return {ok:true};
  }
  if(msg.type==='test'){await telegram(msg.settings,'✅ <b>Уведомления Авито подключены</b>\n\nЭто тест. Расширение следит только за выбранным числом непрочитанных.');return {ok:true};}
  if(msg.type==='scan'){await scan();return {ok:true};}
  if(msg.type==='pick'){
   const tabs=await chrome.tabs.query({url:['https://www.avito.ru/*','https://avito.ru/*']});const tab=tabs.find(t=>t.active)||tabs.find(t=>/messenger/.test(t.url))||tabs[0];
   if(!tab)throw Error('Открой Авито');await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});
   await chrome.tabs.sendMessage(tab.id,{type:'pickCounter'});return {ok:true};
  }
 })().then(reply).catch(e=>reply({error:e.message}));return true;
});
