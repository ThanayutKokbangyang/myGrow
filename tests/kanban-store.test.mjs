import test from 'node:test';
import assert from 'node:assert/strict';
import {createKanbanStore} from '../src/kanban-store.js';
import {moveCard} from '../src/kanban-model.js';
const initial=[{id:'a',type:'column',title:'Todo',order:0,revision:1},{id:'b',type:'column',title:'Done',order:1,revision:1},{id:'card',type:'card',columnId:'a',title:'Task',order:0,revision:1}];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 let server=structuredClone(initial),calls=[],pending=[];
 const store=createKanbanStore({initial:{items:server},read:async()=>({items:server}),write:changes=>new Promise((resolve,reject)=>{calls.push(changes);pending.push({resolve,reject,changes})})});
 return {store,calls,pending,finish(){const request=pending.shift();for(const change of request.changes){if(change.type==='delete')server=server.filter(item=>item.id!==change.id);else{const old=server.find(item=>item.id===change.id);server=server.filter(item=>item.id!==change.id);server.push({...change.item,revision:(old?.revision||0)+1})}}request.resolve({items:structuredClone(server)})}};
}
test('rapid moves render immediately and serialize using the newest server revision',async()=>{
 const f=fixture(),first=f.store.persist(items=>moveCard(items,'card','b'),'moved');await tick();
 const second=f.store.persist(items=>moveCard(items,'card','a'),'moved back');
 assert.equal(f.store.getSnapshot().items.find(item=>item.id==='card').columnId,'a');assert.equal(f.calls.length,1);
 f.finish();await tick();assert.equal(await first,true);assert.equal(f.calls.length,2);
 assert.equal(f.calls[1][0].revision,2);assert.equal(f.calls[1][0].item.columnId,'a');
 f.finish();assert.equal(await second,true);await tick();assert.equal(f.store.getSnapshot().saving,false);assert.equal(f.store.getSnapshot().items.find(item=>item.id==='card').revision,3);
});
test('new card edits and deletes during a write rebase without losing issued revisions',async()=>{
 const f=fixture(),add=f.store.persist(items=>[...items,{id:'new',type:'card',columnId:'a',title:'New',order:1,revision:0}]);await tick();
 const edit=f.store.persist(items=>items.map(item=>item.id==='new'?{...item,title:'Edited'}:item));
 f.finish();await tick();assert.equal(await add,true);assert.equal(f.calls[1][0].revision,1);assert.equal(f.calls[1][0].item.title,'Edited');
 f.finish();assert.equal(await edit,true);await tick();
 const remove=f.store.persist(items=>items.filter(item=>item.id!=='new'));await tick();assert.equal(f.calls[2][0].revision,2);f.finish();assert.equal(await remove,true);
});
test('failure rolls back all queued changes and resolves callers without claiming success',async()=>{
 const f=fixture(),first=f.store.persist(items=>moveCard(items,'card','b'));await tick();
 const second=f.store.persist(items=>items.map(item=>item.id==='card'?{...item,title:'Unsaved'}:item));
 f.pending.shift().reject(new Error('offline'));assert.equal(await first,false);assert.equal(await second,false);await tick();
 assert.equal(f.store.getSnapshot().items.find(item=>item.id==='card').columnId,'a');assert.equal(f.store.getSnapshot().items.find(item=>item.id==='card').title,'Task');assert.equal(f.store.getSnapshot().error,'offline');assert.equal(f.store.getSnapshot().saving,false);
});
test('navigation subscribers can change and disposal ignores late results',async()=>{
 const f=fixture();let renders=0;const off=f.store.subscribe(()=>renders++);
 const saving=f.store.persist(items=>moveCard(items,'card','b'));await tick();off();
 const off2=f.store.subscribe(()=>renders++);f.store.dispose();const before=renders;
 assert.equal(await saving,false);f.finish();await tick();assert.equal(renders,before);off2();
});
test('operations coalesce before the first write and a failed second batch preserves the first save',async()=>{
 const f=fixture();const cancel1=f.store.persist(items=>moveCard(items,'card','b')),cancel2=f.store.persist(items=>moveCard(items,'card','a'));
 assert.equal(await cancel1,true);assert.equal(await cancel2,true);assert.equal(f.calls.length,0);
 const first=f.store.persist(items=>moveCard(items,'card','b'));await tick();
 const second=f.store.persist(items=>items.map(item=>item.id==='card'?{...item,title:'Unsaved edit'}:item));
 f.finish();await tick();assert.equal(await first,true);
 f.pending.shift().reject(new Error('offline'));assert.equal(await second,false);await tick();
 const card=f.store.getSnapshot().items.find(item=>item.id==='card');assert.equal(card.columnId,'b');assert.equal(card.title,'Task');assert.equal(card.revision,2);
});
test('pending edits do not silently overwrite another tab’s unrelated changes',async()=>{
 let finish;
 const store=createKanbanStore({initial:{items:initial},read:async()=>({items:initial}),write:()=>new Promise(resolve=>finish=resolve)});
 const first=store.persist(items=>items.map(item=>item.id==='a'?{...item,title:'Renamed column'}:item));await tick();
 const pending=store.persist(items=>items.map(item=>item.id==='card'?{...item,title:'My unsaved title'}:item));
 finish({items:initial.map(item=>item.id==='a'?{...item,title:'Renamed column',revision:2}:item.id==='card'?{...item,title:'Changed in another tab',revision:2}:item)});
 assert.equal(await first,true);assert.equal(await pending,false);await tick();
 assert.match(store.getSnapshot().error,/หน้าต่างอื่น/);assert.equal(store.getSnapshot().items.find(item=>item.id==='card').title,'Changed in another tab');
});
test('revisiting a freshly saved board skips reads and refresh cannot discard queued edits',async()=>{
 let reads=0,finish;
 const store=createKanbanStore({initial:{items:initial},read:async()=>{reads++;return {items:initial}},write:()=>new Promise(resolve=>finish=resolve)});
 assert.equal(await store.load(),true);assert.equal(reads,0);
 const saving=store.persist(items=>moveCard(items,'card','b'));
 assert.equal(await store.load(true),false);assert.equal(reads,0);
 await tick();finish({items:moveCard(initial,'card','b').map(item=>item.id==='card'?{...item,revision:2}:item)});assert.equal(await saving,true);await tick();
 await store.load();assert.equal(reads,0);assert.equal(store.getSnapshot().items.find(item=>item.id==='card').columnId,'b');
});
