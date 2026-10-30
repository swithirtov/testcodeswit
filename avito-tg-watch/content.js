(()=>{
const epoch=Date.now()+'-'+Math.random();let selector='',zeroSelector='',shield,tip,highlight,picking=false,dead=false,observer,timer;
const visible=e=>e&&e.getClientRects().length>0;
const number=e=>{const t=(e?.textContent||'').trim();return /^\d+\+?$/.test(t)?Number(t.replace('+','')):null;};
function restore(){if(highlight){highlight.style.outline=highlight.dataset.avitoWatchOutline||'';delete highlight.dataset.avitoWatchOutline;}highlight=null;}
function stop(){picking=false;restore();shield?.remove();tip?.remove();shield=tip=null;document.removeEventListener('mousemove',move,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',key,true);}
function invalid(){dead=true;clearTimeout(timer);observer?.disconnect();stop();}
function send(msg){if(dead)return;try{if(!chrome.runtime.id){invalid();return;}chrome.runtime.sendMessage(msg).catch(()=>invalid());}catch{invalid();}}
function path(el){const marker=el.getAttribute('data-marker');if(marker){const s='[data-marker="'+CSS.escape(marker)+'"]';if(document.querySelectorAll(s).length===1)return s;}if(el.id)return '#'+CSS.escape(el.id);const parts=[];while(el&&el!==document.body){const siblings=[...el.parentElement.children].filter(n=>n.tagName===el.tagName);parts.unshift(el.tagName.toLowerCase()+':nth-of-type('+(siblings.indexOf(el)+1)+')');el=el.parentElement;}return 'body > '+parts.join(' > ');}
function scan(){
 if(dead||picking)return;
 let found=false,count=null,details='Выбери общий числовой счётчик сообщений. Красный кружок отдельного чата не подходит.';
 if(selector){let e;try{e=document.querySelector(selector);}catch{}
  if(visible(e)){count=number(e);found=count!==null;details=found?'Выбранный числовой счётчик найден':'Выбранный элемент перестал быть числом — повтори выбор';}
  else if(zeroSelector){let parent;try{parent=document.querySelector(zeroSelector);}catch{}if(visible(parent)){found=true;count=0;details='Раздел сообщений виден, счётчик отсутствует: 0';}}
  else details='Счётчик сейчас отсутствует. Ноль не предполагаю, чтобы не слать ложные повторы.';
 }
 send({type:'counterSnapshot',snapshot:{epoch,found,count,details}});
}
function target(e){return WatchPicker.atPoint([...document.querySelectorAll('body *')].filter(x=>x!==shield&&x!==tip&&!tip?.contains(x)),e.clientX,e.clientY,shield);}
function move(e){restore();highlight=target(e);if(highlight){highlight.dataset.avitoWatchOutline=highlight.style.outline;highlight.style.outline='2px solid #b89aff';}}
function click(e){e.preventDefault();e.stopImmediatePropagation();if(e.target===tip)return;const el=target(e);if(!el||number(el)===null){tip.textContent='Нажми на ЧИСЛО непрочитанных в разделе сообщений, не на кружок и не на текст.';return;}
 selector=path(el);const anchor=el.closest('a[href*="messenger"], [data-marker*="messenger"]');zeroSelector=anchor&&anchor!==el?path(anchor):'';
 stop();send({type:'counterPicked',selector,zeroSelector});setTimeout(scan,500);
}
function key(e){if(e.key==='Escape')stop();}
function pick(){stop();picking=true;shield=document.createElement('div');shield.style.cssText='position:fixed;inset:0;z-index:2147483646;cursor:crosshair;background:transparent';tip=document.createElement('div');tip.textContent='Выбери ОБЩЕЕ ЧИСЛО непрочитанных сообщений. Не колокольчик уведомлений и не кружок отдельного чата. Esc — отмена.';tip.style.cssText='position:fixed;top:12px;left:10%;right:10%;z-index:2147483647;background:#251b40;color:white;padding:18px;border-radius:14px;font:15px sans-serif';document.body.append(shield,tip);document.addEventListener('mousemove',move,true);document.addEventListener('click',click,true);document.addEventListener('keydown',key,true);}
function config(){try{chrome.runtime.sendMessage({type:'getCounter'}).then(d=>{selector=d?.selector||'';zeroSelector=d?.zeroSelector||'';scan();}).catch(invalid);}catch{invalid();}}
chrome.runtime.onMessage.addListener(m=>{if(m.type==='scan')config();if(m.type==='pickCounter')pick();});
observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,1200);});observer.observe(document.body,{subtree:true,childList:true,characterData:true});
// Let the initial page render settle before quietly recording its existing count.
setTimeout(config,4000);
})();
