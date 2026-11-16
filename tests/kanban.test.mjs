import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {cardsOf,moveCard,changesBetween,dueState} from '../src/kanban-model.js';
const source=fs.readFileSync('google-apps-script/Code.gs','utf8');
function fixture(){
 const rows=[];let exists=false,releases=0;
 const lastRow=()=>{let n=rows.length;while(n&&!rows[n-1]?.some(value=>String(value||'').length))n--;return n};
 const sheet={getLastRow:lastRow,getMaxRows:()=>1000,setFrozenRows(){},getRange(r,c,n,m){return {getDisplayValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>String(rows[r+i-1]?.[c+j-1]??''))),setNumberFormat(){return this},setValues(values){values.forEach((row,i)=>{rows[r+i-1]??=[];row.forEach((value,j)=>{rows[r+i-1][c+j-1]=typeof value==='string'&&value.startsWith("'")?value.slice(1):value})});return this}}}};
 const context={SpreadsheetApp:{openById:()=>({getSheetByName:()=>exists?sheet:null,insertSheet:()=>{exists=true;return sheet}})},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test'})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){releases++}})},Utilities:{formatDate:(date,zone,pattern)=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));const day=`${parts.year}-${parts.month}-${parts.day}`;return pattern==='yyyy-MM'?day.slice(0,7):day}},Date};
 vm.createContext(context);vm.runInContext(source,context);
 return {rows,call:body=>JSON.parse(JSON.stringify(context.kanban_(body))),releases:()=>releases};
}
const makeCard=(id='c1',columnId='list-todo')=>({id,type:'card',columnId,title:'ทดสอบงาน',detail:'รายละเอียด',priority:'normal',due:'2026-11-20',order:0,tone:'gold',done:false});
const upsert=(item,revision=0)=>({type:'upsert',id:item.id,item,revision});

test('board initializes once; card add, move, edit and delete survive reads',()=>{
 const f=fixture();let result=f.call({action:'kanban_list'});assert.equal(result.items.length,3);
 assert.equal(f.call({action:'kanban_list'}).items.length,3);
 result=f.call({action:'kanban_apply',changes:[upsert(makeCard())]});
 let card=result.items.find(item=>item.id==='c1');assert.equal(card.revision,1);
 card={...card,columnId:'list-doing',title:'อัปเดตงาน'};
 f.call({action:'kanban_apply',changes:[upsert(card,1)]});
 card=f.call({action:'kanban_list'}).items.find(item=>item.id==='c1');
 assert.equal(card.title,'อัปเดตงาน');assert.equal(card.columnId,'list-doing');assert.equal(card.revision,2);
 f.call({action:'kanban_apply',changes:[{type:'delete',id:'c1',revision:2}]});
 assert.equal(f.call({action:'kanban_list'}).items.length,3);
});
test('stale writes conflict and invalid batches or orphan cards never partially change data',()=>{
 const f=fixture();f.call({action:'kanban_list'});f.call({action:'kanban_apply',changes:[upsert(makeCard())]});
 const snapshot=JSON.stringify(f.rows);
 assert.throws(()=>f.call({action:'kanban_apply',changes:[upsert({...makeCard(),title:'stale'},0)]}),/KANBAN_CONFLICT/);
 assert.throws(()=>f.call({action:'kanban_apply',changes:[upsert({...makeCard(),title:'valid'},1),upsert({...makeCard('c2'),due:'2026-02-30'})]}),/วันครบกำหนด/);
 assert.throws(()=>f.call({action:'kanban_apply',changes:[{type:'delete',id:'list-todo',revision:1}]}),/ย้ายการ์ด/);
 assert.throws(()=>f.call({action:'kanban_apply',changes:[upsert(makeCard('c2','missing'))]}),/ย้ายการ์ด/);
 assert.equal(JSON.stringify(f.rows),snapshot);assert.equal(f.releases(),6);
});
test('columns can be renamed and empty columns deleted, and formula-like text is stored literally',()=>{
 const f=fixture();const result=f.call({action:'kanban_list'}),column=result.items[0];
 f.call({action:'kanban_apply',changes:[upsert({...column,title:'=literal title'},1),upsert({...makeCard(),detail:'=HYPERLINK("https://example.test")'})]});
 assert.equal(f.rows[1][3],'=literal title');
 const card=f.call({action:'kanban_list'}).items.find(item=>item.id==='c1');assert.equal(card.detail,'=HYPERLINK("https://example.test")');
 f.call({action:'kanban_apply',changes:[{type:'delete',id:'list-doing',revision:1}]});
 assert.equal(f.call({action:'kanban_list'}).items.filter(item=>item.type==='column').length,2);
});
test('drag ordering works within a column and across columns without dropping hidden cards',()=>{
 const columns=['a','b'].map((id,order)=>({id,type:'column',order}));
 const cards=['one','two','three'].map((id,order)=>({...makeCard(id,'a'),order,revision:1}));
 const original=[...columns,...cards];
 const sorted=moveCard(original,'three','a','one');assert.deepEqual(cardsOf(sorted,'a').map(item=>item.id),['three','one','two']);
 const moved=moveCard(sorted,'one','b');assert.deepEqual(cardsOf(moved,'a').map(item=>item.id),['three','two']);assert.deepEqual(cardsOf(moved,'b').map(item=>item.id),['one']);
 assert.equal(original[4].columnId,'a');
 const changes=changesBetween(original,moved);assert(changes.every(change=>change.revision===1));assert.equal(changesBetween(original,original).length,0);
 assert.equal(moveCard(original,'one','missing'),original);
 assert.equal(dueState('2026-11-15','2026-11-16'),'late');assert.equal(dueState('2026-11-16','2026-11-16'),'today');
});

test('card months survive save, due-date changes and moves, and can be changed explicitly',()=>{
 const f=fixture();f.call({action:'kanban_list'});
 let result=f.call({action:'kanban_apply',changes:[upsert({...makeCard(),month:'2026-12'})]});
 let card=result.items.find(item=>item.id==='c1');assert.equal(card.month,'2026-12');
 result=f.call({action:'kanban_apply',changes:[upsert({...card,due:'2027-01-01',columnId:'list-doing'},1)]});
 card=result.items.find(item=>item.id==='c1');assert.equal(card.month,'2026-12');
 result=f.call({action:'kanban_apply',changes:[upsert({...card,month:'2027-02'},2)]});
 assert.equal(result.items.find(item=>item.id==='c1').month,'2027-02');
 const snapshot=JSON.stringify(f.rows);
 assert.throws(()=>f.call({action:'kanban_apply',changes:[upsert({...makeCard('bad'),month:'2026-13'})]}),/เดือน/);
 assert.equal(JSON.stringify(f.rows),snapshot);
});

test('legacy 12-column sheets gain month without losing data and inferred months remain stable',()=>{
 const f=fixture();f.call({action:'kanban_list'});f.call({action:'kanban_apply',changes:[upsert(makeCard())]});
 f.rows.forEach(row=>row.splice(12));
 let result=f.call({action:'kanban_list'}),card=result.items.find(item=>item.id==='c1');
 assert.equal(f.rows[0][12],'month');assert.equal(card.month,'2026-11');assert.equal(card.title,'ทดสอบงาน');
 delete card.month;
 result=f.call({action:'kanban_apply',changes:[upsert({...card,due:'2027-03-01'},1)]});
 assert.equal(result.items.find(item=>item.id==='c1').month,'2026-11');assert.equal(f.rows.length,5);
});

test('legacy undated cards use Bangkok saved month and keep it after title edits',()=>{
 const f=fixture();f.call({action:'kanban_list'});f.call({action:'kanban_apply',changes:[upsert({...makeCard(),due:''})]});
 f.rows.forEach(row=>row.splice(12));const row=f.rows.find(row=>row[0]==='c1');row[11]='2026-11-30T18:00:00Z';
 const card=f.call({action:'kanban_list'}).items.find(item=>item.id==='c1');assert.equal(card.month,'2026-12');
 const result=f.call({action:'kanban_apply',changes:[upsert({...card,title:'แก้เฉพาะชื่อ'},1)]});assert.equal(result.items.find(item=>item.id==='c1').month,'2026-12');
});
