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
    if (body.action === 'goals_list' || body.action === 'goals_apply') return response_(goals_(body));
    if (body.action === 'calendar_list' || body.action === 'calendar_apply') return response_(calendar_(body));
    if (body.action === 'todos_list' || body.action === 'todos_apply') return response_(todos_(body));
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

/* -------------------------------------------------------------------------
   Todos: งานอิสระประจำวัน เรียงตาม Priority โดยหน้าเว็บ
   priority = high (สำคัญ) หรือ normal (ทั่วไป)
   แท็บ Todos จะถูกสร้างอัตโนมัติเมื่อหน้าเว็บเรียกใช้งานครั้งแรก
   ------------------------------------------------------------------------- */
const TODO_HEADERS = ['id','date','title','detail','category','priority','done','createdAt','updatedAt'];

function todoInput_(item) {
  if (!item || typeof item !== 'object') throw new Error('ข้อมูล Todo ไม่ถูกต้อง');
  const todo = {
    id: String(item.id || '').trim(),
    date: String(item.date || '').trim(),
    title: String(item.title || '').trim(),
    detail: String(item.detail || '').trim(),
    // category เก็บไว้เพื่อให้เข้ากับข้อมูลเดิม แต่หน้าเว็บไม่แสดงหมวดแล้ว
    category: String(item.category || 'life').trim(),
    priority: String(item.priority || 'normal').trim(),
    done: item.done === true,
    createdAt: String(item.createdAt || '').trim()
  };
  if (!todo.id || todo.id.length > 100) throw new Error('Todo ID ไม่ถูกต้อง');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todo.date)) throw new Error('วันที่ Todo ไม่ถูกต้อง');
  if (!todo.title || todo.title.length > 160) throw new Error('กรุณาระบุงานที่ต้องทำ');
  if (todo.detail.length > 400) throw new Error('รายละเอียด Todo ยาวเกินไป');
  if (['coding','english','math','life'].indexOf(todo.category) < 0) todo.category = 'life';
  if (['high','normal'].indexOf(todo.priority) < 0) throw new Error('Priority ไม่ถูกต้อง');
  return todo;
}

function todos_(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = book.getSheetByName('Todos');
    if (!sheet) {
      sheet = book.insertSheet('Todos');
      sheet.getRange(1, 1, 1, TODO_HEADERS.length).setValues([TODO_HEADERS]);
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(3, 300);
      sheet.setColumnWidth(4, 360);
    }
    const headers = sheet.getRange(1, 1, 1, TODO_HEADERS.length).getDisplayValues()[0];
    if (headers.join('|') !== TODO_HEADERS.join('|')) throw new Error('หัวตาราง Todos ไม่ตรงกับเวอร์ชันนี้');

    const read = () => sheet.getLastRow() < 2 ? [] : sheet
      .getRange(2, 1, sheet.getLastRow() - 1, TODO_HEADERS.length)
      .getDisplayValues()
      .filter(row => String(row[0] || '').trim())
      .map(row => ({
        id: String(row[0]),
        date: String(row[1]),
        title: String(row[2]),
        detail: String(row[3] || ''),
        category: String(row[4] || 'life'),
        priority: String(row[5] || 'normal'),
        done: row[6] === true || String(row[6]).toLowerCase() === 'true',
        createdAt: String(row[7] || '')
      }));

    if (body.action === 'todos_list') return { ok: true, items: read() };

    const items = body.changes;
    if (!Array.isArray(items) || items.length > 1000) throw new Error('INVALID_CHANGES');
    const clean = items.map(todoInput_);
    const keep = {};
    clean.forEach(item => { keep[item.id] = true; });

    // หน้าเว็บส่งรายการล่าสุดมาทั้งชุด รายการที่หายไปจึงหมายถึงผู้ใช้กดลบ
    for (let row = sheet.getLastRow(); row >= 2; row--) {
      const rowId = String(sheet.getRange(row, 1).getValue() || '');
      if (rowId && !keep[rowId]) sheet.deleteRow(row);
    }

    clean.forEach(item => {
      const rows = read();
      const index = rows.findIndex(row => row.id === item.id);
      const row = index >= 0 ? index + 2 : sheet.getLastRow() + 1;
      const now = new Date().toISOString();
      if (!item.createdAt) item.createdAt = now;
      if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
      const range = sheet.getRange(row, 1, 1, TODO_HEADERS.length);
      range.setNumberFormat('@');
      // เก็บข้อความเป็น literal เพื่อไม่ให้ค่าที่ขึ้นต้นด้วย = กลายเป็นสูตร
      range.setValues([[
        "'" + item.id,
        "'" + item.date,
        "'" + item.title,
        "'" + item.detail,
        "'" + item.category,
        "'" + item.priority,
        item.done,
        "'" + item.createdAt,
        "'" + now
      ]]);
    });
    return { ok: true, items: read() };
  } finally {
    lock.releaseLock();
  }
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


// A day starts at 05:00 Asia/Bangkok, not at midnight, so studying past
// midnight still counts as the day you started in. Review intervals are
// anchored to that 05:00 boundary instead of to the exact minute you pressed
// the button -- a card reviewed at 23:50 comes back the next morning, not at
// 23:50 the following night.
const DAY_START_HOUR_ = 5, TZ_ = 'Asia/Bangkok';
function dayStartMs_(ms) {
  var hour = Number(Utilities.formatDate(new Date(ms), TZ_, 'H'));
  var anchor = new Date(ms - (hour < DAY_START_HOUR_ ? 86400000 : 0));
  return new Date(Utilities.formatDate(anchor, TZ_, 'yyyy-MM-dd') + 'T05:00:00+07:00').getTime();
}
function nextDueMs_(days, ms) {
  // Reviewing at 04:30 still counts as yesterday, so a one day card would land
  // at 05:00 -- half an hour later. Never bring a card back within four hours
  // of seeing it; the 23:50 case is 5h10m away and keeps its clean 05:00.
  return Math.max(dayStartMs_(ms) + days * 86400000, ms + 4 * 3600000);
}

const LEGACY_CARD_HEADERS = ['id','word','phonetic','meaning','example','translation','tag','level','due','correct','attempts','imageUrl','imageFileId','updatedAt','lastReviewId'];
const CARD_HEADERS = [...LEGACY_CARD_HEADERS,'createdAt'];
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
    // Add createdAt to existing Vocabulary sheets without moving legacy data.
    let headers=sheet.getRange(1,1,1,CARD_HEADERS.length).getDisplayValues()[0];
    if(headers.slice(0,LEGACY_CARD_HEADERS.length).join('|')===LEGACY_CARD_HEADERS.join('|')&&!headers[LEGACY_CARD_HEADERS.length]){
      sheet.getRange(1,1,1,CARD_HEADERS.length).setValues([CARD_HEADERS]);headers=CARD_HEADERS;
    }
    // Refuse to write if a manually changed schema could shift existing data.
    if(headers.join('|')!==CARD_HEADERS.join('|'))throw new Error('หัวตาราง Vocabulary ไม่ตรงกับเวอร์ชันนี้');
    const read=()=>sheet.getLastRow()<2?[]:sheet.getRange(2,1,sheet.getLastRow()-1,CARD_HEADERS.length).getValues().map((row,i)=>({row:i+2,card:Object.fromEntries(CARD_HEADERS.map((h,j)=>[h,row[j]]))})).filter(x=>x.card.id).map(x=>({row:x.row,card:cardInput_(x.card)}));
    const existing=read(),lookup=new Map(existing.map(x=>[String(x.card.id),x]));
    const write=(c,row)=>{if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);const now=new Date().toISOString();c.createdAt=c.createdAt||c.updatedAt||now;c.updatedAt=now;const values=CARD_HEADERS.map(h=>typeof c[h]==='number'?c[h]:"'"+String(c[h]??''));sheet.getRange(row,1,1,CARD_HEADERS.length).setValues([values]);};
    if(body.action==='cards_list')return {ok:true,cards:existing.map(x=>x.card)};
    if(body.action==='cards_upsert'){
      const c=cardInput_(body.card),old=lookup.get(c.id);
      // Editing text must not reset review progress.
      ['level','due','correct','attempts','lastReviewId'].forEach(h=>c[h]=old?old.card[h]:(h==='lastReviewId'?'':0));
      c.createdAt=old?(old.card.createdAt||old.card.updatedAt):c.createdAt;
      write(c,old?old.row:sheet.getLastRow()+1);return {ok:true,card:c};
    }
    if(body.action==='cards_delete'){const old=lookup.get(String(body.id));if(old)sheet.deleteRow(old.row);return {ok:true};}
    if(body.action==='cards_review'){
      const old=lookup.get(String(body.id));if(!old)throw new Error('ไม่พบคำศัพท์นี้');
      if(typeof body.remembered!=='boolean'||typeof body.reviewId!=='string'||!body.reviewId||body.reviewId.length>100)throw new Error('ข้อมูลการทบทวนไม่ถูกต้อง');
      const c=old.card;if(c.lastReviewId===body.reviewId)return {ok:true,card:c};
      c.level=body.remembered?Math.min(c.level+1,5):0;c.attempts++;c.correct+=body.remembered?1:0;
      c.due=body.remembered?nextDueMs_([0,1,3,7,14,30][c.level],Date.now()):Date.now()+600000;c.lastReviewId=body.reviewId;
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

/* -------------------------------------------------------------------------
   Goals: long term goals, short term goals and the plan steps under them.
   One tab holds both -- a row is a goal when goalId is blank, otherwise it is
   a step belonging to that goal -- so the whole page loads in a single read.
   ------------------------------------------------------------------------- */
const GOAL_HEADERS = ['id','type','goalId','term','title','detail','icon','status','due','order','createdAt','updatedAt'];
const GOAL_TERMS = ['long','short'];
const GOAL_STATUS = ['active','paused','done'];
const STEP_STATUS = ['todo','done'];

function goalInput_(item) {
  if (!item || typeof item !== 'object') throw new Error('ข้อมูลเป้าหมายไม่ถูกต้อง');
  const text = (key, max, required) => {
    const v = String(item[key] == null ? '' : item[key]).trim();
    if (v.length > max) throw new Error('ข้อความยาวเกินไป');
    if (required && !v) throw new Error('กรอกข้อมูลให้ครบก่อนบันทึก');
    return v;
  };
  const g = {
    id: text('id', 100, true),
    type: text('type', 10, true),
    goalId: text('goalId', 100, false),
    term: text('term', 10, false),
    title: text('title', 300, true),
    detail: text('detail', 2000, false),
    icon: text('icon', 40, false),
    status: text('status', 10, true),
    due: text('due', 10, false),
    order: Number(item.order || 0),
    createdAt: text('createdAt', 40, false),
  };
  if (g.type !== 'goal' && g.type !== 'step') throw new Error('ชนิดข้อมูลไม่ถูกต้อง');
  if (g.type === 'goal') {
    if (g.goalId) throw new Error('เป้าหมายต้องไม่มีเป้าหมายแม่');
    if (GOAL_TERMS.indexOf(g.term) < 0) throw new Error('ต้องเป็นเป้าหมายระยะยาวหรือระยะสั้น');
    if (GOAL_STATUS.indexOf(g.status) < 0) throw new Error('สถานะเป้าหมายไม่ถูกต้อง');
  } else {
    if (!g.goalId) throw new Error('แผนต้องอยู่ใต้เป้าหมาย');
    g.term = '';
    if (STEP_STATUS.indexOf(g.status) < 0) throw new Error('สถานะแผนไม่ถูกต้อง');
  }
  if (g.icon && !/^[a-z][a-z0-9-]{0,39}$/.test(g.icon)) throw new Error('ไอคอนไม่ถูกต้อง');
  if (g.due) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.due)) throw new Error('วันที่ไม่ถูกต้อง');
    const parsed = new Date(g.due + 'T12:00:00Z');
    if (isNaN(parsed.getTime()) || Utilities.formatDate(parsed, 'UTC', 'yyyy-MM-dd') !== g.due) throw new Error('วันที่ไม่ถูกต้อง');
  }
  if (!isFinite(g.order) || !Number.isSafeInteger(g.order) || g.order < 0 || g.order > 100000) throw new Error('ลำดับไม่ถูกต้อง');
  return g;
}

function goals_(body) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = book.getSheetByName('Goals');
    if (!sheet) {
      sheet = book.insertSheet('Goals');
      sheet.getRange(1, 1, 1, GOAL_HEADERS.length).setValues([GOAL_HEADERS]);
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(5, 280);
      sheet.setColumnWidth(6, 320);
    }
    const headers = sheet.getRange(1, 1, 1, GOAL_HEADERS.length).getDisplayValues()[0];
    if (headers.join('|') !== GOAL_HEADERS.join('|')) throw new Error('หัวตาราง Goals ไม่ตรงกับเวอร์ชันนี้');
    const read = () => sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, GOAL_HEADERS.length)
      .getDisplayValues()
      .map((row, i) => ({ row: i + 2, item: Object.fromEntries(GOAL_HEADERS.map((h, j) => [h, row[j]])) }))
      .filter(x => String(x.item.id).trim());
    const shape = rows => rows.map(x => ({
      id: String(x.item.id), type: String(x.item.type || 'goal'), goalId: String(x.item.goalId || ''),
      term: String(x.item.term || ''), title: String(x.item.title || ''), detail: String(x.item.detail || ''),
      icon: String(x.item.icon || ''), status: String(x.item.status || ''), due: String(x.item.due || ''),
      order: Number(x.item.order) || 0, createdAt: String(x.item.createdAt || ''), updatedAt: String(x.item.updatedAt || ''),
    }));
    if (body.action === 'goals_list') return { ok: true, items: shape(read()) };

    const ops = body.changes;
    if (!Array.isArray(ops) || ops.length > 500) throw new Error('INVALID_CHANGES');
    // Validate every change before touching the sheet, so a bad batch cannot
    // leave half of it written.
    ops.forEach(op => {
      if (!op || ['upsert', 'delete'].indexOf(op.type) < 0 || typeof op.id !== 'string' || !op.id || op.id.length > 100) throw new Error('INVALID_ID');
      if (op.type === 'upsert') {
        const item = goalInput_(op.item);
        if (item.id !== op.id) throw new Error('INVALID_ID');
      }
    });
    ops.forEach(op => {
      const rows = read(), index = rows.findIndex(x => String(x.item.id) === op.id);
      if (op.type === 'delete') {
        // Deleting a goal takes its steps with it, bottom row first so the
        // remaining row numbers stay valid.
        const doomed = rows.filter(x => String(x.item.id) === op.id || String(x.item.goalId) === op.id).map(x => x.row);
        doomed.sort((a, b) => b - a).forEach(row => sheet.deleteRow(row));
        return;
      }
      const item = goalInput_(op.item);
      const old = index >= 0 ? rows[index].item : null;
      const now = new Date().toISOString();
      item.createdAt = (old && old.createdAt) || item.createdAt || now;
      const row = index >= 0 ? rows[index].row : sheet.getLastRow() + 1;
      if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
      const range = sheet.getRange(row, 1, 1, GOAL_HEADERS.length);
      range.setNumberFormat('@');
      // Leading apostrophe keeps user text literal, including a leading '='.
      range.setValues([GOAL_HEADERS.map(h => "'" + String(h === 'updatedAt' ? now : item[h] == null ? '' : item[h]))]);
    });
    return { ok: true, items: shape(read()) };
  } finally { lock.releaseLock(); }
}

/* -------------------------------------------------------------------------
   Calendar: all day appointments and things due on a date. A repeating event
   is one row -- the start date plus a rule -- and the page works out which
   days it lands on, so the sheet never fills up with generated rows.
   `doneDates` is how a repeating event remembers which occurrences are done.
   ------------------------------------------------------------------------- */
const CAL_HEADERS = ['id','title','detail','date','icon','tone','repeat','repeatUntil','done','doneDates','createdAt','updatedAt'];
const CAL_REPEATS = ['none','daily','weekly','monthly','yearly'];
const CAL_TONES = ['blue','red','green','yellow','purple'];
const CAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

function calDate_(value, field) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return '';
  if (!CAL_DATE.test(v)) throw new Error('วันที่ไม่ถูกต้อง (' + field + ')');
  const parsed = new Date(v + 'T12:00:00Z');
  if (isNaN(parsed.getTime()) || Utilities.formatDate(parsed, 'UTC', 'yyyy-MM-dd') !== v) throw new Error('วันที่ไม่ถูกต้อง (' + field + ')');
  return v;
}

function calInput_(item) {
  if (!item || typeof item !== 'object') throw new Error('ข้อมูลนัดหมายไม่ถูกต้อง');
  const text = (key, max, required) => {
    const v = String(item[key] == null ? '' : item[key]).trim();
    if (v.length > max) throw new Error('ข้อความยาวเกินไป');
    if (required && !v) throw new Error('กรอกชื่อนัดหมายก่อนบันทึก');
    return v;
  };
  const e = {
    id: text('id', 100, true),
    title: text('title', 300, true),
    detail: text('detail', 2000, false),
    date: calDate_(item.date, 'วันที่'),
    icon: text('icon', 40, false) || 'calendar-month',
    tone: text('tone', 20, false) || 'blue',
    repeat: text('repeat', 20, false) || 'none',
    repeatUntil: calDate_(item.repeatUntil, 'สิ้นสุดการทำซ้ำ'),
    done: item.done ? 'yes' : '',
    doneDates: text('doneDates', 3000, false),
    createdAt: text('createdAt', 40, false),
  };
  if (!e.date) throw new Error('ต้องระบุวันที่ของนัดหมาย');
  if (CAL_REPEATS.indexOf(e.repeat) < 0) throw new Error('รูปแบบการทำซ้ำไม่ถูกต้อง');
  if (CAL_TONES.indexOf(e.tone) < 0) throw new Error('สีไม่ถูกต้อง');
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(e.icon)) throw new Error('ไอคอนไม่ถูกต้อง');
  if (e.repeat === 'none') { e.repeatUntil = ''; e.doneDates = ''; }
  else { e.done = ''; }
  if (e.repeatUntil && e.repeatUntil < e.date) throw new Error('วันสิ้นสุดการทำซ้ำต้องไม่มาก่อนวันเริ่ม');
  if (e.doneDates) {
    const days = e.doneDates.split(',');
    if (days.length > 250) throw new Error('รายการวันที่ทำแล้วยาวเกินไป');
    days.forEach(d => calDate_(d, 'วันที่ทำแล้ว'));
  }
  return e;
}

function calendar_(body) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const book = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = book.getSheetByName('Calendar');
    if (!sheet) {
      sheet = book.insertSheet('Calendar');
      sheet.getRange(1, 1, 1, CAL_HEADERS.length).setValues([CAL_HEADERS]);
      sheet.setFrozenRows(1);
      sheet.setColumnWidth(2, 280);
      sheet.setColumnWidth(3, 320);
    }
    const headers = sheet.getRange(1, 1, 1, CAL_HEADERS.length).getDisplayValues()[0];
    if (headers.join('|') !== CAL_HEADERS.join('|')) throw new Error('หัวตาราง Calendar ไม่ตรงกับเวอร์ชันนี้');
    const read = () => sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, CAL_HEADERS.length)
      .getDisplayValues()
      .map((row, i) => ({ row: i + 2, item: Object.fromEntries(CAL_HEADERS.map((h, j) => [h, String(row[j] || '')])) }))
      .filter(x => x.item.id.trim());
    const shape = rows => rows.map(x => ({
      id: x.item.id, title: x.item.title, detail: x.item.detail, date: x.item.date,
      icon: x.item.icon, tone: x.item.tone, repeat: x.item.repeat, repeatUntil: x.item.repeatUntil,
      done: x.item.done === 'yes', doneDates: x.item.doneDates,
      createdAt: x.item.createdAt, updatedAt: x.item.updatedAt,
    }));
    if (body.action === 'calendar_list') return { ok: true, items: shape(read()) };

    const ops = body.changes;
    if (!Array.isArray(ops) || ops.length > 500) throw new Error('INVALID_CHANGES');
    // Validate the whole batch before writing anything.
    ops.forEach(op => {
      if (!op || ['upsert', 'delete'].indexOf(op.type) < 0 || typeof op.id !== 'string' || !op.id || op.id.length > 100) throw new Error('INVALID_ID');
      if (op.type === 'upsert' && calInput_(op.item).id !== op.id) throw new Error('INVALID_ID');
    });
    ops.forEach(op => {
      const rows = read(), index = rows.findIndex(x => x.item.id === op.id);
      if (op.type === 'delete') { if (index >= 0) sheet.deleteRow(rows[index].row); return; }
      const item = calInput_(op.item), old = index >= 0 ? rows[index].item : null;
      const now = new Date().toISOString();
      item.createdAt = (old && old.createdAt) || item.createdAt || now;
      const row = index >= 0 ? rows[index].row : sheet.getLastRow() + 1;
      if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
      const range = sheet.getRange(row, 1, 1, CAL_HEADERS.length);
      range.setNumberFormat('@');
      // Leading apostrophe keeps user text literal, including a leading '='.
      range.setValues([CAL_HEADERS.map(h => "'" + String(h === 'updatedAt' ? now : item[h] == null ? '' : item[h]))]);
    });
    return { ok: true, items: shape(read()) };
  } finally { lock.releaseLock(); }
}
