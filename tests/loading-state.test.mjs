import test from 'node:test';
import assert from 'node:assert/strict';
import {beginRead,pendingReads,subscribeReads} from '../src/loading-state.js';

test('overlapping requests stay busy until both finish and other pages remain independent',()=>{
 let notifications=0;
 const unsubscribe=subscribeReads(()=>notifications++);
 const first=beginRead('/api/dashboard'),second=beginRead('/api/dashboard');
 assert.equal(pendingReads('/api/dashboard'),2);
 assert.equal(pendingReads('/api/todos'),0);
 first();assert.equal(pendingReads('/api/dashboard'),1);
 first();assert.equal(pendingReads('/api/dashboard'),1);
 second();assert.equal(pendingReads('/api/dashboard'),0);
 assert.equal(notifications,4);
 unsubscribe();beginRead('/api/todos')();assert.equal(notifications,4);
});
