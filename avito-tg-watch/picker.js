(function(root){
 function atPoint(elements,x,y,ignore){
  return elements.filter(e=>e!==ignore && e.getBoundingClientRect).map(e=>({e,r:e.getBoundingClientRect()})).filter(({r})=>r.width>0&&r.height>0&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom).sort((a,b)=>a.r.width*a.r.height-b.r.width*b.r.height)[0]?.e || null;
 }
 function redDot(e,style){
  if(!e||style.display==='none'||style.visibility==='hidden'||style.opacity==='0')return false;
  const r=e.getBoundingClientRect();
  const width=parseFloat(style.width)||r.width,height=parseFloat(style.height)||r.height;
  if(width<3||width>26||height<3||height>26)return false;
  return [style.backgroundColor,style.fill].some(raw=>{
   if(!raw)return false;
   const c=raw.match(/[\d.]+/g)?.map(Number)||[];
   if(raw.startsWith('color(srgb'))for(let i=0;i<3;i++)c[i]*=255;
   return c[0]>170&&c[0]>c[1]*1.35&&c[0]>c[2]*1.15&&(c.length<4||c[3]>0);
  });
 }
 function unreadDot(e,styles){
  if(!e)return false;
  return [null,'::before','::after'].some(p=>{try{return redDot(e,styles(e,p));}catch{return false;}});
 }
 const api={atPoint,redDot,unreadDot};root.WatchPicker=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
