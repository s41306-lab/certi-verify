// mock-server.js — backend จำลองสำหรับเดโม "ไม่ต้องใช้ Supabase"
// เก็บข้อมูลทั้งหมดไว้ใน memory (รีสตาร์ทเซิร์ฟเวอร์แล้วข้อมูลหาย)
// ตอบ JSON หน้าตาเหมือน server.js ตัวจริงทุกประการ frontend จึงใช้ได้เลย
//
// รัน:  npm run mock   (หรือ node mock-server.js)
// พอพร้อมต่อ Supabase จริงแล้วค่อยใช้  npm start  แทน
//
// บัญชีเดโม (รหัสผ่านเดียวกันหมด: Password123!)
//   ครู:      admin1@siya.ac.th
//   นักเรียน: student1@siya.ac.th, student2@siya.ac.th

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '12mb' })); // รองรับ base64 รูปภาพ
app.use(cors({ origin: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ---------- ข้อมูลจำลองในหน่วยความจำ ----------
const db = {
  users: [
    { id: uid(), email: 'admin1@siya.ac.th',   password: 'Password123!', full_name: 'ครูสมศรี ใจดี',                role: 'admin'   },
    { id: uid(), email: 'student1@siya.ac.th', password: 'Password123!', full_name: 'เด็กชายธนภัทร ตั้งใจเรียน',     role: 'student' },
    { id: uid(), email: 'student2@siya.ac.th', password: 'Password123!', full_name: 'เด็กหญิงพิมพ์ชนก รักการอ่าน',  role: 'student' },
  ],
  activities: [],
  registrations: [],
  certificates: [],
  tokens: new Map(), // token -> userId
};

// 3 กิจกรรมตัวอย่าง
const adminId = db.users[0].id;
[
  { title: 'วันวิทยาศาสตร์',     description: 'นิทรรศการและการแข่งขันโครงงานวิทยาศาสตร์', event_date: '2026-08-18' },
  { title: 'วันภาษาไทย',         description: 'กิจกรรมส่งเสริมการใช้ภาษาไทยและการอ่าน',    event_date: '2026-07-29' },
  { title: 'วันอาสาพัฒนาชุมชน',  description: 'ร่วมพัฒนาและทาสีอาคารเรียนในชนบท',          event_date: '2026-09-12' },
].forEach((a) => {
  db.activities.push({
    id: uid(),
    ...a,
    image_url: null,                 // รูปหน้าปกกิจกรรม (base64 data URL)
    certificate_template_url: null,  // รูปเกียรติบัตรเปล่าที่ครูอัปโหลด
    created_by: adminId,
    created_at: now(),
  });
});

// ---------- helper: ประกอบข้อมูลเชื่อมโยง (จำลอง join ของ Supabase) ----------
const userById = (id) => db.users.find((u) => u.id === id);
const activityById = (id) => db.activities.find((a) => a.id === id);

function publicActivity(a) {
  if (!a) return null;
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    event_date: a.event_date,
    image_url: a.image_url || null,
    has_certificate_template: !!a.certificate_template_url,
    created_at: a.created_at,
  };
}
function regForStudent(r) {
  const a = activityById(r.activity_id);
  return {
    id: r.id,
    status: r.status,
    proof_image_url: r.proof_image_url,
    created_at: r.created_at,
    activity: a ? { id: a.id, title: a.title, description: a.description, event_date: a.event_date } : null,
  };
}
function regForAdmin(r) {
  const a = activityById(r.activity_id);
  const s = userById(r.student_id);
  return {
    id: r.id,
    status: r.status,
    proof_image_url: r.proof_image_url,
    created_at: r.created_at,
    student: s ? { id: s.id, full_name: s.full_name, email: s.email } : null,
    activity: a ? { id: a.id, title: a.title, event_date: a.event_date } : null,
  };
}
function certFull(c) {
  const a = activityById(c.activity_id);
  const s = userById(c.student_id);
  return {
    id: c.id,
    issued_at: c.issued_at,
    student_id: c.student_id,
    activity: a
      ? {
          id: a.id,
          title: a.title,
          description: a.description,
          event_date: a.event_date,
          certificate_template_url: a.certificate_template_url || null,
        }
      : null,
    student: s ? { full_name: s.full_name, email: s.email } : null,
  };
}

// ---------- middleware ----------
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: 'ไม่พบ token กรุณาเข้าสู่ระบบ' });

  const userId = db.tokens.get(token);
  const user = userId && userById(userId);
  if (!user) return res.status(401).json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' });

  req.user = { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
  req.accessToken = token;
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin')
    return res.status(403).json({ error: 'เฉพาะครู/ผู้ดูแลเท่านั้น' });
  next();
}

// ---------- health ----------
app.get('/', (req, res) => res.json({ ok: true, service: 'school-certificate-api (mock)' }));
app.get('/api/health', (req, res) => res.json({ ok: true, mode: 'mock' }));

// ---------- auth ----------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
  if (!/@siya\.ac\.th$/i.test(email))
    return res.status(403).json({ error: 'อนุญาตเฉพาะอีเมล @siya.ac.th เท่านั้น' });

  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password)
    return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

  const token = crypto.randomBytes(24).toString('hex');
  db.tokens.set(token, user.id);
  res.json({
    token,
    role: user.role,
    profile: { id: user.id, email: user.email, full_name: user.full_name },
  });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  db.tokens.delete(req.accessToken);
  res.json({ message: 'ออกจากระบบแล้ว' });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ profile: req.user }));

// ---------- activities ----------
app.get('/api/activities', requireAuth, (req, res) => {
  const list = [...db.activities].sort((a, b) => {
    // event_date ascending (null อยู่ท้าย) แล้วตามด้วย created_at ใหม่สุดก่อน
    if (a.event_date && b.event_date && a.event_date !== b.event_date)
      return a.event_date < b.event_date ? -1 : 1;
    if (!a.event_date && b.event_date) return 1;
    if (a.event_date && !b.event_date) return -1;
    return b.created_at < a.created_at ? -1 : 1;
  });
  res.json({ activities: list.map(publicActivity) });
});

app.post('/api/activities', requireAuth, requireAdmin, (req, res) => {
  const { title, description, event_date } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'กรุณาระบุชื่อกิจกรรม' });
  const activity = {
    id: uid(),
    title: title.trim(),
    description: description?.trim() || null,
    event_date: event_date || null,
    created_by: req.user.id,
    created_at: now(),
  };
  db.activities.push(activity);
  res.status(201).json({ activity: publicActivity(activity) });
});

app.delete('/api/activities/:id', requireAuth, requireAdmin, (req, res) => {
  const { id } = req.params;
  const idx = db.activities.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
  db.activities.splice(idx, 1);
  // cascade: ลบการลงทะเบียน + เกียรติบัตรที่ผูกกับกิจกรรมนี้
  db.registrations = db.registrations.filter((r) => r.activity_id !== id);
  db.certificates = db.certificates.filter((c) => c.activity_id !== id);
  res.json({ message: 'ลบกิจกรรมแล้ว' });
});

// PATCH /api/activities/:id — แก้ไขกิจกรรม (เฉพาะ admin)
app.patch('/api/activities/:id', requireAuth, requireAdmin, (req, res) => {
  const a = activityById(req.params.id);
  if (!a) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
  const { title, description, event_date, image_base64 } = req.body || {};
  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ error: 'กรุณาระบุชื่อกิจกรรม' });
    a.title = title.trim();
  }
  if (description !== undefined) a.description = description?.trim() || null;
  if (event_date !== undefined) a.event_date = event_date || null;
  if (image_base64 !== undefined) a.image_url = image_base64 || null;
  res.json({ activity: publicActivity(a) });
});

// PATCH /api/activities/:id/certificate-template — ครูอัปโหลด "เกียรติบัตรเปล่า"
app.patch('/api/activities/:id/certificate-template', requireAuth, requireAdmin, (req, res) => {
  const a = activityById(req.params.id);
  if (!a) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
  const { image_base64 } = req.body || {};
  if (!image_base64) return res.status(400).json({ error: 'กรุณาแนบรูปเกียรติบัตร' });
  a.certificate_template_url = image_base64; // โหมด mock: เก็บ data URL ตรง ๆ
  res.json({ activity: publicActivity(a) });
});

// ---------- registrations ----------
app.post('/api/registrations', requireAuth, (req, res) => {
  // นักเรียนแนบรูปหลักฐานมาพร้อมกับการส่งคำขอเลย (image_base64 ไม่บังคับ)
  const { activity_id, image_base64 } = req.body || {};
  if (!activity_id) return res.status(400).json({ error: 'กรุณาระบุกิจกรรม' });
  if (!activityById(activity_id)) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });

  const dup = db.registrations.find(
    (r) => r.student_id === req.user.id && r.activity_id === activity_id
  );
  if (dup) return res.status(409).json({ error: 'คุณลงทะเบียนกิจกรรมนี้แล้ว' });

  const reg = {
    id: uid(),
    student_id: req.user.id,
    activity_id,
    status: 'pending_approval',
    proof_image_url: image_base64 || null, // โหมด mock: เก็บ data URL ตรง ๆ
    created_at: now(),
  };
  db.registrations.push(reg);
  res.status(201).json({ registration: reg });
});

app.get('/api/registrations/mine', requireAuth, (req, res) => {
  const list = db.registrations
    .filter((r) => r.student_id === req.user.id)
    .sort((a, b) => (b.created_at < a.created_at ? -1 : 1));
  res.json({ registrations: list.map(regForStudent) });
});

app.get('/api/registrations/all', requireAuth, requireAdmin, (req, res) => {
  const list = [...db.registrations].sort((a, b) => (b.created_at < a.created_at ? -1 : 1));
  res.json({ registrations: list.map(regForAdmin) });
});

// อนุมัติ = ออกเกียรติบัตรเลยในขั้นตอนเดียว (เกียรติบัตรเปล่า + ชื่อนักเรียน = สมบูรณ์)
app.patch('/api/registrations/:id/approve', requireAuth, requireAdmin, (req, res) => {
  const reg = db.registrations.find((r) => r.id === req.params.id);
  if (!reg) return res.status(404).json({ error: 'ไม่พบรายการลงทะเบียน' });
  if (reg.status !== 'pending_approval')
    return res.status(409).json({ error: 'ไม่สามารถอนุมัติได้ (สถานะไม่ใช่ "รออนุมัติ")' });

  reg.status = 'certified';
  let cert = db.certificates.find((c) => c.registration_id === reg.id);
  if (!cert) {
    cert = {
      id: uid(),
      registration_id: reg.id,
      student_id: reg.student_id,
      activity_id: reg.activity_id,
      issued_at: now(),
    };
    db.certificates.push(cert);
  }
  res.json({ registration: reg, certificate: cert });
});

app.patch('/api/registrations/:id/reject', requireAuth, requireAdmin, (req, res) => {
  const reg = db.registrations.find((r) => r.id === req.params.id);
  if (!reg) return res.status(404).json({ error: 'ไม่พบรายการลงทะเบียน' });
  reg.status = 'rejected';
  res.json({ registration: reg });
});

app.patch('/api/registrations/:id/upload-proof', requireAuth, (req, res) => {
  const { image_base64 } = req.body || {};
  if (!image_base64) return res.status(400).json({ error: 'กรุณาแนบรูปภาพ' });

  const reg = db.registrations.find((r) => r.id === req.params.id);
  if (!reg) return res.status(404).json({ error: 'ไม่พบรายการลงทะเบียน' });
  if (reg.student_id !== req.user.id) return res.status(403).json({ error: 'ไม่ใช่รายการของคุณ' });
  if (reg.status !== 'approved' && reg.status !== 'pending_review')
    return res.status(409).json({ error: 'ต้องได้รับการอนุมัติก่อนจึงจะแนบหลักฐานได้' });

  // โหมด mock: เก็บ data URL ตรง ๆ ไม่ต้องมี object storage
  reg.proof_image_url = image_base64;
  reg.status = 'pending_review';
  res.json({ registration: reg });
});

// ---------- certificates ----------
app.post('/api/certificates/:registrationId', requireAuth, requireAdmin, (req, res) => {
  const reg = db.registrations.find((r) => r.id === req.params.registrationId);
  if (!reg) return res.status(404).json({ error: 'ไม่พบรายการลงทะเบียน' });
  if (reg.status !== 'pending_review')
    return res.status(409).json({ error: 'ต้องอยู่สถานะ "รอครูตรวจ" จึงจะออกเกียรติบัตรได้' });

  let cert = db.certificates.find((c) => c.registration_id === reg.id);
  if (!cert) {
    cert = {
      id: uid(),
      registration_id: reg.id,
      student_id: reg.student_id,
      activity_id: reg.activity_id,
      issued_at: now(),
    };
    db.certificates.push(cert);
  }
  reg.status = 'certified';
  res.status(201).json({ certificate: cert });
});

app.get('/api/certificates/mine', requireAuth, (req, res) => {
  const list = db.certificates
    .filter((c) => c.student_id === req.user.id)
    .sort((a, b) => (b.issued_at < a.issued_at ? -1 : 1))
    .map((c) => {
      const a = activityById(c.activity_id);
      const s = userById(c.student_id);
      return {
        id: c.id,
        issued_at: c.issued_at,
        activity: a ? { id: a.id, title: a.title, event_date: a.event_date } : null,
        student: s ? { full_name: s.full_name } : null,
      };
    });
  res.json({ certificates: list });
});

app.get('/api/certificates/by-registration/:registrationId', requireAuth, (req, res) => {
  const cert = db.certificates.find((c) => c.registration_id === req.params.registrationId);
  if (!cert) return res.status(404).json({ error: 'ไม่พบเกียรติบัตร' });
  if (req.user.role !== 'admin' && cert.student_id !== req.user.id)
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูเกียรติบัตรนี้' });
  res.json({ certificate: certFull(cert) });
});

app.get('/api/certificates/:id', requireAuth, (req, res) => {
  const cert = db.certificates.find((c) => c.id === req.params.id);
  if (!cert) return res.status(404).json({ error: 'ไม่พบเกียรติบัตร' });
  if (req.user.role !== 'admin' && cert.student_id !== req.user.id)
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูเกียรติบัตรนี้' });
  res.json({ certificate: certFull(cert) });
});

// ---------- 404 + error ----------
app.use((req, res) => res.status(404).json({ error: 'ไม่พบเส้นทางที่ร้องขอ' }));
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[mock] API (in-memory) listening on http://localhost:${PORT}`);
  console.log('[mock] ล็อกอินเดโม: admin1@siya.ac.th / student1@siya.ac.th  รหัส: Password123!');
});

module.exports = app;
