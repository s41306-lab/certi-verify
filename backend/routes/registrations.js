// routes/registrations.js — การลงทะเบียน + แนบหลักฐาน + อนุมัติ
const express = require('express');
const router = express.Router();
const { supabaseAdmin, STORAGE_BUCKET, uploadBase64 } = require('../supabase');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// flow ใหม่ (ขั้นตอนเดียว):
// นักเรียนแนบรูปหลักฐานตอนส่งคำขอ -> pending_approval
// ครูอนุมัติ = ออกเกียรติบัตรเลย -> certified  (หรือ rejected ถ้าปฏิเสธ)

// POST /api/registrations — นักเรียนลงทะเบียน + แนบรูปหลักฐานในขั้นตอนเดียว
router.post('/', requireAuth, async (req, res) => {
  const { activity_id, image_base64 } = req.body || {};
  if (!activity_id) {
    return res.status(400).json({ error: 'กรุณาระบุกิจกรรม' });
  }

  // กันลงซ้ำ
  const { data: existing } = await supabaseAdmin
    .from('registrations')
    .select('id')
    .eq('student_id', req.user.id)
    .eq('activity_id', activity_id)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'คุณลงทะเบียนกิจกรรมนี้แล้ว' });
  }

  let proof_image_url = null;
  try {
    if (image_base64) proof_image_url = await uploadBase64(image_base64, req.user.id);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const { data, error } = await supabaseAdmin
    .from('registrations')
    .insert({
      student_id: req.user.id,
      activity_id,
      status: 'pending_approval',
      proof_image_url,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ registration: data });
});

// GET /api/registrations/mine — นักเรียนดูของตัวเอง
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('registrations')
    .select(
      'id, status, proof_image_url, created_at, activity:activities(id, title, description, event_date)'
    )
    .eq('student_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ registrations: data });
});

// GET /api/registrations/all — admin ดูทั้งหมด
router.get('/all', requireAuth, requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('registrations')
    .select(
      'id, status, proof_image_url, created_at, ' +
        'student:profiles!registrations_student_id_fkey(id, full_name, email), ' +
        'activity:activities(id, title, event_date)'
    )
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ registrations: data });
});

// PATCH /api/registrations/:id/approve — admin อนุมัติ = ออกเกียรติบัตรเลย
router.patch('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: reg, error } = await supabaseAdmin
    .from('registrations')
    .update({ status: 'certified' })
    .eq('id', id)
    .eq('status', 'pending_approval')
    .select('id, student_id, activity_id')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!reg)
    return res
      .status(409)
      .json({ error: 'ไม่สามารถอนุมัติได้ (สถานะไม่ใช่ "รออนุมัติ")' });

  // ออกเกียรติบัตร (กันออกซ้ำ)
  const { data: existing } = await supabaseAdmin
    .from('certificates')
    .select('id, issued_at')
    .eq('registration_id', reg.id)
    .maybeSingle();

  let certificate = existing;
  if (!existing) {
    const { data, error: certErr } = await supabaseAdmin
      .from('certificates')
      .insert({
        registration_id: reg.id,
        student_id: reg.student_id,
        activity_id: reg.activity_id,
      })
      .select()
      .single();
    if (certErr) return res.status(500).json({ error: certErr.message });
    certificate = data;
  }

  res.json({ registration: { id: reg.id, status: 'certified' }, certificate });
});

// PATCH /api/registrations/:id/reject — admin ปฏิเสธ
router.patch('/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin
    .from('registrations')
    .update({ status: 'rejected' })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'ไม่พบรายการลงทะเบียน' });
  res.json({ registration: data });
});

// PATCH /api/registrations/:id/upload-proof — นักเรียนแนบรูป (base64 -> Storage)
router.patch('/:id/upload-proof', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { image_base64, filename } = req.body || {};
    if (!image_base64) {
      return res.status(400).json({ error: 'กรุณาแนบรูปภาพ' });
    }

    // ตรวจสอบว่าเป็นเจ้าของและสถานะ approved
    const { data: reg } = await supabaseAdmin
      .from('registrations')
      .select('id, student_id, status')
      .eq('id', id)
      .single();

    if (!reg) return res.status(404).json({ error: 'ไม่พบรายการลงทะเบียน' });
    if (reg.student_id !== req.user.id) {
      return res.status(403).json({ error: 'ไม่ใช่รายการของคุณ' });
    }
    if (reg.status !== 'approved' && reg.status !== 'pending_review') {
      return res
        .status(409)
        .json({ error: 'ต้องได้รับการอนุมัติก่อนจึงจะแนบหลักฐานได้' });
    }

    // แปลง base64 (รองรับ data URL) เป็น Buffer
    const match = /^data:(.+);base64,(.*)$/.exec(image_base64);
    const contentType = match ? match[1] : 'image/png';
    const b64data = match ? match[2] : image_base64;
    const buffer = Buffer.from(b64data, 'base64');

    const ext = (contentType.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const path = `${req.user.id}/${id}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType, upsert: true });

    if (upErr) return res.status(500).json({ error: upErr.message });

    const { data: pub } = supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    const { data, error } = await supabaseAdmin
      .from('registrations')
      .update({ proof_image_url: pub.publicUrl, status: 'pending_review' })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ registration: data });
  } catch (err) {
    console.error('[upload-proof]', err);
    res.status(500).json({ error: 'อัปโหลดรูปไม่สำเร็จ' });
  }
});

module.exports = router;
