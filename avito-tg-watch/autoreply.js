(function(root){
 const norm=t=>(t||'').replace(/\s+/g,' ').trim();
 const visible=e=>!!e&&e.getClientRects().length>0;
 function reusable(el,path){
  let direction=el;
  while(direction&&direction!==document.body){
   const hint=[direction.getAttribute('data-marker'),direction.className,direction.getAttribute('data-direction')].join(' ');
   if(/incoming|inbound|received/i.test(hint))break;
   direction=direction.parentElement;
  }
  const node=direction&&direction!==document.body?direction:el;
  const marker=node.getAttribute('data-marker');
  if(marker && /incoming|inbound|received/i.test(marker))return {selector:'[data-marker="'+CSS.escape(marker)+'"]',direction:true};
  const cls=[...node.classList].filter(c=>/incoming|inbound|received/i.test(c));
  if(cls.length)return {selector:'.'+cls.map(CSS.escape).join('.'),direction:true};
  // Learn the actual bubble and scroll region, rather than assume class names.
  let bubble=el,style;
  while(bubble && bubble!==document.body){
   style=getComputedStyle(bubble);
   if(opaque(style.backgroundColor) && parseFloat(style.borderTopLeftRadius)>=6 && bubble.getBoundingClientRect().width>=30)break;
   bubble=bubble.parentElement;
  }
  if(!bubble || bubble===document.body || !path)return {selector:'',direction:false};
  let scope=bubble.parentElement;
  while(scope && scope!==document.body){
   const st=getComputedStyle(scope);
   if(/auto|scroll/.test(st.overflowY) && scope.clientHeight>100)break;
   scope=scope.parentElement;
  }
  if(!scope || scope===document.body)return {selector:'',direction:false};
  const rule={background:style.backgroundColor,scope:path(scope),tag:bubble.tagName.toLowerCase()};
  if(!matchesVisual(bubble,scope,rule))return {selector:'',direction:false};
  return {selector:rule.tag,direction:true,visual:rule};
 }
 function opaque(color){return !!color && color!=='transparent' && !/rgba\([^)]*,\s*0(?:\.0+)?\s*\)/.test(color) && !/\/\s*0(?:\.0+)?\s*\)/.test(color);}
 function matchesVisual(el,scope,rule){
  const b=el.getBoundingClientRect(),r=scope.getBoundingClientRect(),st=getComputedStyle(el);
  return st.backgroundColor===rule.background && parseFloat(st.borderTopLeftRadius)>=6 && b.width>=30 && b.width<r.width*.94 && b.left>=r.left-2 && b.left<=r.left+r.width*.18 && b.right<=r.right+2;
 }
 function state(map){
  if(!map || location.pathname+location.search!==map.route)return {ok:false,reason:'Открой выбранный тестовый чат. Автоответ ограничен этим чатом.'};
  let header,editor,button;
  try{header=document.querySelector(map.header);editor=document.querySelector(map.editor);button=document.querySelector(map.button);}catch{return {ok:false,reason:'Повтори настройку отправки: неверные селекторы'};}
  if(!visible(header)||norm(header.textContent)!==map.name)return {ok:false,reason:'Имя в открытом чате не совпало — отправка остановлена'};
  if(!visible(editor))return {ok:false,reason:'Поле ответа не найдено'};
  return {ok:true,header,editor,button};
 }
 function incoming(map){
  const st=state(map);if(!st.ok)return st;
  if(!map.incoming)return {ok:false,reason:'Не удалось надёжно определить входящие сообщения. Доступна только подготовка тестового черновика.'};
  let nodes;
  if(map.incomingRule){
   const scope=document.querySelector(map.incomingRule.scope);
   if(!visible(scope))return {ok:false,reason:'Область переписки изменилась — повтори настройку тестового чата'};
   nodes=[...scope.querySelectorAll(map.incoming)].filter(e=>visible(e)&&matchesVisual(e,scope,map.incomingRule));
   nodes=nodes.filter(e=>!nodes.some(other=>other!==e&&other.contains(e)));
  }else nodes=[...document.querySelectorAll(map.incoming)].filter(visible);
  return {ok:true,count:nodes.length,fingerprint:JSON.stringify(nodes.slice(-10).map(n=>norm(n.textContent))),last:norm(nodes.at(-1)?.textContent).slice(0,500)};
 }
 function sendButton(map,editor){
  const matches=b=>{
   if(!visible(b))return false;
   if(map.buttonSignature)return b.innerHTML===map.buttonSignature;
   const label=[b.getAttribute('aria-label'),b.getAttribute('title'),b.getAttribute('data-marker')].join(' ');
   return /send|отправ/i.test(label);
  };
  let selected;try{selected=document.querySelector(map.button);}catch{}
  if(matches(selected))return selected;
  const box=editor.getBoundingClientRect();
  const found=[...document.querySelectorAll('button,[role="button"]')].filter(matches).filter(b=>{const r=b.getBoundingClientRect();return Math.abs(r.top-box.top)<100 && r.left>=box.left-60;});
  return found.length===1?found[0]:null;
 }
 async function fill(map,text,send){
  let st=state(map);if(!st.ok)throw Error(st.reason);
  const editor=st.editor;
  if(norm(editor.value||editor.textContent))throw Error('В поле уже есть черновик — не трогаю');
  if(!text?.trim())throw Error('Текст автоответа пуст');
  editor.focus();
  if(editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement){
   const proto=editor instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
   Object.getOwnPropertyDescriptor(proto,'value').set.call(editor,text);
   editor.dispatchEvent(new Event('input',{bubbles:true}));editor.dispatchEvent(new Event('change',{bubbles:true}));
  }else if(editor.isContentEditable){
   // Plain-text insertion only; never insert message text as HTML.
   editor.textContent=text;editor.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
  }else throw Error('Выбранный элемент не является полем ввода');
  await new Promise(resolve=>setTimeout(resolve,350));
  if(!send)return {status:'draft',reason:'Черновик подготовлен. Проверь имя и текст, отправь вручную.'};
  st=state(map);if(!st.ok)throw Error(st.reason);
  if(norm(st.editor.value||st.editor.textContent)!==norm(text))throw Error('Авито не принял текст в поле. Автоотправка остановлена');
  let button;
  for(let i=0;i<8;i++){button=sendButton(map,st.editor);if(button && !button.disabled && button.getAttribute('aria-disabled')!=='true')break;await new Promise(resolve=>setTimeout(resolve,250));}
  if(!button || button.disabled || button.getAttribute('aria-disabled')==='true')throw Error('После ввода кнопка отправки не распознана. Текст оставлен в черновике; повтори настройку кнопки с непустым полем.');
  button.click();
  await new Promise(resolve=>setTimeout(resolve,900));
  const after=state(map);
  if(after.ok && !norm(after.editor.value||after.editor.textContent))return {status:'attempted',reason:'Нажата кнопка отправки, поле очистилось. Проверь доставку в Авито.'};
  throw Error('Кнопка нажата, но поле не очистилось. Повтор автоматически не выполняется — проверь чат.');
 }
 root.WatchAuto={reusable,state,incoming,fill,matchesVisual,sendButton};
})(globalThis);
