const $=id=>document.getElementById(id);
const request=msg=>chrome.runtime.sendMessage(msg);
function config(){return {enabled:$('enabled').checked,desktop:$('desktop').checked,token:$('token').value.trim(),chatId:$('chatId').value.trim()};}
async function refresh(initial=false){
 const d=await request({type:'load'});if(initial){const c=d.settings||{};$('enabled').checked=!!c.enabled;$('desktop').checked=c.desktop!==false;$('token').value=c.token||'';$('chatId').value=c.chatId||'';}
 const s=d.status;if(s){$('status').textContent=(s.found?'Обнаружено: '+s.count:'Не распознано')+'\n'+(s.details||'')+'\nПроверка: '+new Date(s.at).toLocaleTimeString();}
 $('sent').textContent=d.lastSent?'Последний сигнал: '+new Date(d.lastSent).toLocaleTimeString():'';
 if(d.lastError)$('message').textContent=d.lastError;
}
for(const type of ['save','test','scan','pick','pickDetails','auto'])$(type).addEventListener('click',async()=>{
 const b=$(type);b.disabled=true;$('message').textContent='Секунду…';
 try{const r=await request({type,settings:config()});if(r?.error)throw Error(r.error);$('message').textContent=type==='test'?'Тест отправлен. Проверь Telegram.':type==='save'?'Сохранено.':type==='pick'?'Выбери число на странице Авито.':'Готово.';if(type==='pick'||type==='pickDetails')window.close();await refresh();}catch(e){$('message').textContent=e.message;}finally{b.disabled=false;}
});
refresh(true);setInterval(()=>refresh(),2500);
