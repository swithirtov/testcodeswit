importScripts('detector.js','format.js');
let chain=Promise.resolve();
async function init(){
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  if(!await chrome.alarms.get('scan')) await chrome.alarms.create('scan',{periodInMinutes:0.5});
}
init().catch(()=>{});
chrome.runtime.onInstalled.addListener(async()=>{await chrome.storage.local.set({baseline:null,baselines:{}});await init();});
chrome.runtime.onStartup.addListener(()=>init());
async function settings(){return (await chrome.storage.local.get('settings')).settings || {enabled:false,desktop:true};}
function safeUrl(raw){try{const u=new URL(raw);if(u.protocol==='https:' && ['www.avito.ru','avito.ru'].includes(u.hostname))return u.href;}catch{}return 'https://www.avito.ru/profile/messenger';}
async function telegram(cfg,text){
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(cfg.token || ''))throw Error('Проверь токен бота');
  if(!/^-?\d+$/.test(cfg.chatId || ''))throw Error('Проверь числовой Chat ID');
  let r;
  try {r=await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:cfg.chatId,...(typeof text==='string'?{text}:text),link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(12000)});}catch{throw Error('Telegram недоступен. Проверь интернет или VPN.');}
  const data=await r.json();
  if(!r.ok || !data.ok)throw Error(data.error_code===401?'Telegram: неверный токен':data.error_code===403?'Telegram: бот заблокирован — нажми /start':data.error_code===400?'Telegram: проверь Chat ID и нажми /start у бота':`Telegram: ошибка ${r.status}`);
}
async function desktop(text,url){
  const id='avito-'+Date.now();
  await chrome.notifications.create(id,{type:'basic',iconUrl:'icon.png',title:'Новое на Авито',message:text,priority:2});
  await chrome.storage.local.set({['notice:'+id]:url});
}
chrome.notifications.onClicked.addListener(async id=>{const key='notice:'+id;const s=await chrome.storage.local.get(key);await chrome.tabs.create({url:safeUrl(s[key])});await chrome.storage.local.remove(key);chrome.notifications.clear(id);});
chrome.notifications.onClosed.addListener(id=>chrome.storage.local.remove('notice:'+id));
async function snapshot(msg,sender){
  const cfg=await settings();const tab=sender.tab;if(!tab)return;
  const snap=msg.snapshot;
  if(!snap || !Number.isFinite(snap.count) || snap.count<0 || snap.count>100000)return;
  const status={at:Date.now(),tabId:tab.id,mode:snap.mode,found:snap.found,count:snap.count,details:String(snap.details || '').slice(0,300)};
  await chrome.storage.local.set({status});
  if(!cfg.enabled || !snap.found)return;
  const saved=await chrome.storage.local.get(['monitorTab','baseline','baselines']);
  // One tab only: avoids conflicts between a header counter and messenger rows.
  if(saved.monitorTab && saved.monitorTab!==tab.id){try{await chrome.tabs.get(saved.monitorTab);return;}catch{}}
  if(saved.monitorTab!==tab.id)await chrome.storage.local.set({monitorTab:tab.id});
  const previous=saved.baselines?.[snap.mode] || (saved.baseline?.mode===snap.mode?saved.baseline:null);
  const result=WatchDetector.transition(previous,snap);
  async function remember(state){await chrome.storage.local.set({baseline:state,baselines:{...(saved.baselines||{}),[snap.mode]:state}});}
  if(!result.notify){await remember(result.state);return;}
  const url=safeUrl(tab.url);const text=`Авито: есть непрочитанные сообщения (${snap.count}).\nОткрой переписку:\n${url}`;
  // Retry failed Telegram delivery on the next scan; commit only after success.
  try{
    if(cfg.token && cfg.chatId){
      const changed=(snap.messages||[]).filter(m=>m.id && result.state.rows[m.id]!==previous?.rows?.[m.id]);
      if(changed.length){
        const progress={...result.state,rows:{...(previous?.rows||{})}};
        for(const raw of changed.slice(0,20)){
          const info={name:String(raw.name||'').slice(0,120),preview:String(raw.preview||'').slice(0,700),title:String(raw.title||'').slice(0,160),url:raw.url?safeUrl(raw.url):''};
          await telegram(cfg,WatchFormat.format(info,url));
          progress.rows[raw.id]=result.state.rows[raw.id];
          await remember(progress);
        }
        // Keep remaining unseen rows pending if more than 20 arrived together.
        if(changed.length>20){await chrome.storage.local.set({lastSent:Date.now(),lastError:''});return;}
      }else await telegram(cfg,{text:`🔔 <b>Авито · непрочитанные сообщения</b>\n\nНепрочитанных: <b>${snap.count}</b>\n\n<i>Имя и текст не распознаны. Открой список чатов и нажми «Настроить имена» в расширении.</i>`,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:'Открыть Авито ↗',url}]]}});
    }
    else if(!cfg.desktop)throw Error('Укажи Telegram или включи уведомления Windows');
    if(cfg.desktop)await desktop(`Непрочитанных: ${snap.count}. Проверь переписку.`,url).catch(()=>{});
    await remember(result.state);
    await chrome.storage.local.set({lastSent:Date.now(),lastError:''});
  }catch(e){await chrome.storage.local.set({lastError:e.message});}
}
async function scanTabs(){
  const cfg=await settings();if(!cfg.enabled)return;
  const s=await chrome.storage.local.get('monitorTab');
  const tabs=await chrome.tabs.query({url:['https://www.avito.ru/*','https://avito.ru/*']});
  const tab=tabs.find(t=>t.id===s.monitorTab)||tabs.find(t=>/messenger/.test(t.url))||tabs[0];
  if(!tab){await chrome.storage.local.set({status:{at:Date.now(),found:false,details:'Нет открытой вкладки Авито'}});return;}
  try{await chrome.tabs.sendMessage(tab.id,{type:'scan'});}catch{await chrome.storage.local.set({lastError:'Обнови вкладку Авито после установки расширения. Если вкладка выгружена, открой её.'});}
}
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='scan')scanTabs();});
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  // Website scripts may submit snapshots, never read credentials or invoke tests.
  if(sender.tab){
    if(msg.type==='snapshot'){chain=chain.then(()=>snapshot(msg,sender)).catch(()=>{});}
    else if(msg.type==='picked'){chrome.storage.local.set({selector:msg.selector,baseline:null,baselines:{},monitorTab:sender.tab.id});}
    else if(msg.type==='mapping'){chrome.storage.local.set({mapping:msg.mapping,baseline:null,baselines:{},monitorTab:sender.tab.id});}
    else if(msg.type==='getSelector'){chrome.storage.local.get(['selector','mapping']).then(reply);return true;}
    return;
  }
  (async()=>{
    if(msg.type==='load')return await chrome.storage.local.get(['settings','status','lastSent','lastError','selector']);
    if(msg.type==='save'){
      const old=await settings();const cfg=msg.settings;
      if(cfg.enabled && ((cfg.token && !cfg.chatId)||(!cfg.token && cfg.chatId)))throw Error('Заполни и токен, и Chat ID');
      await chrome.storage.local.set({settings:cfg,lastError:''});
      if(!old.enabled && cfg.enabled)await chrome.storage.local.set({baseline:null,baselines:{}});
      await scanTabs();return {ok:true};
    }
    if(msg.type==='test'){await telegram(msg.settings,{text:'✅ <b>Авито → Telegram подключён</b>\n\nЭто тест отправки. Имя и текст появятся, когда расширение распознает непрочитанный чат.',parse_mode:'HTML'});return {ok:true};}
    if(msg.type==='scan'){await scanTabs();return {ok:true};}
    if(msg.type==='auto'){await chrome.storage.local.set({selector:'',mapping:null,baseline:null,baselines:{}});await scanTabs();return {ok:true};}
    if(msg.type==='pick'||msg.type==='pickDetails'){
      const tabs=await chrome.tabs.query({url:['https://www.avito.ru/*','https://avito.ru/*']});
      const tab=tabs.find(t=>t.active)||tabs.find(t=>/messenger/.test(t.url))||tabs[0];
      if(!tab)throw Error('Сначала открой Авито');
      await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});
      try{await chrome.tabs.sendMessage(tab.id,{type:msg.type});}catch{throw Error('Обнови вкладку Авито и попробуй снова');}return {ok:true};
    }
  })().then(reply).catch(e=>reply({error:e.message}));return true;
});
