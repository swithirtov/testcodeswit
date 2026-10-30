(()=>{
let selector='',timer, picking=false, highlighted=null,tip=null;
const send=msg=>chrome.runtime.sendMessage(msg).catch(()=>{});
const norm=t=>(t||'').replace(/\s+/g,' ').trim();
const shown=e=>e && e.getClientRects().length>0;
function count(e){const text=norm(e.textContent)||e.getAttribute('aria-label')||'';const n=text.match(/\d+/);return n?Math.min(100000,Number(n[0])):null;}
function inspect(){
  if(picking)return;
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
function move(e){if(highlighted)highlighted.style.outline=highlighted.dataset.watchOldOutline||'';highlighted=e.target;if(highlighted===tip)return;highlighted.dataset.watchOldOutline=highlighted.style.outline;highlighted.style.outline='3px solid #a78bfa';}
function stop(){picking=false;if(highlighted){highlighted.style.outline=highlighted.dataset.watchOldOutline||'';delete highlighted.dataset.watchOldOutline;}tip?.remove();document.removeEventListener('mousemove',move,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',key,true);}
function click(e){e.preventDefault();e.stopImmediatePropagation();if(e.target===tip)return;const n=count(e.target);if(n===null){tip.textContent='Нужно нажать именно на число непрочитанных. Esc — отмена.';return;}const link=e.target.closest('a[href*="messenger"], [data-marker*="header"] a, [data-marker*="header"] button');selector=cssPath(link||e.target);stop();send({type:'picked',selector});setTimeout(inspect,300);}
function key(e){if(e.key==='Escape')stop();}
function pick(){if(picking)stop();picking=true;tip=document.createElement('div');tip.textContent='Нажми на число непрочитанных сообщений. Esc — отмена.';tip.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#251b40;color:white;padding:18px 24px;border:1px solid #a78bfa;border-radius:14px;z-index:2147483647;font:16px sans-serif;box-shadow:0 8px 40px #0006';document.body.append(tip);document.addEventListener('mousemove',move,true);document.addEventListener('click',click,true);document.addEventListener('keydown',key,true);}
chrome.runtime.onMessage.addListener(msg=>{if(msg.type==='pick')pick();if(msg.type==='scan')chrome.runtime.sendMessage({type:'getSelector'},s=>{selector=s||'';inspect();});});
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(inspect,700);}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-marker','aria-label']});
chrome.runtime.sendMessage({type:'getSelector'},s=>{selector=s||'';inspect();});
})();
