import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const apps=fs.readFileSync('google-apps-script/Code.gs','utf8');
const edge=fs.readFileSync('api/[...path].js','utf8');
const worker=fs.readFileSync('worker/index.js','utf8');

test('summary files are kept in Drive while searchable metadata is paged in Sheets',()=>{
 assert.match(apps,/const SUMMARY_HEADERS/);
 assert.match(apps,/summaryFolder_\(\)\.createFile/);
 assert.match(apps,/function summaries_\(/);
 assert.match(apps,/page_\(items,body,12,48\)/);
 assert.doesNotMatch(apps,/getRange\(row,\s*1\)\.getValue\(/);
});

test('both production adapters expose the same summaries endpoint',()=>{
 for(const source of [edge,worker]){
  assert.match(source,/\/api\/summaries/);
  assert.match(source,/summaries_'\+action/);
  assert.match(source,/\['list','upload','delete'\]/);
 }
});
