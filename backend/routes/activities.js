// routes/activities.js — จัดการกิจกรรม
const express = require('express');
const router = express.Router();
const { supabaseAdmin, uploadBase64 } = require('../supabase');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// แปลงแถวจาก DB -> รูปแบบที่ frontend ใช้ (ไม่ส่ง template url ก้อนใหญ่ในลิสต์)
function publicActivity(a) {
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

// GET /api/activities — ทุกคนที่ล็อกอินดูได้
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('activities')
    .select('id, title, description, event_date, image_url, certificate_template_url, created_at')
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ activities: data.map(publicActivity) });
});

// POST /api/activities — เฉพาะ admin
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, description, event_date, image_base64 } = req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อกิจกรรม' });
  }

  let image_url = null;
  try {
    if (image_base64) image_url = await uploadBase64(image_base64, 'activities');
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const { data, error } = await supabaseAdmin
    .from('activities')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      event_date: event_date || null,
      image_url,
      created_by: req.user.id,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ activity: publicActivity(data) });
});

// PATCH /api/activities/:id — แก้ไขกิจกรรม (เฉพาะ admin)
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { title, description, event_date, image_base64 } = req.body || {};
  const update = {};
  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ error: 'กรุณาระบุชื่อกิจกรรม' });
    update.title = title.trim();
  }
  if (description !== undefined) update.description = description?.trim() || null;
  if (event_date !== undefined) update.event_date = event_date || null;
  try {
    if (image_base64 !== undefined)
      update.image_url = image_base64 ? await uploadBase64(image_base64, 'activities') : null;
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const { data, error } = await supabaseAdmin
    .from('activities')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
  res.json({ activity: publicActivity(data) });
});

// PATCH /api/activities/:id/certificate-template — ครูอัปโหลด "เกียรติบัตรเปล่า"
router.patch('/:id/certificate-template', requireAuth, requireAdmin, async (req, res) => {
  const { image_base64 } = req.body || {};
  if (!image_base64) return res.status(400).json({ error: 'กรุณาแนบรูปเกียรติบัตร' });

  let url;
  try {
    url = await uploadBase64(image_base64, 'templates');
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const { data, error } = await supabaseAdmin
    .from('activities')
    .update({ certificate_template_url: url })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'ไม่พบกิจกรรม' });
  res.json({ activity: publicActivity(data) });
});

// DELETE /api/activities/:id — เฉพาะ admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin.from('activities').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'ลบกิจกรรมแล้ว' });
});

module.exports = router;
