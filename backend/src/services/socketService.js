/**
 * socketService.js
 * Manages Socket.io instance and emits real-time events to connected clients.
 *
 * Events emitted:
 *   request:assigned   → shelter user    (new assignment arrived)
 *   request:accepted   → victim user     (shelter accepted their request)
 *   request:rejected   → victim user     (forwarding to next shelter)
 *   request:fulfilled  → victim user     (request fulfilled)
 *   request:unresolved → victim + admins (escalated)
 *   notification:new   → specific user   (any new notification)
 */

let io = null;

// Map: userId (string) → Set of socket IDs
const userSockets = new Map();

const init = (httpServer) => {
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    cors: {
      origin:      process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    // Client sends its userId after connecting
    socket.on('auth', (userId) => {
      if (!userId) return;
      const uid = String(userId);
      if (!userSockets.has(uid)) userSockets.set(uid, new Set());
      userSockets.get(uid).add(socket.id);
      socket.join(`user:${uid}`);
      console.log(`[Socket] User ${uid} joined (${socket.id})`);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Client disconnected:', socket.id);
      // Clean up mapping
      for (const [uid, sids] of userSockets.entries()) {
        sids.delete(socket.id);
        if (sids.size === 0) userSockets.delete(uid);
      }
    });
  });

  return io;
};

/**
 * Emit an event to a specific user (all their connected tabs/devices)
 */
const emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user:${String(userId)}`).emit(event, data);
};

/**
 * Emit an event to all connected admins
 * (we pass adminIds from the controller since socket service doesn't query DB)
 */
const emitToUsers = (userIds, event, data) => {
  if (!io) return;
  userIds.forEach((id) => emitToUser(id, event, data));
};

/**
 * Broadcast to all connected clients (e.g., system-wide alert)
 */
const broadcast = (event, data) => {
  if (!io) return;
  io.emit(event, data);
};

const getIO = () => io;

module.exports = { init, emitToUser, emitToUsers, broadcast, getIO };
