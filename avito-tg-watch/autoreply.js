(function(root){
 const norm=t=>(t||'').replace(/\s+/g,' ').trim();
 const visible=e=>!!e&&e.getClientRects().length>0;
 function reusable(el){
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
  // Do not guess which messages are incoming: caller may still prepare a draft.
  return {selector:'',direction:false};
 }
 function state(map){
  if(!map || location.pathname+location.search!==map.route)return {ok:false,reason:'Открой выбранный тестовый чат. Автоответ ограничен этим чатом.'};
  let header,editor,button;
  try{header=document.querySelector(map.header);editor=document.querySelector(map.editor);button=document.querySelector(map.button);}catch{return {ok:false,reason:'Повтори настройку отправки: неверные селекторы'};}
  if(!visible(header)||norm(header.textContent)!==map.name)return {ok:false,reason:'Имя в открытом чате не совпало — отправка остановлена'};
  if(!visible(editor)||!visible(button))return {ok:false,reason:'Поле ответа или кнопка не найдены'};
  return {ok:true,header,editor,button};
 }
 function incoming(map){
  const st=state(map);if(!st.ok)return st;
  if(!map.incoming)return {ok:false,reason:'Не удалось надёжно определить входящие сообщения. Доступна только подготовка тестового черновика.'};
  const nodes=[...document.querySelectorAll(map.incoming)].filter(visible);
  return {ok:true,count:nodes.length,fingerprint:JSON.stringify(nodes.slice(-10).map(n=>norm(n.textContent))),last:norm(nodes.at(-1)?.textContent).slice(0,500)};
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
  if(st.button.disabled||st.button.getAttribute('aria-disabled')==='true')throw Error('Кнопка отправки неактивна — текст оставлен в черновике');
  st.button.click();
  await new Promise(resolve=>setTimeout(resolve,900));
  const after=state(map);
  if(after.ok && !norm(after.editor.value||after.editor.textContent))return {status:'attempted',reason:'Нажата кнопка отправки, поле очистилось. Проверь доставку в Авито.'};
  throw Error('Кнопка нажата, но поле не очистилось. Повтор автоматически не выполняется — проверь чат.');
 }
 root.WatchAuto={reusable,state,incoming,fill};
})(globalThis);
