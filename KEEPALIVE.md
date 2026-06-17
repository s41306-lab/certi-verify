# กัน Backend (Render Free) ไม่ให้หลับ — ด้วยตัว Ping ฟรี

Render free จะ "หลับ" หลังไม่มีคนเรียก 15 นาที (ตื่นครั้งถัดไปช้า ~50 วิ)
วิธีแก้ฟรี: ตั้งตัว ping ภายนอกให้ยิง `GET /api/health` ทุก 5 นาที server จะตื่นตลอด

> Endpoint `/api/health` มีอยู่แล้วในโค้ด ([backend/server.js](backend/server.js)) — ตอบ `{"ok":true}`
> ต้อง **deploy backend ขึ้น Render ให้ได้ URL ก่อน** (ดู [DEPLOY.md](DEPLOY.md) ข้อ 3) เช่น
> `https://certi-verify-api.onrender.com`

---

## วิธี A — UptimeRobot (แนะนำ, ฟรี, มีแจ้งเตือนเว็บล่มด้วย)

1. ไปที่ [uptimerobot.com](https://uptimerobot.com) → สมัคร/ล็อกอิน (ใช้อีเมลโปรเจกต์)
2. กด **+ New monitor**
3. ตั้งค่า:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `certi-verify api`
   - **URL:** `https://<render-url>/api/health`
   - **Monitoring Interval:** `5 minutes`
4. กด **Create Monitor** — จบ ระบบจะยิงทุก 5 นาที ทำให้ Render ไม่หลับ
   (โบนัส: ถ้าเว็บล่มจะส่งอีเมลแจ้งเตือนให้)

---

## วิธี B — cron-job.org (ฟรี, ทางเลือก)

1. ไปที่ [cron-job.org](https://cron-job.org) → สมัคร/ล็อกอิน
2. **Create cronjob**
3. ตั้งค่า:
   - **Title:** `keepalive certi-verify`
   - **URL:** `https://<render-url>/api/health`
   - **Schedule:** Every `5` minutes
4. **Save** — เสร็จ

---

## ข้อควรรู้

- **โควต้า Render free:** 750 ชั่วโมง/เดือน/บัญชี — เปิด 24/7 ทั้งเดือน = ~744 ชม. ยังอยู่ในโควต้าฟรี (มี backend ตัวเดียว)
- ถ้ามี free service หลายตัวในบัญชีเดียว จะแชร์ 750 ชม. รวมกัน ระวังเกิน
- ตั้ง interval 5 นาทีกำลังดี (ถี่กว่านี้ไม่จำเป็น)
- ถ้าอยากชัวร์ 100% ไม่ต้องพึ่ง ping เลย → อัปเกรด Render Starter $7/เดือน หรือย้ายไป Koyeb/Railway

---

## ทดสอบว่าใช้ได้

หลังตั้งเสร็จ เปิด URL นี้ในเบราว์เซอร์ ควรเห็น `{"ok":true}` ทันที:
```
https://<render-url>/api/health
```
ถ้าตอบเร็ว (ไม่รอ ~50 วิ) แปลว่า server ตื่นอยู่ = ping ทำงาน
