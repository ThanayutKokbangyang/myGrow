// Short-lived, bounded session cache. Mutations invalidate pending reads too.
export function createReadCache({ttl=60000,maxEntries=100,now=Date.now}={}) {
 const entries=new Map();
 return {
  peek(key){const entry=entries.get(key);return entry&&entry.expires>now()?entry.value:null},
  read(key,fetcher,{refresh=false}={}){
   const existing=entries.get(key);
   if(existing?.pending)return existing.pending;
   if(!refresh&&existing&&existing.expires>now())return Promise.resolve(existing.value);
   const entry={};
   entries.delete(key);entries.set(key,entry);
   while(entries.size>maxEntries)entries.delete(entries.keys().next().value);
   entry.pending=Promise.resolve().then(fetcher).then(value=>{
    if(entries.get(key)===entry){entry.value=value;entry.expires=now()+ttl;delete entry.pending}
    return value;
   },error=>{if(entries.get(key)===entry)entries.delete(key);throw error});
   return entry.pending;
  },
  invalidate(prefix){for(const key of entries.keys())if(key.startsWith(prefix))entries.delete(key)},
 };
}
