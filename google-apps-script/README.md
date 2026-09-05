# Grow Room Google Sheets integration

Keep all credentials in Apps Script Properties and server environment variables. Never commit their values.

## Enable SmallWins on the existing deployment

1. Open the existing spreadsheet → Extensions → Apps Script.
2. Replace the existing `Code.gs` with the complete `google-apps-script/Code.gs` from this repository and save. Preserve the existing `GROW_ROOM_SECRET` script property.
3. Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy. Update the existing deployment so the Web App URL stays the same; no environment changes are needed.
4. Open ความสำเร็จเล็ก ๆ and click โหลดใหม่. After the connection succeeds, click ย้ายรายการเดิมเข้า Sheet if shown, using the browser that holds the old records. Verify identity with the same owner code when prompted, then retry the action.

`SmallWins` uses columns `id`, `date`, `category`, `text`, `updated_at`. The script creates this tab if missing. Activities keeps its existing schema. Dates for new wins still default to today. Edits keep their original date. Migration uses stable IDs and never overwrites an existing cloud record. Local records are kept until synchronization succeeds. Every write uses the existing owner-token check and the existing Apps Script secret.

Validation: `npm run build` and `node --test tests/sheet-wins.test.mjs tests/wins-model.test.mjs`.
