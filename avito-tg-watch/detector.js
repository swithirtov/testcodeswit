(function(root){
function advance(previous,snapshot){
 const next={epoch:snapshot.epoch,count:snapshot.count};
 return {state:next,notify:!!previous && previous.epoch===next.epoch && next.count>previous.count};
}
const api={advance};root.WatchDetector=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
