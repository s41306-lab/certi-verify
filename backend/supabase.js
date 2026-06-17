// supabase.js — ตั้งค่า Supabase clients
// มี 2 client:
//   1) supabaseAnon  : ใช้ login (signInWithPassword) ในนามผู้ใช้ทั่วไป
//   2) supabaseAdmin : ใช้ service_role key ข้าม RLS สำหรับงานฝั่ง server
//                      (ยืนยัน token, อ่าน/เขียนข้อมูลที่ middleware ตรวจสิทธิ์แล้ว)

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '\n[supabase] ขาดค่า env: ต้องมี SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY\n' +
      '   คัดลอก backend/.env.example ไปเป็น backend/.env แล้วกรอกค่าให้ครบ แล้วรันใหม่\n'
  );
  process.exit(1);
}

// client สำหรับ login (ไม่เก็บ session ฝั่ง server)
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// client สิทธิ์เต็ม (service_role) — ห้ามส่ง key นี้ออกไปหา client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'proofs';

// อัปโหลดรูปจาก base64 / data URL ขึ้น Storage แล้วคืน public URL
// prefix = โฟลเดอร์ย่อยใน bucket เช่น 'proofs' หรือ 'templates'
async function uploadBase64(image_base64, prefix) {
  const match = /^data:(.+);base64,(.*)$/.exec(image_base64);
  const contentType = match ? match[1] : 'image/png';
  const b64data = match ? match[2] : image_base64;
  const buffer = Buffer.from(b64data, 'base64');
  const ext = (contentType.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

module.exports = { supabaseAnon, supabaseAdmin, STORAGE_BUCKET, uploadBase64 };
