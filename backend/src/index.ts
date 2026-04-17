import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler';
import tradesRouter from './routes/trades';
import aiRouter from './routes/ai';
import analyticsRouter from './routes/analytics';
import riskRouter from './routes/risk';
import psychologyRouter from './routes/psychology';
import playbookRouter from './routes/playbook';
import journalRouter from './routes/journal';
import marketDataRouter from './routes/marketData';

dotenv.config({ override: true });

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Body parser - 50mb for images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/trades', tradesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/risk', riskRouter);
app.use('/api/psychology', psychologyRouter);
app.use('/api/playbook', playbookRouter);
app.use('/api/journal', journalRouter);
app.use('/api/market-data', marketDataRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`TradeWise backend running on port ${PORT}`);
});

export default app;
