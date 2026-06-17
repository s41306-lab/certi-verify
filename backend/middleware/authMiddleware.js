// middleware/authMiddleware.js
// ตรวจสอบ JWT จาก header `Authorization: Bearer <token>`
// - requireAuth : ต้องล็อกอิน (มี token ถูกต้อง) ไม่งั้น 401
// - requireAdmin: ต้องเป็น role = 'admin' ไม่งั้น 403

const { supabaseAdmin } = require('../supabase');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'ไม่พบ token กรุณาเข้าสู่ระบบ' });
    }

    // ยืนยัน token กับ Supabase Auth
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' });
    }

    // ดึง profile (role, ชื่อ) มาแนบกับ request
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', data.user.id)
      .single();

    if (profileErr || !profile) {
      return res.status(401).json({ error: 'ไม่พบโปรไฟล์ผู้ใช้' });
    }

    req.user = profile;
    req.accessToken = token;
    next();
  } catch (err) {
    console.error('[requireAuth]', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'เฉพาะครู/ผู้ดูแลเท่านั้น' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
