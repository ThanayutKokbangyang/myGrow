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
- Todos, SmallWins, Goals and Calendar writes use `{type, id, item}` operations. The browser never sends the complete list, and Apps Script reads the sheet once per write batch instead of once per item.
- Vocabulary returns only the due review queue or one 50-word library page. Review/edit/delete locate one ID with `TextFinder` and read only that row. Aggregate vocabulary statistics are returned separately.

After changing this file, update the existing Apps Script deployment with a new version before deploying the web app. The optimized web client expects these paginated responses.
