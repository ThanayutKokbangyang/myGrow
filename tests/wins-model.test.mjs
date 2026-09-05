import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWin,normalizeWins,calendarDays,dayKey,parseDay} from '../src/wins-model.js';
test('new wins always use the current local day, regardless of archive selection',()=>{
 const now=new Date(2026,8,6,0,1);
 assert.equal(makeWin({id:'new',text:' done ',category:'health',selected:'2026-08-01'},now).date,'2026-09-06');
 assert.equal(makeWin({id:'new',text:' done ',category:'health'},now).text,'done');
});
test('editing preserves the original day',()=>{
 assert.equal(makeWin({id:'old',text:'edited',category:'work',original:{date:'2026-08-01'}},new Date(2026,8,6)).date,'2026-08-01');
});
test('legacy backups retain content and gain the other category',()=>{
 const old={id:'1',date:'2026-09-05',text:'first win'};
 assert.deepEqual(normalizeWins([old]),[{...old,category:'other'}]);
 assert.equal(normalizeWins([{...old,category:'health'}])[0].category,'health');
 assert.throws(()=>normalizeWins([{...old,date:'2026-02-30'}]));
});
test('calendar includes leap days, month boundaries and unique date keys',()=>{
 const days=calendarDays(new Date(2024,1,1));
 assert.equal(days.length,42);assert.equal(new Set(days.map(x=>x.key)).size,42);
 assert.equal(parseDay(days[0].key).getDay(),0);
 assert(days.some(x=>x.key==='2024-02-29'&&x.inMonth));
 assert.equal(dayKey(parseDay('2026-12-31')),'2026-12-31');
});
