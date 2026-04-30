import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './lib/db.js';
import { initSocket } from './socket.js';
import { attachClientMeta } from './middleware/clientMeta.js';
import { requireAuth } from './middleware/auth.js';
import { auditWriteActions } from './middleware/audit.js';
import { bootstrapDemoUsers } from './lib/bootstrapDemoUsers.js';

// Load environment variables (always resolve to backend/.env)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
// Local development keeps some shared keys in client/.env. Load it as fallback only.
dotenv.config({ path: path.resolve(__dirname, '../client/.env'), override: false });

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 10000;

if (process.env.NODE_ENV === 'production') {
  // Cloud platforms terminate TLS at the edge; trust forwarded proxy headers.
  app.set('trust proxy', 1);
}

// Socket.io Initialization
initSocket(server);

// Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081"
].filter(Boolean));

const isLocalDevOrigin = (origin) => {
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  } catch {
    return false;
  }
};

app.use(cors({
  origin(origin, callback) {
    if (allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(attachClientMeta);

app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'antigravity-api',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send('Antigravity API is running!');
});

app.use(requireAuth);
app.use(auditWriteActions);

// Routes
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import fileRoutes from './routes/files.js';
import aiRoutes from './routes/ai.js';
import activityRoutes from './routes/activity.js';
import driveAuthRoutes from './routes/drive-auth.js';
import notificationRoutes from './routes/notifications.js';

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/drive', driveAuthRoutes);
app.use('/api/notifications', notificationRoutes);

// Start Server
const startServer = async () => {
  try {
    await connectDB();
    await bootstrapDemoUsers();
    server.listen(port, "0.0.0.0", () => {
      console.log(`Antigravity API listening on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error?.message || error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => console.log('Server closed'));
});
