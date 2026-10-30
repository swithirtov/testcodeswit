(function(root){
 function atPoint(elements,x,y,ignore){
  return elements.filter(e=>e!==ignore && e.getBoundingClientRect).map(e=>({e,r:e.getBoundingClientRect()})).filter(({r})=>r.width>0&&r.height>0&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom).sort((a,b)=>a.r.width*a.r.height-b.r.width*b.r.height)[0]?.e || null;
 }
 function redDot(e,style){
  if(!e)return false;const r=e.getBoundingClientRect();const c=(style.backgroundColor||'').match(/[\d.]+/g)?.map(Number)||[];
  return r.width>=3&&r.width<=26&&r.height>=3&&r.height<=26&&c[0]>170&&c[0]>c[1]*1.35&&c[0]>c[2]*1.15&&(c.length<4||c[3]>0);
 }
 const api={atPoint,redDot};root.WatchPicker=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
