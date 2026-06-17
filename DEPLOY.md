# คู่มือ Deploy ขึ้น Production (ภาษาไทย)

Deploy ระบบเกียรติบัตรโรงเรียนขึ้นใช้งานจริง ฟรีเกือบทั้งหมด
สถาปัตยกรรม: **Frontend (Vercel) + Backend (Render) + Database/Auth/Storage (Supabase)**

> แนะนำ: สมัครทุก service ด้วย **"Sign in with GitHub"** จะได้ไม่ต้องผูกเบอร์
> และใช้ **บัญชีเฉพาะของลูกค้า** (ไม่ใช่บัญชีส่วนตัวคุณ) เพื่อส่งมอบได้สะอาด
> ดูเอกสารส่งมอบที่ [HANDOVER.md](HANDOVER.md)

---

## 0) เตรียมบัญชี (ครั้งเดียว)

1. สมัคร **อีเมล** ที่ไม่ต้องผูกเบอร์ เช่น [Proton Mail](https://proton.me) หรือ [Tuta](https://tuta.com)
2. สมัคร **GitHub** ด้วยอีเมลนั้น (ใช้แค่อีเมล + captcha)
3. ใช้ GitHub login เข้า: [Supabase](https://supabase.com) · [Render](https://render.com) · [Vercel](https://vercel.com)

---

## 1) Push โค้ดขึ้น GitHub

```bash
cd certi-verify
git init
git add .
git commit -m "initial commit"
# สร้าง repo เปล่าใน GitHub ก่อน แล้วใส่ URL ของมัน
git remote add origin https://github.com/<user>/<repo>.git
git branch -M main
git push -u origin main
```

> ตรวจว่ามี `backend/.gitignore` กัน `node_modules` และ `.env` ไม่ให้หลุดขึ้น GitHub (มีให้แล้ว)

---

## 2) ตั้งค่า Supabase (Database + Auth + Storage)

1. [supabase.com](https://supabase.com) → **New Project** ตั้งชื่อ + ตั้ง Database Password (จดไว้)
2. รอ project พร้อม (~2 นาที) → เมนู **SQL Editor → New query**
   - วางเนื้อหาไฟล์ [database/schema.sql](database/schema.sql) ทั้งหมด → กด **Run** (สร้างตาราง + trigger + RLS + bucket `proofs`)
3. เมนู **Project Settings → API** คัดลอกค่า 3 ตัว (ใช้ในขั้นตอน Render):
   - `Project URL` → **SUPABASE_URL**
   - `anon public` → **SUPABASE_ANON_KEY**
   - `service_role` → **SUPABASE_SERVICE_ROLE_KEY** *(ความลับ! ห้ามใส่ใน frontend)*
4. **สร้างบัญชีครู/นักเรียน** เลือกวิธีใดวิธีหนึ่ง:
   - **ผ่าน Dashboard:** Authentication → Users → Add user (ติ๊ก *Auto Confirm User*)
     ตั้ง role ในช่อง User Metadata เป็น `{ "role": "admin" }` หรือ `{ "role": "student" }`
   - **ผ่าน script:** กรอก `backend/.env` ให้ครบ แล้วรัน `node backend/scripts/seed-users.js`
     (แก้รายชื่อ/อีเมลในไฟล์ก่อนได้)

> **สำคัญเรื่องโดเมนอีเมลโรงเรียน:** โปรเจกต์ตั้งค่าให้รับเฉพาะ `@siya.ac.th`
> ถ้าโรงเรียนลูกค้าใช้โดเมนอื่น ต้องแก้ **2 ที่** (ดูหัวข้อ "ปรับโดเมนโรงเรียน" ด้านล่าง)

---

## 3) Deploy Backend ที่ Render

1. [render.com](https://render.com) → **New → Web Service** → เลือก repo จาก GitHub
2. ตั้งค่า:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (หรือ Starter $7/เดือน ถ้าไม่อยากให้หลับ)
3. **Environment Variables** (Add ทีละตัว):

   | Key | Value |
   |-----|-------|
   | `SUPABASE_URL` | (จาก Supabase) |
   | `SUPABASE_ANON_KEY` | (จาก Supabase) |
   | `SUPABASE_SERVICE_ROLE_KEY` | (จาก Supabase) |
   | `SUPABASE_STORAGE_BUCKET` | `proofs` |
   | `ALLOWED_EMAIL_DOMAIN` | `siya.ac.th` *(หรือโดเมนโรงเรียนลูกค้า)* |
   | `CORS_ORIGINS` | (ใส่ทีหลังตอนได้ URL Vercel เช่น `https://xxx.vercel.app`) |

4. กด **Create Web Service** → รอ build เสร็จ จะได้ URL เช่น `https://certi-verify-api.onrender.com`
5. ทดสอบ: เปิด `https://<render-url>/api/health` ควรเห็น `{"ok":true}`

> **กัน Render หลับ (ฟรี):** ไปที่ [cron-job.org](https://cron-job.org) ตั้งให้ยิง GET
> `https://<render-url>/api/health` ทุก 10 นาที backend จะตื่นตลอดโดยไม่ต้องจ่าย

---

## 4) ชี้ Frontend ไปหา Backend

แก้ไฟล์ [frontend/assets/config.js](frontend/assets/config.js) ให้ชี้ไป URL ของ Render:

```js
window.API_BASE = 'https://certi-verify-api.onrender.com';
```

commit + push ขึ้น GitHub (Vercel จะ deploy ใหม่อัตโนมัติ)

```bash
git add frontend/assets/config.js
git commit -m "point frontend to production API"
git push
```

---

## 5) Deploy Frontend ที่ Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → เลือก repo
2. ตั้งค่า:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Other (เป็น static ไม่ต้อง build)
3. กด **Deploy** → ได้ URL เช่น `https://certi-verify.vercel.app`
4. กลับไปที่ **Render → Environment** ใส่ค่า `CORS_ORIGINS` เป็น URL Vercel นี้
   (หลายค่าใช้ comma เช่น `https://certi-verify.vercel.app`) → Render จะ restart เอง

---

## 6) ทดสอบ End-to-End

1. เปิด `https://<vercel-url>/login`
2. ล็อกอินเป็นครู → จัดการกิจกรรม → อัปโหลดเกียรติบัตรเปล่า
3. ล็อกอินเป็นนักเรียน → ส่งคำขอ + แนบรูป
4. ครูอนุมัติ → นักเรียนดาวน์โหลดเกียรติบัตร → กดพิมพ์
5. ครบ flow = เสร็จ

---

## ปรับโดเมนโรงเรียน (ถ้าไม่ใช่ @siya.ac.th)

แก้ **2 ที่** ให้เป็นโดเมนจริงของโรงเรียน:

1. **Backend (Render):** env var `ALLOWED_EMAIL_DOMAIN` = `โดเมนโรงเรียน`
2. **Frontend:** ไฟล์ [frontend/login.html](frontend/login.html) บรรทัดที่เช็ก regex
   `/@siya\.ac\.th$/i` → เปลี่ยนเป็นโดเมนโรงเรียน (และข้อความ placeholder/hint ในหน้า)

---

## สรุป URL/ค่าที่ต้องจำ

| รายการ | ค่า |
|--------|-----|
| Frontend (Vercel) | `https://________.vercel.app` |
| Backend (Render) | `https://________.onrender.com` |
| Supabase Project | `https://________.supabase.co` |
| โดเมนอีเมลที่อนุญาต | `siya.ac.th` |

ค่าใช้จ่าย: Supabase ฟรี · Vercel ฟรี · Render ฟรี (หรือ $7/เดือนถ้าไม่อยากให้หลับ)
