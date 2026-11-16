import {useEffect,useSyncExternalStore} from 'react';
import {loadRoutines,writeRoutines} from './api';
import {createRoutineStore} from './routine-store.js';
import {routineDay} from './routine-model.js';
let store;
const getStore=()=>store??=createRoutineStore({read:loadRoutines,write:writeRoutines});
if(typeof window!=='undefined'){
 window.addEventListener('grow-session-ended',()=>{store?.dispose();store=null});
 window.addEventListener('beforeunload',event=>{if(store?.getSnapshot().saving){event.preventDefault();event.returnValue=''}});
}
export function useRoutines(){
 const current=getStore(),state=useSyncExternalStore(current.subscribe,current.getSnapshot,current.getSnapshot);
 useEffect(()=>{current.load();const tick=()=>{const day=routineDay();if(current.getSnapshot().today!==day)current.load({date:day,month:day.slice(0,7)},true)};const timer=setInterval(tick,30000);window.addEventListener('focus',tick);return()=>{clearInterval(timer);window.removeEventListener('focus',tick)}},[current]);
 return {...state,check:current.check,command:current.command,load:current.load};
}
