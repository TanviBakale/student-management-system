import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import studentRoutes from './routes/studentRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';

const app = express();

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://student-management-system-q6or.vercel.app',
  'https://student-management-system-cc.vercel.app'
];

const envOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Automatically support any Vercel deployment URL for this project
  if (/^https:\/\/student-management-system-[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '20kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/health', (_request, response) => {
  response.json({ success: true, status: 'ok' });
});

app.use('/api/students', studentRoutes);
app.use('/api/departments', departmentRoutes);

app.use((_request, response) => {
  response.status(404).json({ success: false, message: 'The requested resource was not found.' });
});

app.use((error, _request, response, _next) => {
  if (error.message === 'Origin is not allowed by CORS.') {
    return response.status(403).json({ success: false, message: 'This website is not allowed to access the API.' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ success: false, message: 'Request body must be valid JSON.' });
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ success: false, message: 'Request body is too large.' });
  }
  console.error('Unhandled API error:', error);
  return response.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

export default app;
