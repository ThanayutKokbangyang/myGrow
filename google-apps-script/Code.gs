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
    if (String(body.action || '').indexOf('cards_') === 0) return response_(flashcards_(body));
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
    if (String(body.action || '').indexOf('cards_') === 0) return response_(flashcards_(body));
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

const CARD_HEADERS = ['id','word','phonetic','meaning','example','translation','tag','level','due','correct','attempts','imageUrl','imageFileId','updatedAt','lastReviewId'];
function cardInput_(input) {
  if(!input || !String(input.id||'') || String(input.id).length>100 || !String(input.word||'').trim() || !String(input.meaning||'').trim())throw new Error('คำศัพท์หรือคำแปลไม่ครบ');
  const c={};
  CARD_HEADERS.forEach(h=>c[h]=String(input[h]??''));
  ['word','meaning','phonetic','example','translation','tag','imageUrl','imageFileId'].forEach(h=>{if(c[h].length>2000)throw new Error('ข้อความยาวเกินไป');});
  c.word=c.word.trim();c.meaning=c.meaning.trim();c.tag=c.tag.trim()||'General';
  if(c.imageUrl && !/^https:\/\//.test(c.imageUrl))throw new Error('รูปภาพต้องเป็นลิงก์ HTTPS');
  ['level','due','correct','attempts'].forEach(h=>{const n=Number(c[h])||0;if(!isFinite(n)||n<0||!Number.isSafeInteger(n))throw new Error('ข้อมูลความคืบหน้าไม่ถูกต้อง');c[h]=n;});
  if(c.level>5||c.correct>c.attempts)throw new Error('ข้อมูลความคืบหน้าไม่ถูกต้อง');
  return c;
}
function flashcards_(body) {
  if(body.action==='cards_uploadImage')return cardImage_(body.image);
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const book=SpreadsheetApp.openById(SPREADSHEET_ID);let sheet=book.getSheetByName('Vocabulary');
    if(!sheet){sheet=book.insertSheet('Vocabulary');sheet.getRange(1,1,1,CARD_HEADERS.length).setValues([CARD_HEADERS]);sheet.setFrozenRows(1);}
    // Refuse to write if a manually changed schema could shift existing data.
    const headers=sheet.getRange(1,1,1,CARD_HEADERS.length).getDisplayValues()[0];
    if(headers.join('|')!==CARD_HEADERS.join('|'))throw new Error('หัวตาราง Vocabulary ไม่ตรงกับเวอร์ชันนี้');
    const read=()=>sheet.getLastRow()<2?[]:sheet.getRange(2,1,sheet.getLastRow()-1,CARD_HEADERS.length).getValues().map((row,i)=>({row:i+2,card:Object.fromEntries(CARD_HEADERS.map((h,j)=>[h,row[j]]))})).filter(x=>x.card.id).map(x=>({row:x.row,card:cardInput_(x.card)}));
    const existing=read(),lookup=new Map(existing.map(x=>[String(x.card.id),x]));
    const write=(c,row)=>{if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);c.updatedAt=new Date().toISOString();const values=CARD_HEADERS.map(h=>typeof c[h]==='number'?c[h]:"'"+String(c[h]??''));sheet.getRange(row,1,1,CARD_HEADERS.length).setValues([values]);};
    if(body.action==='cards_list')return {ok:true,cards:existing.map(x=>x.card)};
    if(body.action==='cards_upsert'){
      const c=cardInput_(body.card),old=lookup.get(c.id);
      // Editing text must not reset review progress.
      ['level','due','correct','attempts','lastReviewId'].forEach(h=>c[h]=old?old.card[h]:(h==='lastReviewId'?'':0));
      write(c,old?old.row:sheet.getLastRow()+1);return {ok:true,card:c};
    }
    if(body.action==='cards_delete'){const old=lookup.get(String(body.id));if(old)sheet.deleteRow(old.row);return {ok:true};}
    if(body.action==='cards_review'){
      const old=lookup.get(String(body.id));if(!old)throw new Error('ไม่พบคำศัพท์นี้');
      if(typeof body.remembered!=='boolean'||typeof body.reviewId!=='string'||!body.reviewId||body.reviewId.length>100)throw new Error('ข้อมูลการทบทวนไม่ถูกต้อง');
      const c=old.card;if(c.lastReviewId===body.reviewId)return {ok:true,card:c};
      c.level=body.remembered?Math.min(c.level+1,5):0;c.attempts++;c.correct+=body.remembered?1:0;
      c.due=Date.now()+(body.remembered?[0,1,3,7,14,30][c.level]*86400000:600000);c.lastReviewId=body.reviewId;
      write(c,old.row);return {ok:true,card:c};
    }
    if(body.action==='cards_import'){
      if(!Array.isArray(body.cards)||body.cards.length>500)throw new Error('นำเข้าได้ครั้งละไม่เกิน 500 คำ');
      const cards=body.cards.map(cardInput_);let row=sheet.getLastRow()+1;
      cards.forEach(c=>{if(!lookup.has(c.id)){write(c,row++);lookup.set(c.id,{card:c});}});
      return {ok:true,cards:read().map(x=>x.card)};
    }
    throw new Error('ACTION_INVALID');
  } finally {lock.releaseLock();}
}
function cardImage_(image){
  if(!image||!/^image\/(jpeg|png|webp)$/.test(image.mimeType)||typeof image.data!=='string'||image.data.length>2800000)throw new Error('รูปภาพไม่ถูกต้องหรือใหญ่เกิน 2 MB');
  const bytes=Utilities.base64Decode(image.data);if(bytes.length>2*1024*1024)throw new Error('รูปภาพใหญ่เกิน 2 MB');
  try {
    const folders=DriveApp.getFoldersByName('myGrow Vocabulary Images');const folder=folders.hasNext()?folders.next():DriveApp.createFolder('myGrow Vocabulary Images');
    const file=folder.createFile(Utilities.newBlob(bytes,image.mimeType,'vocabulary-'+Utilities.getUuid()+'.jpg'));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    return {ok:true,imageFileId:file.getId(),imageUrl:'https://drive.google.com/thumbnail?id='+file.getId()+'&sz=w1000'};
  } catch(error) {
    if(/permission|scope|authoriz/i.test(String(error)))throw new Error('ยังไม่ได้อนุญาต Google Drive: เปิด Apps Script แล้วรัน authorizeDrive หนึ่งครั้ง จากนั้น Deploy เวอร์ชันใหม่');
    throw error;
  }
}

// Run this once from the Apps Script editor after adding image upload.
// Google will show the consent screen for the Drive permission.
function authorizeDrive() {
  const root = DriveApp.getRootFolder();
  return 'Drive access granted: ' + root.getName();
}
