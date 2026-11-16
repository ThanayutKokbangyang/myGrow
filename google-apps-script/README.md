# Grow Room Google Sheets integration

Keep all credentials in Apps Script Properties and server environment variables. Never commit their values.

## Enable SmallWins on the existing deployment

1. Open the existing spreadsheet → Extensions → Apps Script. In Project Settings → Script Properties, set `GROW_ROOM_SPREADSHEET_ID` to the spreadsheet ID (keep the existing `GROW_ROOM_SECRET`).
2. Replace the existing `Code.gs` with the complete `google-apps-script/Code.gs` from this repository and save. Preserve the existing `GROW_ROOM_SECRET` script property.
3. Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy. Update the existing deployment so the Web App URL stays the same; no environment changes are needed.
4. Open ความสำเร็จเล็ก ๆ and click โหลดใหม่. After the connection succeeds, click ย้ายรายการเดิมเข้า Sheet if shown, using the browser that holds the old records. Verify identity with the same owner code when prompted, then retry the action.

`SmallWins` uses columns `id`, `date`, `category`, `text`, `updated_at`. The script creates this tab if missing. Activities keeps its existing schema. Dates for new wins still default to today. Edits keep their original date. Migration uses stable IDs and never overwrites an existing cloud record. Local records are kept until synchronization succeeds. Every write uses the existing owner-token check and the existing Apps Script secret.

Validation: `npm run build` and `node --test tests/sheet-wins.test.mjs tests/wins-model.test.mjs`.

## Performance contract

- Activities returns 40 rows per request and performs search/filtering before sending the response. Dashboard totals are calculated from the complete Activities sheet and cached for five minutes; writes invalidate that cache immediately.
- Todos, reflections, SmallWins and Calendar accept `date` or `start`/`end` windows. Calendar screens request only the visible six-week window.

## Summaries (รูป/PDF)

หน้า `สรุปของเรา` ใช้แท็บ `Summaries` และโฟลเดอร์ Drive `myGrow Summaries` ซึ่งระบบสร้างให้อัตโนมัติเมื่อใช้งานครั้งแรก ข้อมูลชื่อเรื่อง หมวดหมู่ โน้ต และลิงก์อยู่ในชีต ส่วนไฟล์จริงอยู่ใน Drive รายการปกติอ่านจากช่วงข้อมูลเฉพาะหน้าละ 12 รายการ; ระบบจะอ่าน metadata ทั้งหมดเฉพาะตอนค้นหาหรือกรองหมวดหมู่

หลังวาง `Code.gs` เวอร์ชันนี้ ให้รัน `authorizeDrive()` หนึ่งครั้งเพื่ออนุญาต Drive แล้ว Deploy Apps Script เป็นเวอร์ชันใหม่ โดยใช้ Production deployment เดิม ไฟล์รองรับ PDF, JPG, PNG และ WebP ขนาดไม่เกิน 3 MB ต่อไฟล์
- Todos, SmallWins, Goals and Calendar writes use `{type, id, item}` operations. The browser never sends the complete list, and Apps Script reads the sheet once per write batch instead of once per item.
- Vocabulary returns only the due review queue or one 50-word library page. Review/edit/delete locate one ID with `TextFinder` and read only that row. Aggregate vocabulary statistics are returned separately.

After changing this file, update the existing Apps Script deployment with a new version before deploying the web app. The optimized web client expects these paginated responses.

## Web performance update (November 2026)

The Flashcards web mode and its proxy endpoints have been removed. Existing Vocabulary rows and files are retained; legacy Apps Script helpers remain for data compatibility. No Apps Script redeployment is needed for this web-only update.

Feature screens load on demand. Browser API reads are deduplicated and cached for at most 60 seconds in memory (not persistent storage), with bounded entries. Successful mutations invalidate their resource cache; activity mutations also invalidate dashboard data. Explicit reloads bypass freshness. PNG illustrations with exact pixel-equivalent WebP replacements are served as WebP.

## Kanban board (บอร์ดงาน)

Before deploying the web branch, replace the existing Apps Script `Code.gs` with this repository's complete `google-apps-script/Code.gs`. Keep the existing `GROW_ROOM_SECRET` and `GROW_ROOM_SPREADSHEET_ID`. Deploy → Manage deployments → Edit → New version → Deploy, keeping the same Web App URL.

The first board request creates a `Kanban` tab with three columns: สิ่งที่ต้องทำ, กำลังทำ, เสร็จแล้ว. Existing sheets are untouched. One board supports up to 12 custom columns and 500 cards. Card titles, details, priority, due date, column, and ordering are stored in Sheets. Empty columns can be removed; columns holding cards must be emptied first. Mark any column as completed to include its cards in the completed count.

Updates validate the whole resulting board under a script lock and check per-item revisions to reject stale changes from another tab. A bounded rectangular write stores literal text and clears removed rows. The client sends only changed operations, keeps the server's resulting revisions, and rolls back optimistic UI changes on failure. Reload before retrying a conflict. The API inherits the site's existing password/session checks. No extra environment variables or database setup are required.

On desktop, drag cards onto a card to insert before it, or onto a column to append. On mobile and with a keyboard, use the column selector under each card. Column arrow buttons reorder columns. Search and priority filters affect only the view, not stored cards.

### Board interaction refinements

The board keeps a serialized browser save queue: moves update immediately while earlier writes are still pending, then pending edits are rebased on acknowledged revisions. A failure restores the last confirmed snapshot, and another tab's unrelated changes cause a conflict rather than being silently overwritten. The queue survives switching modes, and the lock action discards private in-memory state. A freshly saved board is reused for up to one minute; โหลดใหม่ explicitly refreshes it.

Use เพิ่มการ์ด at the bottom of a column to type a title inline, then Enter to add it (Shift+Enter inserts a line break). Open a card for full details; Ctrl/Command+Enter saves and Escape closes. Edge scrolling assists desktop dragging, arrow buttons scroll the board, and mobile retains its per-card column selector. Motion respects reduced-motion preferences. These interaction changes require no further Apps Script changes beyond the Kanban version above.

## Daily routines and calendar stamps (รูทีน)

Update the existing Apps Script project using this branch's latest complete `google-apps-script/Code.gs`, then Deploy → Manage deployments → Edit → New version → Deploy. Keep the existing URL, `GROW_ROOM_SECRET` and `GROW_ROOM_SPREADSHEET_ID`. The authenticated `/api/routines` endpoints need no new environment variables. First use creates `Routines` and `RoutineDays`; existing sheets are untouched.

Add up to 50 daily routine items. Ticking every item awards one calendar stamp for that day after the write succeeds. An empty list never awards a stamp. Unchecking an item revokes today's stamp. Only the current learning day (05:00 Asia/Bangkok through 04:59 the next morning) can be checked; earlier dates are read-only and future dates cannot be completed.

The first actual check stores a snapshot of that day's item IDs, titles and icons. Later changes to the master list apply on the next day once today's snapshot exists; before the first check, additions/edits appear immediately. Historical snapshots/stamps are preserved when an item is renamed or removed from the master list. Removal archives the master record rather than deleting history. Calendar reads use summary columns, with only the selected day's full JSON snapshot loaded.

Writes run under a script lock and check revisions. Check operations are serialized in the browser while the list updates immediately; the stamp and existing celebration animation wait for confirmation. A failed request restores confirmed checks and does not award a new stamp. The queue survives switching modes and is cleared when the site locks. The new page uses the established pixel palette, icons, sound and WinCelebration. Only Weekly progress is removed from the existing Today page; the room, Today's plan, history and progress pages retain their original UI.
