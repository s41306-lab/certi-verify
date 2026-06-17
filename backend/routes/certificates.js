// routes/certificates.js — ออก/ดูเกียรติบัตร
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../supabase');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// POST /api/certificates/:registrationId — admin ออกเกียรติบัตร
router.post('/:registrationId', requireAuth, requireAdmin, async (req, res) => {
  const { registrationId } = req.params;

  // ดึงข้อมูลการลงทะเบียน ต้องอยู่สถานะ pending_review
  const { data: reg, error: regErr } = await supabaseAdmin
    .from('registrations')
    .select('id, student_id, activity_id, status')
    .eq('id', registrationId)
    .single();

  if (regErr || !reg)
    return res.status(404).json({ error: 'ไม่พบรายการลงทะเบียน' });
  if (reg.status !== 'pending_review') {
    return res
      .status(409)
      .json({ error: 'ต้องอยู่สถานะ "รอครูตรวจ" จึงจะออกเกียรติบัตรได้' });
  }

  // กันออกซ้ำ
  const { data: existing } = await supabaseAdmin
    .from('certificates')
    .select('id')
    .eq('registration_id', registrationId)
    .maybeSingle();

  let certificate = existing;
  if (!existing) {
    const { data, error } = await supabaseAdmin
      .from('certificates')
      .insert({
        registration_id: reg.id,
        student_id: reg.student_id,
        activity_id: reg.activity_id,
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    certificate = data;
  }

  // อัปเดตสถานะการลงทะเบียนเป็น certified
  await supabaseAdmin
    .from('registrations')
    .update({ status: 'certified' })
    .eq('id', registrationId);

  res.status(201).json({ certificate });
});

// GET /api/certificates/mine — นักเรียนดูเกียรติบัตรของตัวเอง
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('certificates')
    .select(
      'id, issued_at, activity:activities(id, title, event_date), ' +
        'student:profiles!certificates_student_id_fkey(full_name)'
    )
    .eq('student_id', req.user.id)
    .order('issued_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ certificates: data });
});

// GET /api/certificates/by-registration/:registrationId — หาเกียรติบัตรจาก reg id
router.get('/by-registration/:registrationId', requireAuth, async (req, res) => {
  const { registrationId } = req.params;
  const { data, error } = await supabaseAdmin
    .from('certificates')
    .select(
      'id, issued_at, student_id, ' +
        'activity:activities(id, title, description, event_date, certificate_template_url), ' +
        'student:profiles!certificates_student_id_fkey(full_name, email)'
    )
    .eq('registration_id', registrationId)
    .single();

  if (error || !data)
    return res.status(404).json({ error: 'ไม่พบเกียรติบัตร' });
  if (req.user.role !== 'admin' && data.student_id !== req.user.id) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูเกียรติบัตรนี้' });
  }
  res.json({ certificate: data });
});

// GET /api/certificates/:id — ดึงข้อมูลใบเดียว (สำหรับหน้า certificate.html)
// เจ้าของหรือ admin เท่านั้น
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from('certificates')
    .select(
      'id, issued_at, student_id, ' +
        'activity:activities(id, title, description, event_date, certificate_template_url), ' +
        'student:profiles!certificates_student_id_fkey(full_name, email)'
    )
    .eq('id', id)
    .single();

  if (error || !data)
    return res.status(404).json({ error: 'ไม่พบเกียรติบัตร' });
  if (req.user.role !== 'admin' && data.student_id !== req.user.id) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูเกียรติบัตรนี้' });
  }

  res.json({ certificate: data });
});

module.exports = router;
