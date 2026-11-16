import {beginRead} from './loading-state.js';
import {createReadCache} from './read-cache.js';
const reads=createReadCache();
function readKey(path){const url=new URL(path,'https://grow.invalid');url.searchParams.delete('refresh');url.searchParams.sort();return url.pathname+url.search}
let authorized=false;

async function api(path,options={}){
 const headers={'content-type':'application/json',...(options.headers||{})};

 const method=(options.method||'GET').toUpperCase();
 const request=async()=>{
 const finish=method==='GET'?beginRead(path.split('?')[0]):()=>{};
 try{
 const response=await fetch(path,{...options,headers});
 const body=await response.json().catch(()=>({}));
 if(response.status===401&&path!=='/api/auth')clearOwnerToken();
 if(!response.ok){const error=new Error(body.error||'เชื่อมต่อไม่สำเร็จ');error.status=response.status;throw error}
 return body;
 }finally{finish()}
 };
 if(method==='GET'){
  const url=new URL(path,'https://grow.invalid');
  const refresh=url.searchParams.has('refresh');url.searchParams.delete('refresh');url.searchParams.sort();
  return reads.read(readKey(path),request,{refresh});
 }
 const result=await request();
 reads.invalidate(path.split('?')[0]);
 if(path.startsWith('/api/activities'))reads.invalidate('/api/dashboard');
 return result;
}
const query=params=>{const value=new URLSearchParams();Object.entries(params||{}).forEach(([key,item])=>{if(item!==undefined&&item!==null&&item!=='')value.set(key,String(item))});const text=value.toString();return text?'?'+text:''};

export const hasOwnerToken=()=>authorized;
export const clearOwnerToken=()=>{authorized=false;reads.invalidate('');if(typeof window!=='undefined')window.dispatchEvent(new Event('grow-session-ended'))};
export async function verifyOwner(code){const result=await api('/api/auth',{method:'POST',body:JSON.stringify({code})});authorized=true;return result}
export async function verifySession(){const result=await api('/api/session?refresh=1');authorized=true;return result}
export async function lockSite(){await api('/api/logout',{method:'POST'});clearOwnerToken()}
export async function loadActivities(options={}){return api('/api/activities'+query(options))}
export async function loadDashboard(refresh=false){return api('/api/dashboard'+query({refresh:refresh?1:''}))}
export async function createActivity(item){return api('/api/activities',{method:'POST',body:JSON.stringify(item)})}
export async function deleteActivity(id){return api('/api/activities',{method:'POST',body:JSON.stringify({_action:'delete',id})})}

export async function loadWins(options={}){return api('/api/wins'+query(options))}
export async function applyWins(changes){return api('/api/wins',{method:'POST',body:JSON.stringify({changes})})}

export async function loadGoals(options={}){const r=await api('/api/goals'+query(options));return r.items||[]}
export async function applyGoals(changes){return api('/api/goals',{method:'POST',body:JSON.stringify({changes})})}
export const getCachedTodos=(options={})=>reads.peek(readKey('/api/todos'+query(options)));
export async function loadTodos(options={}){return api('/api/todos'+query(options))}
export async function applyTodos(changes){return api('/api/todos',{method:'POST',body:JSON.stringify({changes})})}

export async function loadCalendar(options={}){return api('/api/calendar'+query(options))}
export async function applyCalendar(changes){return api('/api/calendar',{method:'POST',body:JSON.stringify({changes})})}

export async function loadSummaries(options={}){return api('/api/summaries'+query(options))}
export async function uploadSummary(item,file){return api('/api/summaries',{method:'POST',body:JSON.stringify({action:'upload',item,file})})}
export async function deleteSummary(id){return api('/api/summaries',{method:'POST',body:JSON.stringify({action:'delete',id})})}

export const getCachedKanban=()=>reads.peek('/api/kanban');
export async function loadKanban(refresh=false){return api('/api/kanban'+query({refresh:refresh?1:''}))}
export async function applyKanban(changes){return api('/api/kanban',{method:'POST',body:JSON.stringify({changes})})}
