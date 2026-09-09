const TOKEN_KEY='grow-room-owner-token-v1';

async function api(path,options={}){
 const headers={'content-type':'application/json',...(options.headers||{})};
 const token=localStorage.getItem(TOKEN_KEY);
 if(token)headers.authorization=`Bearer ${token}`;
 const response=await fetch(path,{...options,headers});
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body.error||'เชื่อมต่อไม่สำเร็จ');error.status=response.status;throw error}
 return body;
}
const query=params=>{const value=new URLSearchParams();Object.entries(params||{}).forEach(([key,item])=>{if(item!==undefined&&item!==null&&item!=='')value.set(key,String(item))});const text=value.toString();return text?'?'+text:''};

export const hasOwnerToken=()=>Boolean(localStorage.getItem(TOKEN_KEY));
export const clearOwnerToken=()=>localStorage.removeItem(TOKEN_KEY);
export async function verifyOwner(code){const result=await api('/api/auth',{method:'POST',body:JSON.stringify({code})});localStorage.setItem(TOKEN_KEY,result.token);return result}
export async function loadActivities(options={}){return api('/api/activities'+query(options))}
export async function loadDashboard(refresh=false){return api('/api/dashboard'+query({refresh:refresh?1:''}))}
export async function createActivity(item){return api('/api/activities',{method:'POST',body:JSON.stringify(item)})}
export async function deleteActivity(id){return api('/api/activities',{method:'POST',body:JSON.stringify({_action:'delete',id})})}

export async function loadWins(options={}){return api('/api/wins'+query(options))}
export async function applyWins(changes){return api('/api/wins',{method:'POST',body:JSON.stringify({changes})})}

export async function loadGoals(){const r=await api('/api/goals');return r.items||[]}
export async function applyGoals(changes){return api('/api/goals',{method:'POST',body:JSON.stringify({changes})})}
const todosCache=new Map(),todosRequests=new Map();
const todoKey=options=>JSON.stringify(options||{});
export const getCachedTodos=(options={})=>todosCache.get(todoKey(options))||null;
export async function loadTodos(options={}){
 const key=todoKey({...options,refresh:undefined});
 if(!options.refresh&&todosCache.has(key))return todosCache.get(key);
 if(!options.refresh&&todosRequests.has(key))return todosRequests.get(key);
 const request=api('/api/todos'+query(options)).then(r=>{todosCache.set(key,r);return r}).finally(()=>todosRequests.delete(key));
 todosRequests.set(key,request);return request;
}
export async function applyTodos(changes){const result=await api('/api/todos',{method:'POST',body:JSON.stringify({changes})});todosCache.clear();return result}

export async function loadCalendar(options={}){return api('/api/calendar'+query(options))}
export async function applyCalendar(changes){return api('/api/calendar',{method:'POST',body:JSON.stringify({changes})})}

export async function loadSummaries(options={}){return api('/api/summaries'+query(options))}
export async function uploadSummary(item,file){return api('/api/summaries',{method:'POST',body:JSON.stringify({action:'upload',item,file})})}
export async function deleteSummary(id){return api('/api/summaries',{method:'POST',body:JSON.stringify({action:'delete',id})})}

export async function loadFlashcards(options={}){return api('/api/flashcards'+query(options))}
export async function writeFlashcards(action,payload={}){return api('/api/flashcards',{method:'POST',body:JSON.stringify({action,...payload})})}
