# Flashcards in myGrow

The new Flashcards page uses the existing spreadsheet, existing owner verification, and existing server environment variables. The dedicated `Vocabulary` tab holds words and review progress. There is no separate Sync settings page.

## One-time Apps Script update

1. In the existing Google spreadsheet, open Extensions → Apps Script.
2. Replace the existing `Code.gs` with the full `google-apps-script/Code.gs` from this commit and save. Preserve the existing script properties, including `GROW_ROOM_SECRET`.
3. At the top of the Apps Script editor, select the `authorizeDrive` function and click Run. Select Review permissions, choose the Google account that owns the sheet, and click Allow. The execution log should finish without an error.
4. Deploy → Manage deployments → pencil → Version: New version → Deploy. Set Execute as to Me and update the existing deployment to keep the same Web App URL.
5. Open Flashcards in myGrow and select โหลดใหม่. Vocabulary loads automatically on subsequent visits. Use the same owner code when prompted to add, edit, delete, import or review words.

The optional image-upload feature uses Google Drive, like the reference app. Running `authorizeDrive` once is required after adding this feature because an existing web-app deployment may not open the new consent screen automatically. Uploaded images go into `myGrow Vocabulary Images` and are readable by anyone with their link so they can appear in the cards. You may use an HTTPS image URL instead of uploading.

## Data

Columns, in order:
`id, word, phonetic, meaning, example, translation, tag, level, due, correct, attempts, imageUrl, imageFileId, updatedAt, lastReviewId`

- Keep the headers in this order. The script checks them before writing.
- The created tab includes the reference repository's ten starter words, not the user's separate app's private vocabulary or review history.
- Review levels use 1, 3, 7, 14 and 30 days. “ยังจำไม่ได้” returns a card to level 0 and schedules it for 10 minutes later. “ทบทวนทั้งหมด” allows additional practice before a due date.
- Editing a word preserves review history. Repeating the same review request ID does not count it twice.
- JSON import accepts either an array of cards or an object with a `cards` array (up to 500 per import). It preserves imported review progress and skips existing IDs rather than overwriting them. No synonym field is stored.
- “ส่งออกคำศัพท์” exports the current vocabulary to JSON. Existing browser storage on the separate Flashcards domain cannot be read automatically by myGrow.
- Reads load from Sheets automatically and cache for display. Failed writes do not advance the review or claim success.

## Verification

`npm run build`

`node --test tests/*.test.mjs`

Local browser preview was blocked by the browser environment; live rendering and real Apps Script connectivity still need checking after deployment.
