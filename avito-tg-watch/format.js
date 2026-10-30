(function(root){
 const esc=t=>String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 function format(info,fallback){
  const url=info.url||fallback;
  const text='💬 <b>Новое сообщение · Авито</b>\n\n👤 <b>'+esc(info.name||'Отправитель не распознан')+'</b>'+(info.title?'\n📌 '+esc(info.title):'')+'\n\n<blockquote>'+esc(info.preview||'Открой Авито, чтобы посмотреть сообщение.')+'</blockquote>';
  return {text,parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:info.url?'Открыть чат ↗':'Открыть Авито ↗',url}]]}};
 }
 const api={esc,format};root.WatchFormat=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
