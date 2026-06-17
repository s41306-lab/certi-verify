-- ============================================================
-- schema.sql — ระบบเกียรติบัตรโรงเรียน
-- รันใน Supabase: Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
-- ============================================================

-- ---------- ตาราง profiles (ข้อมูลเสริมของผู้ใช้) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);

-- ---------- ตาราง activities (กิจกรรม) ----------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date,
  image_url text,                  -- รูปหน้าปกกิจกรรม
  certificate_template_url text,   -- รูปเกียรติบัตรเปล่าที่ครูอัปโหลด
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- เผื่อมีตารางเดิมอยู่แล้ว ให้เพิ่มคอลัมน์ใหม่แบบไม่ error
alter table public.activities add column if not exists image_url text;
alter table public.activities add column if not exists certificate_template_url text;

-- ---------- ตาราง registrations (การลงทะเบียน) ----------
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  status text not null default 'pending_approval' check (status in (
    'pending_approval',
    'approved',
    'rejected',
    'pending_review',
    'certified'
  )),
  proof_image_url text,
  created_at timestamptz not null default now(),
  unique (student_id, activity_id)
);

-- ---------- ตาราง certificates (เกียรติบัตร) ----------
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  issued_at timestamptz not null default now(),
  unique (registration_id)
);

-- index ช่วยให้ค้นเร็วขึ้น
create index if not exists idx_reg_student on public.registrations(student_id);
create index if not exists idx_reg_activity on public.registrations(activity_id);
create index if not exists idx_cert_student on public.certificates(student_id);

-- ============================================================
-- Trigger: สร้าง profile อัตโนมัติเมื่อมี user ใหม่ใน auth.users
-- role อ่านจาก user_metadata.role (ค่าเริ่มต้น = student)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security (RLS)
-- หมายเหตุ: backend ใช้ service_role key ซึ่ง "ข้าม" RLS อยู่แล้ว
-- จึงไม่กระทบ API แต่เปิดไว้เพื่อความปลอดภัยหากมีการเรียกตรงด้วย anon key
-- ============================================================
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.registrations enable row level security;
alter table public.certificates enable row level security;

-- profiles: เจ้าของอ่าน/แก้ของตัวเองได้
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- activities: ผู้ที่ล็อกอินอ่านได้
drop policy if exists "activities_select_auth" on public.activities;
create policy "activities_select_auth" on public.activities
  for select using (auth.role() = 'authenticated');

-- registrations: นักเรียนเห็นของตัวเอง
drop policy if exists "reg_select_own" on public.registrations;
create policy "reg_select_own" on public.registrations
  for select using (auth.uid() = student_id);

-- certificates: นักเรียนเห็นของตัวเอง
drop policy if exists "cert_select_own" on public.certificates;
create policy "cert_select_own" on public.certificates
  for select using (auth.uid() = student_id);

-- ============================================================
-- Storage bucket สำหรับรูปหลักฐาน
-- ============================================================
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

-- อนุญาตให้อ่านรูปแบบ public (เพราะ bucket public = true)
drop policy if exists "proofs_public_read" on storage.objects;
create policy "proofs_public_read" on storage.objects
  for select using (bucket_id = 'proofs');
