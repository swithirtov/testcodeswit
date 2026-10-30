(()=>{
let autoConfig=null,autoMapping=null,autoLearn=false;
let mapping=null, learnStep=-1, learned=[],selector='',timer, picking=false, highlighted=null,tip=null,shield=null;
const send=msg=>chrome.runtime.sendMessage(msg).catch(()=>{});
const norm=t=>(t||'').replace(/\s+/g,' ').trim();
const shown=e=>e && e.getClientRects().length>0;
function count(e){const badge=e.querySelector?.('[data-marker*="unread"]');const text=norm(badge?.textContent)||norm(e.textContent)||e.getAttribute('aria-label')||'';const n=text.match(/^\s*(\d+)\+?\s*$/) || text.match(/^(\d+)\s+непрочитан/i) || text.match(/^(?:Сообщения|Непрочитанные)\s*(\d+)\+?$/i);return n?Math.min(100000,Number(n[0])):null;}

function relative(el,root){
 const parts=[];while(el!==root && el?.parentElement){const peers=[...el.parentElement.children].filter(x=>x.tagName===el.tagName);parts.unshift(el.tagName.toLowerCase()+':nth-of-type('+(peers.indexOf(el)+1)+')');el=el.parentElement;}return parts.length?':scope > '+parts.join(' > '):':scope';
}
function chatInfo(row, fields){
 const get=(key,fallback)=>{try{return row.querySelector(fields?.[key]||fallback);}catch{return null;}};
 const name=norm(get('name','[data-marker*="interlocutor"], [data-marker*="participant"], [data-marker*="user-name"], [data-marker*="userName"], [data-marker*="channel-title"], [data-marker*="channel/name"]')?.textContent).slice(0,120);
 const preview=norm(get('preview','[data-marker*="last-message"], [data-marker*="lastMessage"], [data-marker*="preview"]')?.textContent).slice(0,700);
 const title=norm(row.querySelector('[data-marker*="item-title"], [data-marker*="itemTitle"]')?.textContent).slice(0,160);
 const a=row.matches('a[href*="messenger"]')?row:row.querySelector('a[href*="messenger"]');
 let url='';if(a){try{const u=new URL(a.getAttribute('href'),location.origin);if(['avito.ru','www.avito.ru'].includes(u.hostname) && /messenger/.test(u.pathname))url=u.href;}catch{}}
 const id=url||row.getAttribute('data-id')||row.getAttribute('data-channel-id')||(name?name+'|'+title:'');
 return {name,preview,title,url,id};
}
function richSnapshot(){
 let candidates=[];
 if(mapping){try{candidates=[...document.querySelectorAll(mapping.row)];}catch{}}
 else {
  for(const b of document.querySelectorAll('[data-marker*="unread"]')){
   const row=b.closest('[data-marker*="channel"], [data-marker*="conversation"], [data-marker*="chat-item"], [data-marker*="dialog"]');
   // Badge itself may contain "channel"; require separate name + preview within row.
   if(row && !candidates.includes(row))candidates.push(row);
  }
 }
 const rows={},messages=[];
 for(const row of candidates){
  let badge;try{badge=row.querySelector(mapping?.badge||'[data-marker*="unread"]');}catch{}
  if(!shown(row)||!shown(badge))continue;
  if(mapping?.badgeKind==='red' && !WatchPicker.unreadDot(badge,getComputedStyle))continue;
  const info=chatInfo(row,mapping);
  if(!info.id||!info.name||!info.preview)continue;
  rows[info.id]=JSON.stringify([info.name,info.preview,count(badge)]);
  messages.push(info);
 }
 if(messages.length)return {found:true,count:messages.length,rows,messages,mode:'details',details:'Имена и превью распознаны: '+messages.length+' диалогов'};
 // A known mapped list with rows but no unread badges is a confirmed zero.
 if(mapping && candidates.some(shown) && candidates.every(r=>{try{const b=r.querySelector(mapping.badge);return !shown(b)||(mapping.badgeKind==='red' && !WatchPicker.unreadDot(b,getComputedStyle));}catch{return false;}}))return {found:true,count:0,rows:{},messages:[],mode:'details',details:'Список чатов распознан, непрочитанных не видно'};
 return null;
}
function inspect(){
  if(picking)return;
  checkAuto();
  const rich=richSnapshot();if(rich){send({type:'snapshot',snapshot:rich});return;}
  let snap={found:false,count:0,rows:{},mode:selector?'manual:'+selector:'auto',details:'Счётчик не распознан. Открой список сообщений или выбери счётчик вручную.'};
  if(selector){
    let e;try{e=document.querySelector(selector);}catch{}
    const n=shown(e)?(count(e) ?? 0):null;
    if(shown(e) && n!==null)snap={...snap,found:true,count:n,details:'Выбранный счётчик найден'};
    else snap.details='Выбранный счётчик сейчас не виден. При нуле он может исчезать; следующее появление будет проверено.';
  }else{
    // Conservative hypotheses, not a claim about Avito's current markup.
    const nodes=[...document.querySelectorAll('[data-marker]')];
    const badges=nodes.filter(e=>shown(e)&&/unread/i.test(e.getAttribute('data-marker')||''));
    const rows={};
    for(const b of badges){
      const row=b.closest('[data-marker*="channel"], [data-marker*="conversation"], [data-marker*="chat-item"], [data-marker*="dialog"]');
      if(!row)continue;
      const a=row.matches('a[href]')?row:row.querySelector('a[href]');
      const id=a?.getAttribute('href') || row.getAttribute('data-id') || row.id;
      const preview=row.querySelector('[data-marker*="last-message"], [data-marker*="lastMessage"], [data-marker*="preview"]');
      if(id)rows[id]=norm(preview?.textContent)||String(count(b)||1);
    }
    if(Object.keys(rows).length)snap={...snap,found:true,count:Object.keys(rows).length,rows,mode:'rows',details:'Найдены непрочитанные диалоги: '+Object.keys(rows).length};
    else{
      const candidates=badges.filter(e=>count(e)!==null);
      const badge=candidates.find(e=>e.closest('header,nav,[data-marker*="header"]'))||candidates[0];
      if(badge)snap={...snap,found:true,count:count(badge),mode:'counter',details:'Найден счётчик непрочитанных. Если число неверное — выбери вручную.'};
      else {const link=document.querySelector('header a[href*="messenger"], [data-marker*="header"] a[href*="messenger"]');if(shown(link) && count(link)===null)snap={...snap,found:true,count:0,mode:'counter',details:'Ссылка сообщений видна, числового счётчика нет'};}
    }
  }
  send({type:'snapshot',snapshot:snap});
}
function cssPath(el){
  const marker=el.getAttribute('data-marker');
  if(marker){const s='[data-marker="'+CSS.escape(marker)+'"]';if(document.querySelectorAll(s).length===1)return s;}
  if(el.id)return '#'+CSS.escape(el.id);
  const parts=[];
  while(el && el!==document.body){let part=el.tagName.toLowerCase();const siblings=[...el.parentElement.children].filter(e=>e.tagName===el.tagName);if(siblings.length>1)part+=':nth-of-type('+(siblings.indexOf(el)+1)+')';parts.unshift(part);el=el.parentElement;}
  return 'body > '+parts.join(' > ');
}

function checkAuto(){
 if(!autoConfig?.enabled || !autoMapping)return;
 const st=WatchAuto.incoming(autoMapping);
 if(st.ok)send({type:'autoSnapshot',snapshot:{route:autoMapping.route,name:autoMapping.name,count:st.count,fingerprint:st.fingerprint,last:st.last}});
 else send({type:'autoStatus',reason:st.reason});
}
function saveAuto(){
 const [header,incoming,editor,button]=learned;
 const field=editor.closest('textarea,input,[contenteditable="true"]')||editor;
 const sendButton=button.closest('button,[role="button"]')||button;
 const spec=WatchAuto.reusable(incoming,cssPath);
 autoMapping={route:location.pathname+location.search,name:norm(header.textContent),header:cssPath(header),incoming:spec.selector,incomingRule:spec.visual||null,editor:cssPath(field),button:cssPath(sendButton)};
 stop();send({type:'autoMapping',mapping:autoMapping});
 alert(spec.direction?'Тестовый чат настроен. Включи автоответ в настройках расширения.':'Чат настроен для черновика. Направление сообщений не распознано — автоматическая отправка заблокирована.');
}
function targetAt(e){
 const candidates=[...document.querySelectorAll('body *')].filter(x=>x!==shield && x!==tip && !tip?.contains(x));
 return WatchPicker.atPoint(candidates,e.clientX,e.clientY,shield);
}
function move(e){if(highlighted)highlighted.style.outline=highlighted.dataset.watchOldOutline||'';highlighted=targetAt(e);if(!highlighted || highlighted===tip)return;highlighted.dataset.watchOldOutline=highlighted.style.outline;highlighted.style.outline='3px solid #a78bfa';}
function stop(){picking=false;autoLearn=false;learnStep=-1;learned=[];if(highlighted){highlighted.style.outline=highlighted.dataset.watchOldOutline||'';delete highlighted.dataset.watchOldOutline;}tip?.remove();shield?.remove();shield=null;document.removeEventListener('mousemove',move,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',key,true);}
function click(e){e.preventDefault();e.stopImmediatePropagation();if(e.target===tip)return;const target=targetAt(e);if(!target)return;
 if(autoLearn){
  learned.push(target);learnStep++;
  const steps=['','Нажми на ТЕКСТ входящего сообщения от собеседника.','Нажми на ПОЛЕ, куда ты вводишь ответ.','Нажми на КНОПКУ отправки (сообщение не отправится).'];
  if(learnStep<4){tip.textContent=steps[learnStep];return;}
  saveAuto();return;
 }
 if(learnStep>=0){
  learned.push(target);learnStep++;
  if(learnStep===1){tip.textContent='Теперь нажми на текст последнего сообщения В ЭТОМ ЖЕ непрочитанном чате.';return;}
  if(learnStep===2){tip.textContent='Теперь нажми на значок/число непрочитанных В ЭТОМ ЖЕ чате.';return;}
  let row=learned[0];while(row && !learned.every(x=>row.contains(x)))row=row.parentElement;
  if(!row || row===document.body || norm(row.textContent).length>2500){stop();alert('Не удалось выделить одну строку. Повтори настройку, выбирая элементы одного чата.');return;}
  const marker=row.getAttribute('data-marker');let rowSelector;
  if(marker && document.querySelectorAll('[data-marker="'+CSS.escape(marker)+'"]').length>1)rowSelector='[data-marker="'+CSS.escape(marker)+'"]';
  else rowSelector=cssPath(row.parentElement)+' > '+row.tagName.toLowerCase();
  mapping={row:rowSelector,name:relative(learned[0],row),preview:relative(learned[1],row),badge:relative(learned[2],row),badgeKind:WatchPicker.unreadDot(learned[2],getComputedStyle)?'red':'marker'};
  stop();send({type:'mapping',mapping});setTimeout(inspect,300);return;
 }
 const n=count(target);if(n===null){tip.textContent='Нужно нажать именно на число непрочитанных. Esc — отмена.';return;}const link=target.closest('a[href*="messenger"], [data-marker*="header"] a, [data-marker*="header"] button');selector=cssPath(link||target);stop();send({type:'picked',selector});setTimeout(inspect,300);}
function key(e){if(e.key==='Escape')stop();}
function pick(details=false,auto=false){if(picking)stop();autoLearn=auto;learnStep=(details||auto)?0:-1;learned=[];picking=true;tip=document.createElement('div');tip.textContent=auto?'Открой нужный чат заранее. Нажми на ИМЯ собеседника в заголовке чата.':details?'Нажми на ИМЯ отправителя в непрочитанном чате. Esc — отмена.':'Нажми на число непрочитанных сообщений. Esc — отмена.';tip.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#251b40;color:white;padding:18px 24px;border:1px solid #a78bfa;border-radius:14px;z-index:2147483647;font:16px sans-serif;box-shadow:0 8px 40px #0006';shield=document.createElement('div');shield.style.cssText='position:fixed;inset:0;z-index:2147483646;background:transparent;cursor:crosshair;';document.body.append(shield,tip);document.addEventListener('mousemove',move,true);document.addEventListener('click',click,true);document.addEventListener('keydown',key,true);}
chrome.runtime.onMessage.addListener(msg=>{if(msg.type==='pickAuto')pick(false,true);if(msg.type==='autoExecute'){WatchAuto.fill(autoMapping,msg.text,msg.send).then(reply=>send({type:'autoResult',...reply})).catch(e=>send({type:'autoResult',status:'error',reason:e.message}));}if(msg.type==='pick')pick();if(msg.type==='pickDetails')pick(true);if(msg.type==='scan')chrome.runtime.sendMessage({type:'getSelector'},s=>{selector=s?.selector||'';mapping=s?.mapping||null;autoMapping=s?.autoMapping||null;autoConfig=s?.autoConfig||null;inspect();});});
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(inspect,700);}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-marker','aria-label']});
chrome.runtime.sendMessage({type:'getSelector'},s=>{selector=s?.selector||'';mapping=s?.mapping||null;autoMapping=s?.autoMapping||null;autoConfig=s?.autoConfig||null;inspect();});
})();
