import test from 'node:test';
import assert from 'node:assert/strict';
import {cardMonth,cardsInMonth,shiftBoardMonth,changesBetween,moveCard} from '../src/kanban-model.js';
test('month selection includes undated tasks with explicit months and excludes other months',()=>{
 const items=[{id:'column',type:'column',order:0},{id:'a',type:'card',columnId:'column',order:0,month:'2026-11',due:'2026-12-01'},{id:'b',type:'card',columnId:'column',order:1,month:'2026-12',due:''},{id:'c',type:'card',columnId:'column',order:2,due:'2026-11-20'},{id:'d',type:'card',columnId:'column',order:3,updatedAt:''}];
 assert.deepEqual(cardsInMonth(items,'2026-11').map(c=>c.id),['a','c']);assert.equal(cardsInMonth(items,'all').length,4);
 assert.deepEqual(cardsInMonth(items,'unassigned').map(c=>c.id),['d']);
 assert.equal(moveCard(items,'a','column','c').find(c=>c.id==='b').month,'2026-12');
 assert.equal(changesBetween(items,items.map(c=>c.id==='b'?{...c,month:'2027-01'}:c))[0].id,'b');
});
test('legacy timestamp months use Bangkok and navigation crosses year boundaries',()=>{
 assert.equal(cardMonth({updatedAt:'2026-11-30T18:00:00Z'}),'2026-12');
 assert.equal(cardMonth({due:'2026-11-15',updatedAt:'2026-12-01T00:00:00Z'}),'2026-11');
 assert.equal(cardMonth({updatedAt:'invalid'}),'unassigned');
 assert.equal(shiftBoardMonth('2026-12',1),'2027-01');assert.equal(shiftBoardMonth('2027-01',-1),'2026-12');
});
