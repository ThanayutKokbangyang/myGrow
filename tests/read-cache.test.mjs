import test from 'node:test';
import assert from 'node:assert/strict';
import {createReadCache} from '../src/read-cache.js';

test('reuses results and concurrent reads, expires and supports refresh',async()=>{
 let time=0,calls=0;
 const cache=createReadCache({ttl:100,now:()=>time});
 const fetcher=async()=>++calls;
 assert.deepEqual(await Promise.all([cache.read('a',fetcher),cache.read('a',fetcher)]),[1,1]);
 assert.equal(await cache.read('a',fetcher),1);
 time=101;assert.equal(await cache.read('a',fetcher),2);
 assert.equal(await cache.read('a',fetcher,{refresh:true}),3);
});
test('writes invalidate cached and pending reads without affecting other resources',async()=>{
 const cache=createReadCache();let finish;
 const old=cache.read('/todos?a',()=>new Promise(resolve=>finish=resolve));
 await Promise.resolve();
 await cache.read('/wins',async()=>9);
 cache.invalidate('/todos');
 assert.equal(await cache.read('/todos?a',async()=>2),2);
 finish(1);await old;
 assert.equal(cache.peek('/todos?a'),2);assert.equal(cache.peek('/wins'),9);
});
test('failed reads can retry and cache storage is bounded',async()=>{
 const cache=createReadCache({maxEntries:2});
 await assert.rejects(cache.read('a',async()=>{throw Error('offline')}));
 assert.equal(await cache.read('a',async()=>1),1);
 await cache.read('b',async()=>2);await cache.read('c',async()=>3);
 assert.equal(cache.peek('a'),null);assert.equal(cache.peek('c'),3);
});
