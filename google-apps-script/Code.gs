const SPREADSHEET_ID = '1jWHos16PvXbCAjN0CMLbzzl1GmehH90zF75uDHxwyKg';
const SHEET_NAME = 'Activities';
const HEADERS = ['id','date_iso','date_th','skill','topic','minutes','before','after','improvement','difficulty','learned','problem','next','xp','created_by','updated_at'];

function doGet() {
  return response_({ ok: true, service: 'Grow Room Sheet API' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('GROW_ROOM_SECRET');
    if (!expected || body.secret !== expected) return response_({ ok: false, error: 'SECRET_INVALID' });
    if (body.action === 'wins_list' || body.action === 'wins_apply') return response_(smallWins_(body));
    if (body.action === 'list') return response_({ ok: true, items: listActivities_() });
    if (body.action === 'append') return response_({ ok: true, item: appendActivity_(body.item || {}) });
    if (body.action === 'delete') return response_({ ok: true, deleted: deleteActivity_(String(body.id || '')) });
    return response_({ ok: false, error: 'ACTION_INVALID' });
  } catch (error) {
    return response_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function sheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('ไม่พบชีต Activities');
  return sheet;
}

function listActivities_() {
  const sheet = sheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues()
    .filter(row => String(row[0] || '').trim())
    .map(row => rowToActivity_(row));
}

function appendActivity_(input) {
  const now = new Date();
  const item = {
    id: String(input.id || now.getTime()),
    date: input.date || now.toISOString(),
    skill: String(input.skill || 'english'),
    topic: String(input.topic || '').trim(),
    minutes: Number(input.minutes || 0),
    before: Number(input.before || 0),
    after: Number(input.after || 0),
    difficulty: Number(input.difficulty || 0),
    learned: String(input.learned || ''),
    problem: String(input.problem || ''),
    next: String(input.next || '')
  };
  if (!item.topic || item.minutes < 1) throw new Error('ข้อมูลกิจกรรมไม่ครบ');
  const row = [item.id,item.date,Utilities.formatDate(new Date(item.date),'Asia/Bangkok','dd/MM/yyyy'),item.skill,item.topic,item.minutes,item.before,item.after,item.after-item.before,item.difficulty,item.learned,item.problem,item.next,item.minutes*2,'Tae',now.toISOString()];
  sheet_().appendRow(row);
  return item;
}

function deleteActivity_(id) {
  const sheet = sheet_();
  if (!id || sheet.getLastRow() < 2) return false;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  const index = ids.findIndex(row => row[0] === id);
  if (index < 0) return false;
  sheet.deleteRow(index + 2);
  return true;
}

function rowToActivity_(row) {
  return { id:String(row[0]),date:String(row[1]),skill:String(row[3]),topic:String(row[4]),minutes:Number(row[5]),before:Number(row[6]),after:Number(row[7]),difficulty:Number(row[9]),learned:String(row[10]||''),problem:String(row[11]||''),next:String(row[12]||'') };
}

function response_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

// Small wins share the existing spreadsheet and owner authentication.
function smallWins_(body) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = book.getSheetByName('SmallWins');
    if (!sheet) { sheet = book.insertSheet('SmallWins'); sheet.appendRow(['id','date','category','text','updated_at']); sheet.setFrozenRows(1); }
    const read = () => sheet.getLastRow()<2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,5).getDisplayValues().filter(r=>r[0]).map(r=>({id:r[0],date:r[1],category:r[2],text:r[3]}));
    if (body.action === 'wins_list') return {ok:true,items:read()};
    const ops = body.changes;
    if (!Array.isArray(ops) || ops.length>1000) throw new Error('INVALID_CHANGES');
    ops.forEach(op=>{
      if (!op || !['upsert','delete'].includes(op.type) || typeof op.id!=='string' || !op.id || op.id.length>100) throw new Error('INVALID_ID');
      if (op.type==='upsert') {
        const w=op.item;
        if (!w || w.id!==op.id || typeof w.text!=='string' || !w.text.trim() || w.text.length>1000 || !/^\d{4}-\d{2}-\d{2}$/.test(w.date) || !['health','learning','work','life','other'].includes(w.category)) throw new Error('INVALID_WIN');
        const parsed=new Date(w.date+'T12:00:00Z');
        if(isNaN(parsed.getTime())||Utilities.formatDate(parsed,'UTC','yyyy-MM-dd')!==w.date)throw new Error('INVALID_DATE');
      }
    });
    ops.forEach(op=>{
      const rows=read(), index=rows.findIndex(w=>w.id===op.id);
      if (op.type==='delete') { if(index>=0)sheet.deleteRow(index+2); return; }
      if(index>=0 && op.createOnly)return;
      const w=op.item,row=index>=0?index+2:sheet.getLastRow()+1;
      if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
      const range=sheet.getRange(row,1,1,5);range.setNumberFormat('@');
      // Leading apostrophe forces user text to remain literal, including '=...'.
      range.setValues([[w.id,w.date,w.category,w.text.trim(),new Date().toISOString()].map(v=>"'"+v)]);
    });
    return {ok:true,items:read()};
  } finally { lock.releaseLock(); }
}
