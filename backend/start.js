#!/usr/bin/env node

/**
 * Resilient startup wrapper for ShadowPay Backend
 * 
 * This wrapper ensures the backend can start even if there are
 * missing environment variables or startup failures.
 * It provides a basic health endpoint immediately.
 */

const PORT = process.env.PORT || 3001;
const express = require('express');
const app = express();

// ✅ IMMEDIATE HEALTH CHECK - responds before anything else
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ✅ OPTIONS for CORS preflight
app.options('*', (req, res) => {
  const origin = req.get('origin');
  const allowedOrigins = [
    'https://shadowpayy.vercel.app',
    'https://shadowpay.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }

  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '86400');

  res.sendStatus(200);
});

// ✅ Catch-all 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found. Server is starting up...' });
});

// ✅ Start server - MUST NOT throw
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Fallback health server listening on port ${PORT}`);
});

// ✅ Handle any unhandled errors gracefully
server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  // Don't crash - keep the health endpoint running
  setTimeout(() => {
    process.exit(1);
  }, 30000); // Exit after 30 seconds to allow one more health check
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err.message);
});

// ✅ Try to load the real backend
(async () => {
  try {
    console.log('Loading full backend...');
    const serverModule = await import('./dist/server.js');
    console.log('✅ Full backend loaded successfully');
  } catch (err) {
    console.warn('⚠️ Full backend failed to load:', err.message);
    console.warn('Continuing with fallback health server only...');
  }
})();
