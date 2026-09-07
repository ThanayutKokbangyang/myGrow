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

export const hasOwnerToken=()=>Boolean(localStorage.getItem(TOKEN_KEY));
export const clearOwnerToken=()=>localStorage.removeItem(TOKEN_KEY);
export async function verifyOwner(code){const result=await api('/api/auth',{method:'POST',body:JSON.stringify({code})});localStorage.setItem(TOKEN_KEY,result.token);return result}
export async function loadActivities(){const result=await api('/api/activities');return result.items||[]}
export async function createActivity(item){return api('/api/activities',{method:'POST',body:JSON.stringify(item)})}
export async function deleteActivity(id){return api('/api/activities',{method:'POST',body:JSON.stringify({_action:'delete',id})})}

export async function loadWins(){const r=await api('/api/wins');return r.items||[]}
export async function applyWins(changes){return api('/api/wins',{method:'POST',body:JSON.stringify({changes})})}

export async function loadGoals(){const r=await api('/api/goals');return r.items||[]}
export async function applyGoals(changes){return api('/api/goals',{method:'POST',body:JSON.stringify({changes})})}
let todosCache=null,todosRequest=null;
export const getCachedTodos=()=>todosCache;
export async function loadTodos(options={}){
 if(!options.refresh&&todosCache!==null)return todosCache;
 if(!options.refresh&&todosRequest)return todosRequest;
 todosRequest=api('/api/todos').then(r=>{todosCache=r.items||[];return todosCache}).finally(()=>{todosRequest=null});
 return todosRequest;
}
export async function applyTodos(changes){const result=await api('/api/todos',{method:'POST',body:JSON.stringify({changes})});todosCache=result.items||changes;return {...result,items:todosCache}}

export async function loadCalendar(){const r=await api('/api/calendar');return r.items||[]}
export async function applyCalendar(changes){return api('/api/calendar',{method:'POST',body:JSON.stringify({changes})})}

export async function loadFlashcards(){const result=await api('/api/flashcards');return result.cards||[]}
export async function writeFlashcards(action,payload={}){return api('/api/flashcards',{method:'POST',body:JSON.stringify({action,...payload})})}
