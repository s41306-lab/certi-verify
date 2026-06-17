// routes/auth.js — login / logout
const express = require('express');
const router = express.Router();
const { supabaseAnon, supabaseAdmin } = require('../supabase');
const { requireAuth } = require('../middleware/authMiddleware');

// โดเมนอีเมลที่อนุญาต (คั่นด้วย comma) ค่าว่าง = อนุญาตทุกโดเมน
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAIN || '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function domainAllowed(email) {
  if (ALLOWED_DOMAINS.length === 0) return true;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    }
    if (!domainAllowed(email)) {
      return res.status(403).json({
        error: `อนุญาตเฉพาะอีเมล @${ALLOWED_DOMAINS.join(', @')} เท่านั้น`,
      });
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.session) {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    // ดึง role จาก profiles
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', data.user.id)
      .single();

    if (!profile) {
      return res
        .status(403)
        .json({ error: 'ยังไม่ได้ตั้งค่าโปรไฟล์ผู้ใช้ ติดต่อผู้ดูแลระบบ' });
    }

    return res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      role: profile.role,
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
      },
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    // เพิกถอน session ของ token นี้
    await supabaseAdmin.auth.admin.signOut(req.accessToken).catch(() => {});
    return res.json({ message: 'ออกจากระบบแล้ว' });
  } catch (err) {
    return res.json({ message: 'ออกจากระบบแล้ว' });
  }
});

// GET /api/auth/me — ข้อมูลผู้ใช้ปัจจุบัน (สะดวกให้ frontend ตรวจ session)
router.get('/me', requireAuth, (req, res) => {
  res.json({ profile: req.user });
});

module.exports = router;
