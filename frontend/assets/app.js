// app.js — ฟังก์ชันร่วมใช้ทุกหน้า
const API = () => window.API_BASE || '';

// ---------- token / session ----------
function getToken() {
  return localStorage.getItem('token');
}
function getProfile() {
  try {
    return JSON.parse(localStorage.getItem('profile') || 'null');
  } catch {
    return null;
  }
}
function saveSession({ token, role, profile }) {
  localStorage.setItem('token', token);
  localStorage.setItem('role', role);
  localStorage.setItem('profile', JSON.stringify(profile || {}));
}
function clearSession() {
  ['token', 'role', 'profile'].forEach((k) => localStorage.removeItem(k));
}

// ---------- API helper ----------
async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && getToken()) headers['Authorization'] = `Bearer ${getToken()}`;

  const res = await fetch(`${API()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* no body */
  }

  if (res.status === 401) {
    // token หมดอายุ -> เด้งกลับหน้า login
    clearSession();
    if (!/login(\.html)?$/.test(location.pathname)) {
      location.href = 'login.html';
    }
    throw new Error(data.error || 'กรุณาเข้าสู่ระบบใหม่');
  }
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

// ---------- guard: ต้องล็อกอิน + ตรงบทบาท ----------
function requireRole(role) {
  const token = getToken();
  const userRole = localStorage.getItem('role');
  if (!token) {
    location.href = 'login.html';
    return false;
  }
  if (role && userRole !== role) {
    location.href = userRole === 'admin' ? 'admin.html' : 'student.html';
    return false;
  }
  return true;
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
  clearSession();
  location.href = 'login.html';
}

// ---------- utils ----------
function fmtDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// แสดง toast แจ้งเตือนเล็ก ๆ
function toast(msg, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = 'toast'), 3200);
}

// สถานะ -> ป้าย
const STATUS_META = {
  pending_approval: { label: 'รออนุมัติ', cls: 'badge-yellow' },
  approved: { label: 'อนุมัติแล้ว', cls: 'badge-green' },
  rejected: { label: 'ถูกปฏิเสธ', cls: 'badge-red' },
  pending_review: { label: 'รอครูตรวจ', cls: 'badge-blue' },
  certified: { label: 'ได้รับเกียรติบัตร', cls: 'badge-gold' },
};

// สร้าง HTML ของป้ายสถานะ (จุดสีนำหน้าแทนการใช้อิโมจิ)
function statusBadge(status) {
  const m = STATUS_META[status] || { label: status, cls: '' };
  return `<span class="badge ${m.cls}"><span class="dot"></span>${escapeHtml(m.label)}</span>`;
}
