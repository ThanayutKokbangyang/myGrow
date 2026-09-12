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
    if (String(body.action || '').indexOf('summaries_') === 0) return response_(summaries_(body));
    if (body.action === 'goals_list' || body.action === 'goals_apply') return response_(goals_(body));
    if (body.action === 'calendar_list' || body.action === 'calendar_apply') return response_(calendar_(body));
    if (body.action === 'todos_list' || body.action === 'todos_apply') return response_(todos_(body));
    if (body.action === 'dashboard_summary') return response_(dashboardSummary_(body));
    if (body.action === 'list') return response_(listActivities_(body));
    if (body.action === 'append') return response_({ ok: true, item: appendActivity_(body.item || {}) });
    if (body.action === 'delete') return response_({ ok: true, deleted: deleteActivity_(String(body.id || '')) });
    return response_({ ok: false, error: 'ACTION_INVALID' });
  } catch (error) {
    return response_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function int_(value, fallback, min, max) {
  const number = Number(value);
  if (!isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function page_(items, body, defaultSize, maxSize) {
  const requestedPage = int_(body && body.page, 1, 1, 1000000);
  const pageSize = int_(body && body.pageSize, defaultSize, 1, maxSize);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(requestedPage, pages);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageSize: pageSize, total: total, pages: pages };
}

function clearDashboardCache_() {
  CacheService.getScriptCache().remove('dashboard-summary-v2');
}

function sheet_() {
  const sheet = SpreadsheetApp.openById(spreadsheetId_()).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('ไม่พบชีต Activities');
  return sheet;
}

function spreadsheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty('GROW_ROOM_SPREADSHEET_ID');
  if (!id) throw new Error('ยังไม่ได้ตั้งค่า GROW_ROOM_SPREADSHEET_ID');
  return id;
}

function activityRows_() {
  const sheet = sheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues()
    .filter(row => String(row[0] || '').trim())
    .map(row => rowToActivity_(row));
}

function listActivities_(body) {
  const skill = String(body && body.skill || '').trim().toLowerCase();
  const query = String(body && body.query || '').trim().toLowerCase().slice(0, 120);
  if ((!skill || skill === 'all') && !query) {
    const sheet = sheet_();
    const total = Math.max(0, sheet.getLastRow() - 1);
    const pageSize = int_(body && body.pageSize, 40, 1, 100);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(int_(body && body.page, 1, 1, 1000000), pages);
    const endRow = sheet.getLastRow() - (current - 1) * pageSize;
    const startRow = Math.max(2, endRow - pageSize + 1);
    const count = total ? endRow - startRow + 1 : 0;
    const items = count ? sheet.getRange(startRow, 1, count, HEADERS.length).getValues().reverse().filter(row=>String(row[0]||'').trim()).map(rowToActivity_) : [];
    return {ok:true,items:items,page:current,pageSize:pageSize,total:total,pages:pages};
  }
  const items = activityRows_().sort((a, b) => String(b.date).localeCompare(String(a.date))).filter(item => {
    if (skill && skill !== 'all' && item.skill !== skill) return false;
    if (!query) return true;
    return [item.topic,item.learned,item.problem,item.next,item.skill].join(' ').toLowerCase().indexOf(query) >= 0;
  });
  const result = page_(items, body, 40, 100);
  result.ok = true;
  return result;
}

function dashboardSummary_(body) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('dashboard-summary-v2');
  if (cached && !(body && body.refresh)) return JSON.parse(cached);
  const activities = activityRows_();
  const now = new Date();
  const today = Utilities.formatDate(new Date(now.getTime() - (Number(Utilities.formatDate(now, TZ_, 'H')) < DAY_START_HOUR_ ? 86400000 : 0)), TZ_, 'yyyy-MM-dd');
  const totals = { english:0, coding:0, math:0, cognitive:0 };
  const days = {};
  let gain = 0, minutes = 0;
  activities.forEach(item => {
    const value = Number(item.minutes) || 0;
    minutes += value;
    if (Object.prototype.hasOwnProperty.call(totals, item.skill)) totals[item.skill] += value;
    gain += (Number(item.after) || 0) - (Number(item.before) || 0);
    const key = Utilities.formatDate(new Date(item.date), TZ_, 'yyyy-MM-dd');
    days[key] = true;
  });
  let streak = 0;
  const cursor = new Date(today + 'T12:00:00+07:00');
  if (!days[today]) cursor.setDate(cursor.getDate() - 1);
  while (days[Utilities.formatDate(cursor, TZ_, 'yyyy-MM-dd')]) { streak++; cursor.setDate(cursor.getDate() - 1); }
  const result = {ok:true,today:today,todayItems:activities.filter(item=>Utilities.formatDate(new Date(item.date),TZ_,'yyyy-MM-dd')===today),summary:{total:activities.length,minutes:minutes,gain:activities.length?Number((gain/activities.length).toFixed(1)):0,activeDays:Object.keys(days).length,streak:streak,xp:minutes*2,totals:totals}};
  cache.put('dashboard-summary-v2', JSON.stringify(result), 300);
  return result;
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
  clearDashboardCache_();
  return item;
}

function deleteActivity_(id) {
  const sheet = sheet_();
  if (!id || sheet.getLastRow() < 2) return false;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  const index = ids.findIndex(row => row[0] === id);
  if (index < 0) return false;
  sheet.deleteRow(index + 2);
  clearDashboardCache_();
  return true;
}

function rowToActivity_(row) {
  return { id:String(row[0]),date:String(row[1]),skill:String(row[3]),topic:String(row[4]),minutes:Number(row[5]),before:Number(row[6]),after:Number(row[7]),difficulty:Number(row[9]),learned:String(row[10]||''),problem:String(row[11]||''),next:String(row[12]||'') };
}

function response_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

/* -------------------------------------------------------------------------
   Summaries: metadata lives in Sheets; image/PDF bytes live in Drive.
   The tab and folder are created lazily so this stays in the same deployment.
   ------------------------------------------------------------------------- */
const SUMMARY_HEADERS = ['id','date','title','category','note','file_name','mime_type','file_id','file_url','preview_url','file_size','created_at','updated_at'];
const SUMMARY_CATEGORIES = ['coding','english','math','cognitive','work','life','other'];
const SUMMARY_MIME = ['application/pdf','image/jpeg','image/png','image/webp'];

function summarySheet_() {
  const book = SpreadsheetApp.openById(spreadsheetId_());
  let sheet = book.getSheetByName('Summaries');
  if (!sheet) {
    sheet = book.insertSheet('Summaries');
    sheet.getRange(1,1,1,SUMMARY_HEADERS.length).setValues([SUMMARY_HEADERS]);
    sheet.setFrozenRows(1); sheet.setColumnWidth(3,280); sheet.setColumnWidth(5,360);
  }
  const headers = sheet.getRange(1,1,1,SUMMARY_HEADERS.length).getDisplayValues()[0];
  if (headers.join('|') !== SUMMARY_HEADERS.join('|')) throw new Error('หัวตาราง Summaries ไม่ตรงกับเวอร์ชันนี้');
  return sheet;
}
function summaryFolder_() {
  const properties=PropertiesService.getScriptProperties();
  const saved=properties.getProperty('GROW_ROOM_SUMMARY_FOLDER_ID');
  if(saved){try{return DriveApp.getFolderById(saved)}catch(error){properties.deleteProperty('GROW_ROOM_SUMMARY_FOLDER_ID')}}
  const folder=DriveApp.createFolder('myGrow Summaries');
  properties.setProperty('GROW_ROOM_SUMMARY_FOLDER_ID',folder.getId());
  return folder;
}
function summaryFromRow_(row) {
  return {id:String(row[0]||'').replace(/^'/,''),date:String(row[1]||''),title:String(row[2]||''),category:String(row[3]||'other'),note:String(row[4]||''),fileName:String(row[5]||''),mimeType:String(row[6]||''),fileId:String(row[7]||''),fileUrl:String(row[8]||''),previewUrl:String(row[9]||''),fileSize:Number(row[10]||0),createdAt:String(row[11]||''),updatedAt:String(row[12]||'')};
}
function summaryRows_(sheet) {
  if(sheet.getLastRow()<2)return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,SUMMARY_HEADERS.length).getDisplayValues().map(summaryFromRow_).filter(item=>item.id);
}
function summaryInput_(item) {
  item=item||{};
  const value={date:String(item.date||''),title:String(item.title||'').trim(),category:String(item.category||'other'),note:String(item.note||'').trim()};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||isNaN(new Date(value.date+'T12:00:00').getTime()))throw new Error('วันที่สรุปไม่ถูกต้อง');
  if(!value.title||value.title.length>140)throw new Error('กรุณาระบุชื่อสรุปไม่เกิน 140 ตัวอักษร');
  if(SUMMARY_CATEGORIES.indexOf(value.category)<0)value.category='other';
  if(value.note.length>600)throw new Error('โน้ตยาวเกิน 600 ตัวอักษร');
  return value;
}
function summaries_(body) {
  const sheet=summarySheet_();
  if(body.action==='summaries_list'){
    const filter=String(body.category||'all'),query=String(body.query||'').trim().toLowerCase().slice(0,120);
    if((!filter||filter==='all')&&!query){
      const total=Math.max(0,sheet.getLastRow()-1),pageSize=int_(body.pageSize,12,1,48),pages=Math.max(1,Math.ceil(total/pageSize)),current=Math.min(int_(body.page,1,1,1000000),pages);
      const endRow=sheet.getLastRow()-(current-1)*pageSize,startRow=Math.max(2,endRow-pageSize+1),count=total?endRow-startRow+1:0;
      const items=count?sheet.getRange(startRow,1,count,SUMMARY_HEADERS.length).getDisplayValues().reverse().map(summaryFromRow_).filter(item=>item.id):[];
      return {ok:true,items:items,page:current,pageSize:pageSize,total:total,pages:pages};
    }
    const items=summaryRows_(sheet).filter(item=>(filter==='all'||item.category===filter)&&(!query||[item.title,item.note,item.fileName].join(' ').toLowerCase().indexOf(query)>=0)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    const result=page_(items,body,12,48);result.ok=true;return result;
  }
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    if(body.action==='summaries_upload'){
      const input=summaryInput_(body.item),upload=body.file||{},mime=String(upload.type||''),name=String(upload.name||'summary').replace(/[\\/:*?"<>|\r\n]+/g,'_').slice(0,180);
      if(SUMMARY_MIME.indexOf(mime)<0)throw new Error('รองรับเฉพาะ PDF, JPG, PNG และ WebP');
      let bytes;try{bytes=Utilities.base64Decode(String(upload.data||''))}catch(error){throw new Error('ข้อมูลไฟล์ไม่ถูกต้อง')}
      if(!bytes.length||bytes.length>3*1024*1024)throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 3 MB');
      let file;
      try{
        file=summaryFolder_().createFile(Utilities.newBlob(bytes,mime,name));
        try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW)}catch(error){}
        const id=Utilities.getUuid(),now=new Date().toISOString(),fileId=file.getId();
        const data={id:id,date:input.date,title:input.title,category:input.category,note:input.note,fileName:name,mimeType:mime,fileId:fileId,fileUrl:'https://drive.google.com/thumbnail?id='+encodeURIComponent(fileId)+'&sz=w1600',previewUrl:'https://drive.google.com/file/d/'+encodeURIComponent(fileId)+'/preview',fileSize:bytes.length,createdAt:now,updatedAt:now};
        sheet.appendRow(["'"+data.id,"'"+data.date,data.title,data.category,data.note,data.fileName,data.mimeType,"'"+data.fileId,data.fileUrl,data.previewUrl,data.fileSize,"'"+data.createdAt,"'"+data.updatedAt]);
        return {ok:true,item:data};
      }catch(error){if(file)try{file.setTrashed(true)}catch(ignore){}throw error}
    }
    if(body.action==='summaries_delete'){
      const id=String(body.id||'');if(!id||sheet.getLastRow()<2)return {ok:true,deleted:false};
      const column=sheet.getRange(2,1,sheet.getLastRow()-1,1),hit=column.createTextFinder(id).matchEntireCell(true).matchCase(true).findNext();
      if(!hit)return {ok:true,deleted:false};
      const row=hit.getRow(),fileId=String(sheet.getRange(row,8).getDisplayValue()||'').replace(/^'/,'');
      if(fileId)try{DriveApp.getFileById(fileId).setTrashed(true)}catch(error){}
      sheet.deleteRow(row);return {ok:true,deleted:true};
    }
    throw new Error('ACTION_INVALID');
  } finally {lock.releaseLock()}
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
    const book = SpreadsheetApp.openById(spreadsheetId_());
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
      .map((row,index) => ({
        row: index + 2,
        id: String(row[0] || '').replace(/^'/,''),
        date: String(row[1]),
        title: String(row[2]),
        detail: String(row[3] || ''),
        category: String(row[4] || 'life'),
        priority: String(row[5] || 'normal'),
        done: row[6] === true || String(row[6]).toLowerCase() === 'true',
        createdAt: String(row[7] || '')
      })).filter(item => item.id);

    if (body.action === 'todos_list') {
      const type = String(body.type || 'todo');
      const start = String(body.start || body.date || '');
      const end = String(body.end || body.date || '');
      const all = read();
      const filtered = all.filter(item => {
        const reflection = item.id.indexOf('reflection-') === 0;
        if (type === 'reflection' ? !reflection : reflection) return false;
        return (!start || item.date >= start) && (!end || item.date <= end);
      }).sort((a,b)=>String(b.date+b.createdAt).localeCompare(String(a.date+a.createdAt))).map(item=>{const copy=Object.assign({},item);delete copy.row;return copy;});
      const result = page_(filtered, body, 100, 300);
      result.ok = true;
      if (body.summary) {
        const scoped = all.filter(item => (type === 'reflection') === (item.id.indexOf('reflection-') === 0));
        result.summary = { total:scoped.length, days:new Set(scoped.map(item=>item.date)).size, done:scoped.filter(item=>item.done).length };
      }
      return result;
    }

    const ops = body.changes;
    if (!Array.isArray(ops) || !ops.length || ops.length > 100) throw new Error('INVALID_CHANGES');
    ops.forEach(op=>{if(!op||['upsert','delete'].indexOf(op.type)<0||!String(op.id||'')||String(op.id).length>100)throw new Error('INVALID_ID');if(op.type==='upsert'&&todoInput_(op.item).id!==op.id)throw new Error('INVALID_ID');});
    let rows = read();
    const changed = [];
    ops.forEach(op => {
      const found = rows.find(item=>item.id===op.id);
      if(op.type==='delete'){
        if(found){sheet.deleteRow(found.row);rows=rows.filter(item=>item.id!==op.id).map(item=>item.row>found.row?Object.assign({},item,{row:item.row-1}):item);}
        return;
      }
      const item=todoInput_(op.item);
      const row=found?found.row:sheet.getLastRow()+1;
      const now = new Date().toISOString();
      item.createdAt = found ? found.createdAt : (item.createdAt || now);
      if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
      const range = sheet.getRange(row, 1, 1, TODO_HEADERS.length);
      range.setNumberFormat('@');
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
      changed.push(item);
      if(!found)rows.push(Object.assign({row:row},item));
    });
    return { ok: true, items: changed, deleted: ops.filter(op=>op.type==='delete').map(op=>op.id) };
  } finally {
    lock.releaseLock();
  }
}

// Small wins share the existing spreadsheet and owner authentication.
function smallWins_(body) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const book = SpreadsheetApp.openById(spreadsheetId_());
    let sheet = book.getSheetByName('SmallWins');
    if (!sheet) { sheet = book.insertSheet('SmallWins'); sheet.appendRow(['id','date','category','text','updated_at']); sheet.setFrozenRows(1); }
    const read = () => sheet.getLastRow()<2 ? [] : sheet.getRange(2,1,sheet.getLastRow()-1,5).getDisplayValues().map((r,i)=>({row:i+2,id:String(r[0]||'').replace(/^'/,''),date:r[1],category:r[2],text:r[3]})).filter(x=>x.id);
    if (body.action === 'wins_list') {
      const start=String(body.start||body.date||''),end=String(body.end||body.date||'');
      const all=read(),items=all.filter(w=>(!start||w.date>=start)&&(!end||w.date<=end)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(w=>({id:w.id,date:w.date,category:w.category,text:w.text}));
      const result=page_(items,body,100,300);result.ok=true;
      if(body.summary)result.summary={total:all.length,days:new Set(all.map(w=>w.date)).size};
      return result;
    }
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
    let rows=read();const changed=[];
    ops.forEach(op=>{
      const found=rows.find(w=>w.id===op.id);
      if (op.type==='delete') { if(found){sheet.deleteRow(found.row);rows=rows.filter(w=>w.id!==op.id).map(w=>w.row>found.row?Object.assign({},w,{row:w.row-1}):w);} return; }
      if(found && op.createOnly)return;
      const w=op.item,row=found?found.row:sheet.getLastRow()+1;
      if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
      const range=sheet.getRange(row,1,1,5);range.setNumberFormat('@');
      // Leading apostrophe forces user text to remain literal, including '=...'.
      range.setValues([[w.id,w.date,w.category,w.text.trim(),new Date().toISOString()].map(v=>"'"+v)]);
      changed.push({id:w.id,date:w.date,category:w.category,text:w.text.trim()});
      if(!found)rows.push({row:row,id:w.id,date:w.date,category:w.category,text:w.text.trim()});
    });
    return {ok:true,items:changed,deleted:ops.filter(op=>op.type==='delete').map(op=>op.id)};
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
// Reading is tolerant of legacy rows; write validation remains strict above.
function cardRead_(raw){
  const c={};CARD_HEADERS.forEach(h=>c[h]=String(raw[h]==null?'':raw[h]));
  c.word=c.word.trim();c.meaning=c.meaning.trim();c.tag=c.tag.trim()||'General';
  ['level','due','correct','attempts'].forEach(h=>{const n=Number(c[h]);c[h]=isFinite(n)&&n>0?Math.floor(n):0});
  c.level=Math.max(0,Math.min(5,c.level));return c;
}
const CARD_CACHE_KEY_='cards_index_v1',CARD_CACHE_TTL_=300,CARD_CACHE_CHUNK_=60000;
function cardsCacheClear_(){try{CacheService.getScriptCache().remove(CARD_CACHE_KEY_)}catch(error){}}
function cardsCacheGet_(){try{const cache=CacheService.getScriptCache(),index=cache.get(CARD_CACHE_KEY_);if(!index)return null;const meta=JSON.parse(index),keys=[];for(let i=0;i<meta.n;i++)keys.push(meta.stamp+'_'+i);const parts=cache.getAll(keys);let text='';for(let i=0;i<meta.n;i++){if(parts[keys[i]]==null)return null;text+=parts[keys[i]]}const blob=Utilities.newBlob(Utilities.base64Decode(text),'application/x-gzip','cards.gz');return JSON.parse(Utilities.ungzip(blob).getDataAsString('UTF-8'))}catch(error){return null}}
function cardsCachePut_(cards){try{const text=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(cards),'application/json','cards.json')).getBytes()),stamp='cards_'+Date.now()+'_'+Math.floor(Math.random()*100000),values={},n=Math.ceil(text.length/CARD_CACHE_CHUNK_);if(n>40)return;for(let i=0;i<n;i++)values[stamp+'_'+i]=text.substr(i*CARD_CACHE_CHUNK_,CARD_CACHE_CHUNK_);const cache=CacheService.getScriptCache();cache.putAll(values,CARD_CACHE_TTL_);cache.put(CARD_CACHE_KEY_,JSON.stringify({stamp:stamp,n:n}),CARD_CACHE_TTL_)}catch(error){}}
function findCardRow_(sheet,id){
  if(!id||sheet.getLastRow()<2)return 0;
  const column=sheet.getRange(2,1,sheet.getLastRow()-1,1);
  if(column.createTextFinder){const hit=column.createTextFinder(String(id)).matchEntireCell(true).matchCase(true).findNext();return hit?hit.getRow():0;}
  const ids=column.getDisplayValues();for(let i=0;i<ids.length;i++)if(String(ids[i][0]).replace(/^'/,'')===String(id))return i+2;
  return 0;
}
function flashcards_(body) {
  if(body.action==='cards_uploadImage')return cardImage_(body.image);
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const book=SpreadsheetApp.openById(spreadsheetId_());let sheet=book.getSheetByName('Vocabulary');
    if(!sheet){sheet=book.insertSheet('Vocabulary');sheet.getRange(1,1,1,CARD_HEADERS.length).setValues([CARD_HEADERS]);sheet.setFrozenRows(1);}
    // Add createdAt to existing Vocabulary sheets without moving legacy data.
    let headers=sheet.getRange(1,1,1,CARD_HEADERS.length).getDisplayValues()[0];
    if(headers.slice(0,LEGACY_CARD_HEADERS.length).join('|')===LEGACY_CARD_HEADERS.join('|')&&!headers[LEGACY_CARD_HEADERS.length]){
      sheet.getRange(1,1,1,CARD_HEADERS.length).setValues([CARD_HEADERS]);headers=CARD_HEADERS;
    }
    // Refuse to write if a manually changed schema could shift existing data.
    if(headers.join('|')!==CARD_HEADERS.join('|'))throw new Error('หัวตาราง Vocabulary ไม่ตรงกับเวอร์ชันนี้');
    const readAll=()=>sheet.getLastRow()<2?[]:sheet.getRange(2,1,sheet.getLastRow()-1,CARD_HEADERS.length).getValues().map(row=>Object.fromEntries(CARD_HEADERS.map((h,j)=>[h,row[j]]))).filter(x=>x.id).map(cardRead_).filter(c=>c.word&&c.meaning);
    const readRow=row=>{const values=sheet.getRange(row,1,1,CARD_HEADERS.length).getValues()[0];return cardRead_(Object.fromEntries(CARD_HEADERS.map((h,j)=>[h,values[j]])));};
    const write=(c,row)=>{if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);const now=new Date().toISOString();c.createdAt=c.createdAt||c.updatedAt||now;c.updatedAt=now;const values=CARD_HEADERS.map(h=>typeof c[h]==='number'?c[h]:"'"+String(c[h]??''));sheet.getRange(row,1,1,CARD_HEADERS.length).setValues([values]);};
    if(body.action==='cards_list'){
      let all=body.refresh?null:cardsCacheGet_();if(!all){all=readAll();cardsCachePut_(all)}
      const now=Date.now(),query=String(body.query||'').trim().toLowerCase().slice(0,120),tag=String(body.tag||'all'),day=String(body.day||'all'),mode=String(body.mode||'study');
      const filtered=all.filter(c=>(tag==='all'||c.tag===tag)&&(day==='all'||String(c.createdAt||c.updatedAt).slice(0,10)===day)&&(!query||[c.word,c.meaning,c.tag].join(' ').toLowerCase().indexOf(query)>=0)&&(mode!=='study'||Number(c.due)<=now)).sort((a,b)=>mode==='study'?Number(a.due)-Number(b.due):String(b.createdAt||b.updatedAt).localeCompare(String(a.createdAt||a.updatedAt)));
      const result=page_(filtered,body,mode==='study'?100:50,mode==='study'?200:100);
      const levels=[0,0,0,0,0,0];let attempts=0,correct=0,nextDue=0,dueTotal=0;const tags={},days={};
      all.forEach(c=>{const level=Math.max(0,Math.min(5,Number(c.level)||0));levels[level]++;attempts+=Number(c.attempts)||0;correct+=Number(c.correct)||0;if(Number(c.due)<=now)dueTotal++;else if(!nextDue||Number(c.due)<nextDue)nextDue=Number(c.due);tags[c.tag]=(tags[c.tag]||0)+1;const key=String(c.createdAt||c.updatedAt).slice(0,10)||'unknown';days[key]=(days[key]||0)+1;});
      return {ok:true,cards:result.items,page:result.page,pageSize:result.pageSize,total:result.total,pages:result.pages,meta:{total:all.length,attempts:attempts,correct:correct,accuracy:attempts?Math.round(correct/attempts*100):0,mastered:levels[4]+levels[5],dueTotal:dueTotal,nextDue:nextDue,levels:levels,tags:tags,days:days}};
    }
    if(body.action==='cards_upsert'){
      const c=cardInput_(body.card),row=findCardRow_(sheet,c.id),old=row?readRow(row):null;
      // Editing text must not reset review progress.
      ['level','due','correct','attempts','lastReviewId'].forEach(h=>c[h]=old?old[h]:(h==='lastReviewId'?'':0));
      c.createdAt=old?(old.createdAt||old.updatedAt):c.createdAt;
      write(c,row||sheet.getLastRow()+1);cardsCacheClear_();return {ok:true,card:c};
    }
    if(body.action==='cards_delete'){const row=findCardRow_(sheet,String(body.id));if(row)sheet.deleteRow(row);cardsCacheClear_();return {ok:true};}
    if(body.action==='cards_review'){
      const row=findCardRow_(sheet,String(body.id));if(!row)throw new Error('ไม่พบคำศัพท์นี้');
      if(typeof body.remembered!=='boolean'||typeof body.reviewId!=='string'||!body.reviewId||body.reviewId.length>100)throw new Error('ข้อมูลการทบทวนไม่ถูกต้อง');
      const c=readRow(row);if(c.lastReviewId===body.reviewId)return {ok:true,card:c};
      c.level=body.remembered?Math.min(c.level+1,5):0;c.attempts++;c.correct+=body.remembered?1:0;
      c.due=body.remembered?nextDueMs_([0,1,3,7,14,30][c.level],Date.now()):Date.now()+600000;c.lastReviewId=body.reviewId;
      write(c,row);cardsCacheClear_();return {ok:true,card:c};
    }
    if(body.action==='cards_import'){
      if(!Array.isArray(body.cards)||body.cards.length>500)throw new Error('นำเข้าได้ครั้งละไม่เกิน 500 คำ');
      const known={};if(sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,1).getDisplayValues().forEach(r=>{if(r[0])known[String(r[0]).replace(/^'/,'')]=true;});
      const now=new Date().toISOString(),rows=[];
      body.cards.map(cardInput_).forEach(c=>{if(known[c.id])return;known[c.id]=true;c.createdAt=c.createdAt||c.updatedAt||now;c.updatedAt=now;rows.push(CARD_HEADERS.map(h=>typeof c[h]==='number'?c[h]:"'"+String(c[h]==null?'':c[h])))});
      if(rows.length){const first=sheet.getLastRow()+1,last=first+rows.length-1;if(last>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),last-sheet.getMaxRows());sheet.getRange(first,1,rows.length,CARD_HEADERS.length).setValues(rows);cardsCacheClear_()}
      return {ok:true,imported:rows.length};
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
    const book = SpreadsheetApp.openById(spreadsheetId_());
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
    let rows = read();
    const changed=[];
    ops.forEach(op => {
      const index = rows.findIndex(x => String(x.item.id) === op.id);
      if (op.type === 'delete') {
        // Deleting a goal takes its steps with it, bottom row first so the
        // remaining row numbers stay valid.
        const doomed = rows.filter(x => String(x.item.id) === op.id || String(x.item.goalId) === op.id).map(x => x.row);
        doomed.sort((a, b) => b - a).forEach(row => sheet.deleteRow(row));
        rows=read();
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
      changed.push(item);
      if(index<0)rows.push({row:row,item:item});
    });
    return { ok: true, items: changed, deleted:ops.filter(op=>op.type==='delete').map(op=>op.id) };
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
    const book = SpreadsheetApp.openById(spreadsheetId_());
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
    if (body.action === 'calendar_list') {
      const start=String(body.start||''),end=String(body.end||'');
      const rows=read().filter(x=>{
        const item=x.item;
        if(!start&&!end)return true;
        if(item.repeat==='none')return (!start||item.date>=start)&&(!end||item.date<=end);
        return (!end||item.date<=end)&&(!start||!item.repeatUntil||item.repeatUntil>=start);
      });
      const result=page_(shape(rows),body,150,300);result.ok=true;return result;
    }

    const ops = body.changes;
    if (!Array.isArray(ops) || ops.length > 500) throw new Error('INVALID_CHANGES');
    // Validate the whole batch before writing anything.
    ops.forEach(op => {
      if (!op || ['upsert', 'delete'].indexOf(op.type) < 0 || typeof op.id !== 'string' || !op.id || op.id.length > 100) throw new Error('INVALID_ID');
      if (op.type === 'upsert' && calInput_(op.item).id !== op.id) throw new Error('INVALID_ID');
    });
    let rows=read();const changed=[];
    ops.forEach(op => {
      const index = rows.findIndex(x => x.item.id === op.id);
      if (op.type === 'delete') { if (index >= 0) {const deletedRow=rows[index].row;sheet.deleteRow(deletedRow);rows=rows.filter((_,i)=>i!==index).map(x=>x.row>deletedRow?{row:x.row-1,item:x.item}:x);} return; }
      const item = calInput_(op.item), old = index >= 0 ? rows[index].item : null;
      const now = new Date().toISOString();
      item.createdAt = (old && old.createdAt) || item.createdAt || now;
      const row = index >= 0 ? rows[index].row : sheet.getLastRow() + 1;
      if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
      const range = sheet.getRange(row, 1, 1, CAL_HEADERS.length);
      range.setNumberFormat('@');
      // Leading apostrophe keeps user text literal, including a leading '='.
      range.setValues([CAL_HEADERS.map(h => "'" + String(h === 'updatedAt' ? now : item[h] == null ? '' : item[h]))]);
      changed.push(item);if(index<0)rows.push({row:row,item:item});
    });
    return { ok: true, items: changed, deleted:ops.filter(op=>op.type==='delete').map(op=>op.id) };
  } finally { lock.releaseLock(); }
}
