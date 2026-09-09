import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('google-apps-script/Code.gs','utf8');

test('Apps Script avoids per-row cell reads and exposes bounded list responses',()=>{
 assert.doesNotMatch(source,/getRange\(row,\s*1\)\.getValue\(/);
 assert.match(source,/function page_\(/);
 assert.match(source,/dashboard_summary/);
 assert.match(source,/createTextFinder/);
});
