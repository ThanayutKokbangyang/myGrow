import {useEffect,useSyncExternalStore} from 'react';
import {applyKanban,getCachedKanban,loadKanban} from './api';
import {createKanbanStore} from './kanban-store.js';

let store=null;
const getStore=()=>store??=createKanbanStore({read:loadKanban,write:applyKanban,initial:getCachedKanban()});
// The queue survives navigation so a pending move is not lost when switching
// modes. Locking the site discards all private in-memory board state.
if(typeof window!=='undefined'){
 window.addEventListener('grow-session-ended',()=>{store?.dispose();store=null});
 window.addEventListener('beforeunload',event=>{if(store?.getSnapshot().saving){event.preventDefault();event.returnValue=''}});
}
export function useKanban(){
 const current=getStore();
 const state=useSyncExternalStore(current.subscribe,current.getSnapshot,current.getSnapshot);
 useEffect(()=>{current.load()},[current]);
 return {...state,busy:state.saving||state.refreshing,persist:current.persist,refresh:()=>current.load(true)};
}
