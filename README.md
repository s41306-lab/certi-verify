# ระบบเกียรติบัตรโรงเรียน (School Certificate System)

ระบบจัดการลงทะเบียนกิจกรรมและออกเกียรติบัตรออนไลน์สำหรับโรงเรียน

**ขั้นตอนการใช้งาน (flow):**
1. ครูสร้างกิจกรรม และอัปโหลด "เกียรติบัตรเปล่า" (รูปพื้นเกียรติบัตร) ของแต่ละกิจกรรม
2. นักเรียนเลือกกิจกรรม แนบรูปหลักฐานการเข้าร่วม แล้วกดส่งคำขอ → สถานะ "รออนุมัติ"
3. ครูดูคำขอ + รูปหลักฐาน แล้วกด "อนุมัติ" = ระบบออกเกียรติบัตรทันที (เกียรติบัตรเปล่า + ชื่อนักเรียน = เกียรติบัตรสมบูรณ์) หรือ "ปฏิเสธ"
4. นักเรียนดาวน์โหลด/พิมพ์เกียรติบัตร (ถ้าครูยังไม่ได้อัปโหลดเกียรติบัตรเปล่า ระบบจะใช้แบบ HTML มาตรฐานให้อัตโนมัติ)

## เทคโนโลยีที่ใช้

- **Frontend:** HTML + CSS + Vanilla JS (หลายหน้า) — โฮสต์บน Vercel
- **Backend:** Node.js + Express — โฮสต์บน Render
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (อีเมล/รหัสผ่าน)
- **Storage:** Supabase Storage (รูปหลักฐาน)

## โครงสร้างโปรเจกต์

```
/frontend
├── index.html          → เด้งไปหน้า login/หน้าตามบทบาท
├── login.html          → เข้าสู่ระบบ (จำกัด @siya.ac.th)
├── student.html        → หน้านักเรียน (3 แท็บ)
├── admin.html          → หน้าครู (3 แท็บ)
├── certificate.html    → หน้าเกียรติบัตรสำหรับพิมพ์
├── vercel.json
└── assets/
    ├── config.js       → ตั้งค่า API_BASE (แก้ตรงนี้เมื่อ deploy)
    ├── app.js          → ฟังก์ชันร่วม (token, fetch, guard)
    └── styles.css

/backend
├── server.js           → เซิร์ฟเวอร์จริง (ต่อ Supabase)
├── mock-server.js      → เซิร์ฟเวอร์จำลอง in-memory (เดโมไม่ต้องใช้ Supabase)
├── supabase.js
├── routes/             → auth, activities, registrations, certificates
├── middleware/         → authMiddleware (ตรวจ JWT + บทบาท)
├── scripts/seed-users.js
├── render.yaml
└── .env.example

/database
├── schema.sql          → ตาราง + trigger + RLS + storage bucket
└── seed.sql            → ข้อมูลตัวอย่าง
```

## เริ่มเดโมแบบเร็ว (ไม่ต้องใช้ Supabase)

อยากดูหน้าเว็บทำงานบน localhost ก่อนค่อยไปต่อ Supabase ใช้ **mock backend**
ที่เก็บข้อมูลไว้ในหน่วยความจำ (รีสตาร์ทแล้วข้อมูลหาย) มีข้อมูลตัวอย่างให้พร้อม
ครู 1 + นักเรียน 2 + กิจกรรม 3 — API ตอบหน้าตาเหมือนตัวจริง frontend ไม่ต้องแก้

```bash
# 1) backend (mock — ไม่ต้องมีไฟล์ .env)
cd backend
npm install
npm run mock          # -> http://localhost:4000

# 2) frontend (เปิดอีกหน้าต่าง terminal)
cd frontend
npx serve -l 5500     # -> http://localhost:5500/login.html
```

เข้า http://localhost:5500/login.html แล้วล็อกอินด้วยบัญชีเดโม
(รหัสผ่านทุกบัญชี `Password123!`)

- ครู: `admin1@siya.ac.th`
- นักเรียน: `student1@siya.ac.th`, `student2@siya.ac.th`

ทดลองได้ครบทั้ง flow: นักเรียนลงทะเบียน → ครูอนุมัติ → นักเรียนแนบรูป → ครูออกเกียรติบัตร → พิมพ์
พอพร้อมใช้ของจริงค่อยทำตามขั้นตอน Supabase ด้านล่าง แล้วเปลี่ยนไปรัน `npm start` แทน

---

## ขั้นตอนการติดตั้งแบบเต็ม (Supabase)

### 1) สร้างโปรเจกต์ Supabase

1. ไปที่ https://supabase.com → New Project
2. เมื่อสร้างเสร็จ เข้า **SQL Editor → New query** วางเนื้อหาไฟล์ `database/schema.sql` ทั้งหมด แล้วกด **Run**
3. ไปที่ **Project Settings → API** คัดลอกค่า:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (เป็นความลับ!)

### 2) สร้างผู้ใช้เดโม

เลือกวิธีใดวิธีหนึ่ง:

**วิธี A — ผ่าน Dashboard:** Authentication → Users → **Add user**
สร้าง 3 บัญชี (ติ๊ก *Auto Confirm User* ทุกครั้ง) รหัสผ่าน `Password123!`
- `admin1@siya.ac.th`
- `student1@siya.ac.th`
- `student2@siya.ac.th`

จากนั้นไป SQL Editor รัน `database/seed.sql` เพื่อกำหนดบทบาท admin + ชื่อ + เพิ่มกิจกรรมตัวอย่าง

**วิธี B — ผ่านสคริปต์ (เร็วกว่า):** ตั้งค่า `.env` ให้เสร็จก่อน (ดูข้อ 3) แล้วรัน:

```bash
cd backend
npm install
node scripts/seed-users.js   # สร้างผู้ใช้ทั้ง 3 พร้อมบทบาท
```

แล้วรัน `database/seed.sql` (เฉพาะส่วนกิจกรรม) ใน SQL Editor เพื่อเพิ่มกิจกรรมตัวอย่าง

### 3) รัน Backend

```bash
cd backend
cp .env.example .env      # Windows: copy .env.example .env
# แก้ไข .env ใส่ค่าจาก Supabase
npm install
npm run dev               # หรือ npm start
# → API ที่ http://localhost:4000
```

### 4) รัน Frontend

`frontend/assets/config.js` ตั้ง `API_BASE = 'http://localhost:4000'` อยู่แล้ว
เปิดด้วย static server ใด ๆ เช่น **Live Server** ของ VS Code (พอร์ต 5500) หรือ:

```bash
cd frontend
npx serve -l 5500
```

> หมายเหตุ: อย่าเปิดไฟล์ด้วย `file://` ตรง ๆ เพราะ CORS จะบล็อก — ต้องเสิร์ฟผ่าน http
> หากเปลี่ยนพอร์ต ให้เพิ่ม origin นั้นใน `CORS_ORIGINS` ของ `.env` ด้วย

เปิด http://localhost:5500/login.html แล้วเข้าสู่ระบบด้วยบัญชีเดโม

## บัญชีเดโม

| บทบาท | อีเมล | รหัสผ่าน |
|-------|-------|----------|
| ครู (admin) | admin1@siya.ac.th | Password123! |
| นักเรียน | student1@siya.ac.th | Password123! |
| นักเรียน | student2@siya.ac.th | Password123! |

## API Endpoints

| Method | Path | สิทธิ์ | คำอธิบาย |
|--------|------|--------|----------|
| POST | `/api/auth/login` | - | เข้าสู่ระบบ คืน token + role |
| POST | `/api/auth/logout` | login | ออกจากระบบ |
| GET | `/api/activities` | login | ดูกิจกรรมทั้งหมด |
| POST | `/api/activities` | admin | เพิ่มกิจกรรม |
| DELETE | `/api/activities/:id` | admin | ลบกิจกรรม |
| POST | `/api/registrations` | student | ลงทะเบียนกิจกรรม |
| GET | `/api/registrations/mine` | student | ดูการลงทะเบียนของตัวเอง |
| GET | `/api/registrations/all` | admin | ดูการลงทะเบียนทั้งหมด |
| PATCH | `/api/registrations/:id/approve` | admin | อนุมัติ |
| PATCH | `/api/registrations/:id/reject` | admin | ปฏิเสธ |
| PATCH | `/api/registrations/:id/upload-proof` | student | แนบรูป (base64) |
| POST | `/api/certificates/:registrationId` | admin | ออกเกียรติบัตร |
| GET | `/api/certificates/mine` | student | ดูเกียรติบัตรของตัวเอง |
| GET | `/api/certificates/:id` | login | ดึงข้อมูลเกียรติบัตร 1 ใบ |

ทุก endpoint ที่ต้องล็อกอินส่ง header `Authorization: Bearer <token>`
ทุก error คืน JSON รูปแบบ `{ "error": "ข้อความ" }`

## สถานะการลงทะเบียน

`pending_approval` (รออนุมัติ) → `approved` (อนุมัติแล้ว) → `pending_review` (รอครูตรวจ หลังแนบรูป) → `certified` (ได้รับเกียรติบัตร)
หรือถูก `rejected` (ปฏิเสธ) ได้ทุกขั้น

## การ Deploy

### Backend → Render
1. Push โค้ดขึ้น GitHub
2. Render → New → Web Service → เลือก repo, ตั้ง **Root Directory** = `backend`
3. Build Command: `npm install` · Start Command: `node server.js`
4. ใส่ Environment Variables ตาม `.env.example` (โดยเฉพาะ `CORS_ORIGINS` = URL ของ Vercel)

### Frontend → Vercel
1. Vercel → New Project → เลือก repo, ตั้ง **Root Directory** = `frontend`
2. เป็น static site (ไม่ต้อง build)
3. แก้ `frontend/assets/config.js` ให้ `API_BASE` = URL ของ Render ก่อน deploy

## หมายเหตุความปลอดภัย

- `SUPABASE_SERVICE_ROLE_KEY` ใช้เฉพาะฝั่ง backend เท่านั้น ห้าม commit หรือส่งไป frontend
- Backend ใช้ service_role ซึ่งข้าม RLS แต่ middleware ตรวจ token + บทบาททุก request
- เปิด RLS ไว้ในฐานข้อมูลเพื่อกันการเรียกตรงด้วย anon key
