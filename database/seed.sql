-- ============================================================
-- seed.sql — ข้อมูลตัวอย่างสำหรับเดโม
-- 1 ครู (admin) + 2 นักเรียน + 3 กิจกรรม
--
-- สำคัญ: Supabase ไม่อนุญาตให้ insert เข้า auth.users ตรง ๆ ผ่าน SQL
--    ฉะนั้นให้ "สร้างผู้ใช้" ก่อน (วิธีใดวิธีหนึ่งด้านล่าง) แล้วค่อยรัน seed นี้
--    ส่วนกิจกรรมรันได้เลย
--
-- วิธีสร้างผู้ใช้ (เลือกอย่างใดอย่างหนึ่ง):
--   A) Dashboard > Authentication > Users > Add user (ใส่ email + password,
--      ติ๊ก Auto Confirm User) ทำ 3 คน:
--         admin1@siya.ac.th   / Password123!
--         student1@siya.ac.th / Password123!
--         student2@siya.ac.th / Password123!
--   B) ใช้สคริปต์ backend/scripts/seed-users.js (ต้องมี SERVICE_ROLE key)
--
-- trigger handle_new_user จะสร้างแถวใน profiles ให้อัตโนมัติ (role = student)
-- จากนั้นรัน SQL ด้านล่างเพื่อ "เลื่อนขั้น" admin และตั้งชื่อให้สวยงาม
-- ============================================================

-- ----- ตั้ง role/ชื่อ ให้ผู้ใช้ตามอีเมล (รันหลังจากสร้างผู้ใช้แล้ว) -----
update public.profiles
   set role = 'admin', full_name = 'ครูสมศรี ใจดี'
 where email = 'admin1@siya.ac.th';

update public.profiles
   set full_name = 'เด็กชายธนภัทร ตั้งใจเรียน'
 where email = 'student1@siya.ac.th';

update public.profiles
   set full_name = 'เด็กหญิงพิมพ์ชนก รักการอ่าน'
 where email = 'student2@siya.ac.th';

-- ----- กิจกรรมตัวอย่าง (กำหนด created_by เป็น admin ถ้ามี) -----
insert into public.activities (title, description, event_date, created_by)
select v.title, v.description, v.event_date,
       (select id from public.profiles where email = 'admin1@siya.ac.th' limit 1)
from (values
  ('ค่ายอาสาพัฒนาชุมชน',
   'กิจกรรมจิตอาสาพัฒนาโรงเรียนและชุมชนใกล้เคียง ระยะเวลา 2 วัน',
   date '2026-07-15'),
  ('การแข่งขันตอบปัญหาวิทยาศาสตร์',
   'แข่งขันตอบปัญหาวิทยาศาสตร์ระดับมัธยมศึกษาตอนต้น',
   date '2026-08-02'),
  ('อบรมการเขียนโปรแกรมเบื้องต้น',
   'เรียนรู้พื้นฐานการเขียนโปรแกรมด้วยภาษา Python สำหรับผู้เริ่มต้น',
   date '2026-08-20')
) as v(title, description, event_date)
where not exists (select 1 from public.activities a where a.title = v.title);
