import {dayKey as dayKeyOf} from './day';
export const DAY=86400000;
export function normalizeCard(c){if(!c||c.id===undefined||!String(c.word||'').trim()||!String(c.meaning||'').trim())throw Error('คำศัพท์ต้องมี id คำศัพท์ และคำแปล');return {id:String(c.id),word:String(c.word).trim(),meaning:String(c.meaning).trim(),phonetic:String(c.phonetic||''),example:String(c.example||''),translation:String(c.translation||''),tag:String(c.tag||'General'),imageUrl:/^https:\/\//.test(c.imageUrl||'')?String(c.imageUrl):'',imageFileId:String(c.imageFileId||''),level:Math.min(5,Math.max(0,Math.floor(Number(c.level)||0))),due:Math.max(0,Number(c.due)||0),correct:Math.max(0,Math.floor(Number(c.correct)||0)),attempts:Math.max(0,Math.floor(Number(c.attempts)||0)),createdAt:String(c.createdAt||''),updatedAt:String(c.updatedAt||'')};}
export const cleanGuess=s=>s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
export function reviewStats(cards){const attempts=cards.reduce((n,c)=>n+c.attempts,0),correct=cards.reduce((n,c)=>n+c.correct,0);return {attempts,accuracy:attempts?Math.round(correct/attempts*100):0,mastered:cards.filter(c=>c.level>=4).length};}
export function dueCards(cards,now=Date.now()){return cards.filter(c=>c.due<=now).sort((a,b)=>a.due-b.due);}

// Rows written before the createdAt column existed fall back to updatedAt, so
// every card still lands on a day in the collection.
export const cardDay=c=>{const t=Date.parse(c.createdAt||c.updatedAt||'');return Number.isFinite(t)?new Date(t):null;};
// A card saved at 01:00 belongs to the previous day, same as everywhere else.
export const dayKey=d=>d?dayKeyOf(d):'unknown';
export function groupByDay(cards){
 const map=new Map();
 for(const c of cards){const key=dayKey(cardDay(c));if(!map.has(key))map.set(key,[]);map.get(key).push(c);}
 return [...map.entries()].sort((a,b)=>a[0]==='unknown'?1:b[0]==='unknown'?-1:b[0].localeCompare(a[0]));
}