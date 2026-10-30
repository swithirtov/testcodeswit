/* Pure state transitions; shared by the worker and tests. */
(function(root){
  function transition(previous, snapshot) {
    const current = {count:snapshot.count, rows:snapshot.rows || {}, mode:snapshot.mode};
    if (!previous || previous.mode !== current.mode) return {state:current, notify:false, reason:'initial'};
    let notify = !['details','rows'].includes(current.mode) && current.count > previous.count;
    for(const [id,value] of Object.entries(current.rows)) {
      if (!(id in previous.rows) || previous.rows[id] !== value) notify = true;
    }
    if(current.mode==='details' || current.mode==='rows')current.rows={...previous.rows,...current.rows};
    return {state:current,notify,reason:'changed'};
  }
  const api={transition};
  if(typeof module !== 'undefined') module.exports=api;
  root.WatchDetector=api;
})(globalThis);
