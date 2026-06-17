// server.js — จุดเริ่มต้น Express API
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const activitiesRoutes = require('./routes/activities');
const registrationsRoutes = require('./routes/registrations');
const certificatesRoutes = require('./routes/certificates');

const app = express();

// รองรับ base64 รูปภาพขนาดใหญ่
app.use(express.json({ limit: '12mb' }));

// CORS — อนุญาตเฉพาะ origin ที่กำหนด (ค่าว่าง = อนุญาตทุก origin)
const ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: ORIGINS.length ? ORIGINS : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// health check
app.get('/', (req, res) =>
  res.json({ ok: true, service: 'school-certificate-api' })
);
app.get('/api/health', (req, res) => res.json({ ok: true }));

// routes
app.use('/api/auth', authRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/registrations', registrationsRoutes);
app.use('/api/certificates', certificatesRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'ไม่พบเส้นทางที่ร้องขอ' }));

// error handler — คืน JSON เสมอ
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[server] API listening on http://localhost:${PORT}`);
});

module.exports = app;
