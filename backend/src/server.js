require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');

const { testConnection } = require('./config/db');
const socketSvc          = require('./services/socketService');

const authRoutes         = require('./routes/authRoutes');
const victimRoutes       = require('./routes/victimRoutes');
const shelterRoutes      = require('./routes/shelterRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const inventoryRoutes    = require('./routes/inventoryRoutes');
const analyticsRoutes    = require('./routes/analyticsRoutes');
const publicShelterRoutes = require('./routes/publicShelterRoutes');

const app    = express();
const server = http.createServer(app);   // needed for Socket.io
const PORT   = process.env.PORT || 5000;

// ─────────────────────────────────────────────
// Attach Socket.io
// ─────────────────────────────────────────────
socketSvc.init(server);

// ─────────────────────────────────────────────
// Global Middleware
// ─────────────────────────────────────────────
// Behind nginx / an AWS load balancer set TRUST_PROXY=1 so rate limiting sees real client IPs
if (process.env.TRUST_PROXY) {
  const tp = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(tp) ? parseInt(tp, 10) : tp === 'true' ? true : tp);
}

app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success:   true,
    message:   'Disaster Resource Mgmt API is running.',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV,
  });
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/victim',   victimRoutes);
app.use('/api/shelter',  shelterRoutes);
app.use('/api/shelter',  inventoryRoutes);   // /api/shelter/inventory
app.use('/api/shelters', publicShelterRoutes); // /api/shelters for public & victim map
app.use('/api/admin',    adminRoutes);
app.use('/api/admin',    analyticsRoutes);   // /api/admin/analytics + /api/admin/inventory
app.use('/api',          notificationRoutes);

// ─────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

// ─────────────────────────────────────────────
// Start Server (http.Server, not app.listen)
// ─────────────────────────────────────────────
const startServer = async () => {
  await testConnection();
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment : ${process.env.NODE_ENV}`);
    console.log(`Socket.io   : enabled`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
};

startServer();
