// scripts/seed-users.js — สร้างผู้ใช้เดโมผ่าน Supabase Admin API
// รัน: node backend/scripts/seed-users.js  (ต้องตั้งค่า backend/.env ให้ครบก่อน)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const USERS = [
  { email: 'admin1@siya.ac.th',   password: 'Password123!', full_name: 'ครูสมศรี ใจดี', role: 'admin' },
  { email: 'student1@siya.ac.th', password: 'Password123!', full_name: 'เด็กชายธนภัทร ตั้งใจเรียน', role: 'student' },
  { email: 'student2@siya.ac.th', password: 'Password123!', full_name: 'เด็กหญิงพิมพ์ชนก รักการอ่าน', role: 'student' },
];

(async () => {
  for (const u of USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role },
    });
    if (error) {
      console.log(`[skip] ${u.email}: ${error.message}`);
    } else {
      console.log(`[ok]   สร้าง ${u.email} (${u.role})`);
      // เผื่อ trigger ไม่ทำงาน — upsert profile ให้แน่ใจ
      await admin.from('profiles').upsert({
        id: data.user.id, email: u.email, full_name: u.full_name, role: u.role,
      });
    }
  }
  console.log('\nเสร็จแล้ว! รหัสผ่านเดโมทุกบัญชี: Password123!');
  process.exit(0);
})();
