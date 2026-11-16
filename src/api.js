import {createReadCache} from './read-cache.js';
const reads=createReadCache();
function readKey(path){const url=new URL(path,'https://grow.invalid');url.searchParams.delete('refresh');url.searchParams.sort();return url.pathname+url.search}
const TOKEN_KEY='grow-room-owner-token-v1';

async function api(path,options={}){
 const headers={'content-type':'application/json',...(options.headers||{})};
 const token=localStorage.getItem(TOKEN_KEY);
 if(token)headers.authorization=`Bearer ${token}`;
 const method=(options.method||'GET').toUpperCase();
 const request=async()=>{
 const response=await fetch(path,{...options,headers});
 const body=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(body.error||'เชื่อมต่อไม่สำเร็จ');error.status=response.status;throw error}
 return body;
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

export const hasOwnerToken=()=>Boolean(localStorage.getItem(TOKEN_KEY));
export const clearOwnerToken=()=>localStorage.removeItem(TOKEN_KEY);
export async function verifyOwner(code){const result=await api('/api/auth',{method:'POST',body:JSON.stringify({code})});localStorage.setItem(TOKEN_KEY,result.token);return result}
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
