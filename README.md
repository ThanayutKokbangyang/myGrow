# Grow Room

เว็บบันทึกและติดตามการพัฒนาตัวเองแบบเกม สร้างด้วย React + Vite

หน้าหลักใช้ Pixel UI พร้อมไอคอนภาพสำหรับ English, Coding, Math และ Cognitive ตัวละครเป็น sprite sheet 12 เฟรม เดินขึ้น ลง ซ้าย และขวาตามตำแหน่งที่คลิก

## ใช้งาน

```bash
npm install
npm run dev
```

ข้อมูลกิจกรรมถูกบันทึกใน `localStorage` ของเบราว์เซอร์ เหมาะสำหรับทดลองใช้งานก่อนเชื่อม Google Sheets ในขั้นต่อไป

## Deploy บน Vercel

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Private access

All data APIs require a signed session, including reads. Visitors see a password screen before the application mounts. Use the existing server-side `TAE_ACCESS_CODE` and `SESSION_SECRET`; never put either in Vite variables or committed files. Missing configuration keeps the site locked. Deploy both frontend and API changes together.

Login sets a Secure, HttpOnly, SameSite=Strict session cookie. The signed session expires after 12 hours and the cookie has no persistent Max-Age. The lock button clears it. Legacy bearer tokens are rejected and removed from browser storage. Cross-origin writes are rejected.

This protects the app and its APIs, not previously public Google Drive file links. Existing summaries use anyone-with-link sharing; revoke those links in Google Drive separately if their contents must also be private.
