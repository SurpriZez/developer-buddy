// DB shim for USER_SCRIPT world execution.
// USER_SCRIPT world is isolated from MAIN world, so window.DB set by grant-bridge
// is not visible there. This shim re-defines window.DB using the same DOM APIs.
// NOTE: getActiveEnv() returns {} — window.__DB_ENV__ is MAIN-world-only.

export const DB_SHIM_CODE = `(function(){
  var P='db_us_kv_';
  window.DB={
    setValue:function(k,v){try{localStorage.setItem(P+k,JSON.stringify(v))}catch(e){}},
    getValue:function(k){try{var r=localStorage.getItem(P+k);return r!==null?JSON.parse(r):null}catch{return null}},
    deleteValue:function(k){localStorage.removeItem(P+k)},
    openInTab:function(u){window.open(u,'_blank')},
    setClipboard:async function(t){
      try{await navigator.clipboard.writeText(t)}
      catch{
        var el=document.createElement('textarea');
        el.value=t;el.style.cssText='position:fixed;opacity:0';
        document.body.appendChild(el);el.select();
        document.execCommand('copy');document.body.removeChild(el);
      }
    },
    notification:function(ti,m){
      if('Notification'in window&&Notification.permission==='granted')
        new Notification(ti,{body:m});
    },
    getActiveEnv:function(){return{}},
    xmlhttpRequest:function(){
      console.log('[Developer Buddy] DB.xmlhttpRequest available in Phase 2.');
      return null;
    }
  };
})();`;
