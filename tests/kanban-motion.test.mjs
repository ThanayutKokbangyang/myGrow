import test from 'node:test';
import assert from 'node:assert/strict';
import {edgeSpeed} from '../src/kanban-motion.js';
test('edge scrolling stays still in the center and outside, and accelerates gently near edges',()=>{
 assert.equal(edgeSpeed(200,0,400),0);assert.equal(edgeSpeed(-1,0,400),0);assert.equal(edgeSpeed(401,0,400),0);
 assert.equal(edgeSpeed(0,0,400),-14);assert.equal(edgeSpeed(400,0,400),14);
 assert(edgeSpeed(20,0,400)<edgeSpeed(40,0,400));assert(edgeSpeed(380,0,400)>edgeSpeed(360,0,400));
});
