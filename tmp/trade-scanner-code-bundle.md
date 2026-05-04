# Trade Scanner Code Bundle
Generated: 2026-04-21T16:04:29.2792297+10:00


---
## FILE: backend/src/index.ts
```ts
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
import billingRouter from './routes/billing';

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
app.use('/api/billing', billingRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`TradeWise backend running on port ${PORT}`);
});

export default app;
```


---
## FILE: backend/src/routes/ai.ts
```ts
import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../services/supabase';
import {
  analyzeChartImage,
  analyzeChartAnalyzerImage,
  analyzeIndividualTrade,
  analyzePatterns,
  generateWeeklyReport,
  generatePsychologyReport,
  compareTradeToPlaybook,
  answerFlyxaQuestion,
} from '../services/claude';
import { AuthenticatedRequest, Trade } from '../types/index';

const router = Router();

function getFocusImageLabel(file: Express.Multer.File, index: number): string {
  const name = file.originalname || '';
  const match = name.match(/^(header-focus|trade-box-focus|entry-window-focus|exit-path-focus|price-label-focus|entry-label-focus|stop-label-focus|target-label-focus)-/i);
  return match ? match[1].toLowerCase() : `focus_${index + 1}`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10mb
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// POST /flyxa-chat
router.post('/flyxa-chat', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const question = typeof req.body.question === 'string' ? req.body.question : '';
    const history = Array.isArray(req.body.history)
      ? req.body.history
          .filter((message: unknown): message is { role: 'user' | 'assistant'; content: string } => (
            !!message &&
            typeof message === 'object' &&
            ('role' in message) &&
            ('content' in message) &&
            ((message as { role?: unknown }).role === 'user' || (message as { role?: unknown }).role === 'assistant') &&
            typeof (message as { content?: unknown }).content === 'string'
          ))
      : [];

    if (!question.trim()) {
      res.status(400).json({ error: 'question is required' });
      return;
    }

    const reply = await answerFlyxaQuestion(question, history);
    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

router.post('/chart-analyzer', authMiddleware, upload.single('image'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const imageFile = req.file;
    if (!imageFile) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }

    const rawContractSize = Number(req.body.contractSize);
    const contractSize = Number.isFinite(rawContractSize) && rawContractSize > 0
      ? Math.floor(rawContractSize)
      : 1;

    const results = await analyzeChartAnalyzerImage(
      imageFile.buffer.toString('base64'),
      imageFile.mimetype,
      contractSize
    );

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// POST /scan â€” analyze chart image
router.post('/scan', authMiddleware, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'focusImages', maxCount: 8 },
]), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const uploadedFiles = req.files as Record<string, Express.Multer.File[]> | undefined;
    const imageFile = uploadedFiles?.image?.[0];
    const focusImages = uploadedFiles?.focusImages ?? [];

    if (!imageFile) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }

    const { entryDate, entryTime } = req.body;
    if (!entryDate || !entryTime) {
      res.status(400).json({ error: 'entryDate and entryTime are required' });
      return;
    }

    let scannerContext: Record<string, unknown> | undefined;
    if (typeof req.body.scannerContext === 'string') {
      try {
        scannerContext = JSON.parse(req.body.scannerContext) as Record<string, unknown>;
      } catch {
        scannerContext = undefined;
      }
    }

    const base64Image = imageFile.buffer.toString('base64');
    const mimeType = imageFile.mimetype;
    const focusImagePayloads = focusImages.map((file, index) => ({
      base64Image: file.buffer.toString('base64'),
      mimeType: file.mimetype,
      label: getFocusImageLabel(file, index),
    }));

    const extractedData = await analyzeChartImage(base64Image, mimeType, entryDate, entryTime, focusImagePayloads, scannerContext);
    res.json(extractedData);
  } catch (err) {
    next(err);
  }
});

// POST /trade-analysis/:tradeId
router.post('/trade-analysis/:tradeId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { tradeId } = req.params;

    const { data: trade, error } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .eq('user_id', req.userId!)
      .single();

    if (error || !trade) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }

    const analysis = await analyzeIndividualTrade(trade as Trade);
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
});

// POST /patterns
router.post('/patterns', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.body;

    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', req.userId!)
      .order('trade_date', { ascending: true });

    if (startDate) query = query.gte('trade_date', startDate);
    if (endDate) query = query.lte('trade_date', endDate);

    const { data: trades, error } = await query;
    if (error) throw error;

    if (!trades || trades.length === 0) {
      res.json({ analysis: 'No trades found for the selected period.' });
      return;
    }

    const analysis = await analyzePatterns(trades as Trade[]);
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
});

// POST /weekly-report
router.post('/weekly-report', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { weekStart, weekEnd } = req.body;
    if (!weekStart || !weekEnd) {
      res.status(400).json({ error: 'weekStart and weekEnd are required' });
      return;
    }

    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', req.userId!)
      .gte('trade_date', weekStart)
      .lte('trade_date', weekEnd)
      .order('trade_date', { ascending: true });

    if (error) throw error;

    const report = await generateWeeklyReport((trades || []) as Trade[], weekStart, weekEnd);
    res.json({ report });
  } catch (err) {
    next(err);
  }
});

// POST /psychology-report
router.post('/psychology-report', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const [tradesResult, psychResult] = await Promise.all([
      supabase
        .from('trades')
        .select('*')
        .eq('user_id', req.userId!)
        .order('trade_date', { ascending: true }),
      supabase
        .from('psychology_logs')
        .select('*')
        .eq('user_id', req.userId!)
        .order('date', { ascending: true }),
    ]);

    if (tradesResult.error) throw tradesResult.error;
    if (psychResult.error) throw psychResult.error;

    const report = await generatePsychologyReport(
      (tradesResult.data || []) as Trade[],
      psychResult.data || []
    );
    res.json({ report });
  } catch (err) {
    next(err);
  }
});

// POST /playbook-check/:tradeId
router.post('/playbook-check/:tradeId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { tradeId } = req.params;

    const [tradeResult, playbookResult] = await Promise.all([
      supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', req.userId!)
        .single(),
      supabase
        .from('playbook_entries')
        .select('*')
        .eq('user_id', req.userId!),
    ]);

    if (tradeResult.error || !tradeResult.data) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }

    if (playbookResult.error) throw playbookResult.error;

    const analysis = await compareTradeToPlaybook(
      tradeResult.data as Trade,
      playbookResult.data || []
    );
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
});

export default router;
```


---
## FILE: backend/src/services/claude.ts
```ts
import Anthropic from '@anthropic-ai/sdk';
import { Trade, ExtractedTradeData } from '../types/index';
import dotenv from 'dotenv';
import { inflateSync } from 'zlib';
import sharp from 'sharp';
import { callGeminiJson } from './gemini';

dotenv.config({ override: true });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-5';
const MODEL_TEMPERATURE = 0;
const EXIT_CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;
const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
const MANUAL_READING_PROCESS = `Read the chart in this exact order:

0. If the screenshot contains more than one chart or comparison pane, ONLY analyse the chart that contains the colored risk/reward box. Ignore every other chart, even if it shows correlated price action.

1. Read the symbol and timeframe from the top-left label of the chart that contains the risk/reward box.
   - The timeframe is the small interval value immediately beside the symbol/ticker in the top-left TradingView header.
   - Example: "MNQM6 Â· 1 Â· CME" means timeframe_minutes = 1.
   - Example: "NQ1! Â· 5" means timeframe_minutes = 5.
   - Use the header number/text next to the ticker only.
   - Do NOT infer timeframe from candle spacing, the x-axis, how long the trade lasts, or how many candles fit on screen.
   - If the header uses hour notation like 1H or 4H, convert it to minutes.

2. Identify the P&L box: the semi-transparent overlay of TWO colored zones on the chart.
   - TEAL (mint/cyan green) zone = profit target area
   - PINK (light red/rose) zone = stop loss risk area

3. CRITICAL â€” Identify the three price levels attached to the P&L box boundaries:
   - GREY pill/box label on the right-side price axis = entry price. On the right axis you will see several colored pill-shaped labels: a GREEN one (live price â€” ignore it), a RED one (stop loss), and a GREY one (entry). The GREY pill label is at the boundary between the pink and teal zones. Read the number printed inside that grey pill exactly â€” it is the entry price. Do not read axis gridline text, do not interpolate between gridlines. The grey pill label is the same style as the red and green pills, just grey colored.
   - RED label on the right-side price axis = stop loss (the OUTERMOST far edge of the pink zone â€” the edge furthest from entry, NOT any intermediate level inside the pink zone).
   - The TAKE PROFIT is the OUTERMOST far edge of the teal zone (the edge furthest from entry).

   HOW TO FIND THE TAKE PROFIT:
   a. Locate the teal box. Find its ABSOLUTE outermost edge (top edge for Long, bottom edge for Short). That is the TP level â€” it is the boundary where the teal box ends.
   b. Trace that outermost edge horizontally to the right-axis price scale to read the price.
   c. IGNORE any dashed lines, horizontal lines, or colored markers drawn INSIDE the teal box body â€” those are NOT the TP. The TP is only at the outermost boundary of the teal box itself.
   d. IGNORE any horizontal lines drawn on the chart that cross the chart area but do not coincide with the actual outer edge of the teal box.
   e. There may be a small teal/green label AT THAT OUTERMOST EDGE â€” use it if visible.
   f. NEVER use the live/current-price label as the TP. The live price label is the topmost or bottom-most floating green label that shows the most recent market price â€” it is NOT attached to the P&L box and will be at a very different price from the teal box edge. If a green label is far outside the P&L box range, it is the live price â€” ignore it.
   g. If target-label-focus is attached, that crop is centered on the TP level. If you see a green label aligned with the teal box OUTER edge in that crop, use it as tp_price even if it resembles the live/current-price label.

4. Confirm direction from box layout:
   - Long: teal zone ABOVE entry, pink zone BELOW entry â†’ tp_price > entry_price
   - Short: pink zone ABOVE entry, teal zone BELOW entry â†’ tp_price < entry_price
   If your identified tp_price is outside the visible teal box, you have the wrong label â€” re-read step 3.
   If tp_price equals an intermediate level inside the teal zone rather than its outermost edge, you have the wrong label â€” re-read step 3.

5. Read the entry time from the x-axis using the left edge of the P&L box.
6. Starting at the entry candle, move candle by candle to decide whether stop loss or take profit is touched first.
7. Count candles to the exit candle and calculate trade_length_seconds from the timeframe.

Do not invent labels that are not visible. Prefer the single most likely journal-ready answer.
Never use a second chart pane to decide exit order for the primary trade.`;
const FIRST_TOUCH_RULE = `The first touch decides the outcome.
- Stop scanning as soon as either stop loss or take profit is hit.
- Ignore any later move after the first touch.
- If price hits stop first and later reaches target, the correct result is still SL.
- If price hits target first and later reaches stop, the correct result is still TP.
- CRITICAL: The current live price shown on the right axis (the floating green label) is NOT the trade exit. Ignore it completely. Only look at candles AFTER the entry point.
- Work candle by candle from the entry forward (left to right). The FIRST candle whose wick touches the SL or TP level decides the result â€” everything after that is irrelevant.`;

type ExitConfidence = typeof EXIT_CONFIDENCE_VALUES[number];
type ImageMimeType = typeof VALID_MIME_TYPES[number];

interface ChartImageInput {
  base64Image: string;
  mimeType: ImageMimeType;
  label: string;
}

interface ExitVerificationResult {
  exit_reason: 'TP' | 'SL' | null;
  trade_length_seconds: number | null;
  candle_count: number | null;
  timeframe_minutes: number | null;
  exit_confidence: ExitConfidence | null;
  first_touch_candle_index: number | null;
  first_touch_evidence: string | null;
}

interface LevelTouchSanityResult {
  stop_touched: boolean | null;
  target_touched: boolean | null;
  first_touch: 'TP' | 'SL' | null;
  evidence: string | null;
}

interface ExactPriceRead {
  direction: 'Long' | 'Short' | null;
  entry_price: number | null;
  sl_price: number | null;
  tp_price: number | null;
}

interface HeaderIdentityRead {
  symbol: string | null;
  timeframe_minutes: number | null;
}

interface ScannerContext {
  direction_hint?: 'Long' | 'Short';
  chart_left_ratio?: number;
  chart_right_ratio?: number;
  box_left_ratio?: number;
  box_right_ratio?: number;
  entry_line_ratio?: number;
  stop_line_ratio?: number;
  target_line_ratio?: number;
  red_box?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  green_box?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
}

interface DecodedImageData {
  width: number;
  height: number;
  data: Uint8Array;
}

interface DeterministicExitCheck {
  exit_reason: 'TP' | 'SL' | null;
  evidence: string | null;
}

function parseJsonObject(rawText: string): Record<string, unknown> {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngImage(base64Image: string): DecodedImageData | null {
  const buffer = Buffer.from(base64Image, 'base64');
  const signature = '89504e470d0a1a0a';

  if (buffer.length < 8 || buffer.subarray(0, 8).toString('hex') !== signature) {
    return null;
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const idatChunks: Buffer[] = [];

  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkLength;

    if (chunkDataEnd + 4 > buffer.length) {
      return null;
    }

    const chunkData = buffer.subarray(chunkDataStart, chunkDataEnd);

    if (chunkType === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      interlaceMethod = chunkData[12];
    } else if (chunkType === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (chunkType === 'IEND') {
      break;
    }

    offset = chunkDataEnd + 4;
  }

  if (!width || !height || bitDepth !== 8 || interlaceMethod !== 0 || ![2, 6].includes(colorType) || idatChunks.length === 0) {
    return null;
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));

  if (inflated.length < height * (stride + 1)) {
    return null;
  }

  const raw = Buffer.alloc(height * stride);
  let inputOffset = 0;

  for (let y = 0; y < height; y++) {
    const filterType = inflated[inputOffset++];
    const rowStart = y * stride;

    for (let x = 0; x < stride; x++) {
      const rawByte = inflated[inputOffset++];
      const left = x >= bytesPerPixel ? raw[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? raw[rowStart + x - stride] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? raw[rowStart + x - stride - bytesPerPixel] : 0;

      let value = rawByte;
      if (filterType === 1) value = (rawByte + left) & 0xff;
      else if (filterType === 2) value = (rawByte + up) & 0xff;
      else if (filterType === 3) value = (rawByte + Math.floor((left + up) / 2)) & 0xff;
      else if (filterType === 4) value = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;

      raw[rowStart + x] = value;
    }
  }

  if (colorType === 6) {
    return {
      width,
      height,
      data: new Uint8Array(raw),
    };
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < raw.length; i += 3, j += 4) {
    rgba[j] = raw[i];
    rgba[j + 1] = raw[i + 1];
    rgba[j + 2] = raw[i + 2];
    rgba[j + 3] = 255;
  }

  return { width, height, data: rgba };
}

function isDarkPricePixel(r: number, g: number, b: number, a: number): boolean {
  return a > 180 && r < 120 && g < 120 && b < 120;
}

function getColumnPriceExtents(
  data: Uint8Array,
  width: number,
  x: number,
  yStart: number,
  yEnd: number
): { minY: number; maxY: number } | null {
  const runs: Array<{ start: number; end: number }> = [];
  let runStart: number | null = null;

  for (let y = yStart; y < yEnd; y++) {
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    const isDark = isDarkPricePixel(r, g, b, a);

    if (isDark && runStart === null) {
      runStart = y;
      continue;
    }

    if (!isDark && runStart !== null) {
      if (y - runStart >= 3) {
        runs.push({ start: runStart, end: y - 1 });
      }
      runStart = null;
    }
  }

  if (runStart !== null && yEnd - runStart >= 3) {
    runs.push({ start: runStart, end: yEnd - 1 });
  }

  if (!runs.length) {
    return null;
  }

  return {
    minY: Math.min(...runs.map(run => run.start)),
    maxY: Math.max(...runs.map(run => run.end)),
  };
}

function detectDeterministicExitFromDecodedImage(
  image: DecodedImageData | null,
  scannerContext?: ScannerContext
): DeterministicExitCheck | null {
  const context = scannerContext;
  if (
    !image ||
    !context ||
    context.stop_line_ratio === undefined ||
    context.target_line_ratio === undefined ||
    context.box_left_ratio === undefined
  ) {
    return null;
  }

  const { width, height, data } = image;
  const inferredDirection =
    context.direction_hint ??
    (context.stop_line_ratio < context.target_line_ratio ? 'Short' : 'Long');
  const searchStartX = Math.max(0, Math.floor(width * context.box_left_ratio) + 2);
  const searchEndX = Math.max(searchStartX + 1, Math.floor(width * 0.88));
  const searchMinY = Math.floor(height * 0.08);
  const searchMaxY = Math.floor(height * 0.92);
  const stopY = Math.floor(height * context.stop_line_ratio);
  const targetY = Math.floor(height * context.target_line_ratio);
  const tolerance = 2;

  let firstStopX: number | null = null;
  let firstTargetX: number | null = null;

  for (let x = searchStartX; x < searchEndX; x++) {
    const columnExtents = getColumnPriceExtents(data, width, x, searchMinY, searchMaxY);
    if (!columnExtents) {
      continue;
    }

    const { minY: columnMinY, maxY: columnMaxY } = columnExtents;
    if (inferredDirection === 'Short') {
      if (firstStopX === null && columnMinY <= stopY + tolerance) {
        firstStopX = x;
      }
      if (firstTargetX === null && columnMaxY >= targetY - tolerance) {
        firstTargetX = x;
      }
    } else {
      if (firstStopX === null && columnMaxY >= stopY - tolerance) {
        firstStopX = x;
      }
      if (firstTargetX === null && columnMinY <= targetY + tolerance) {
        firstTargetX = x;
      }
    }
  }

  if (firstStopX === null && firstTargetX === null) {
    return null;
  }

  if (firstStopX !== null && firstTargetX === null) {
    return {
      exit_reason: 'SL',
      evidence: 'Price reached the stop-loss level before the take-profit level.',
    };
  }

  if (firstTargetX !== null && firstStopX === null) {
    return {
      exit_reason: 'TP',
      evidence: 'Price reached the take-profit level before the stop-loss level.',
    };
  }

  if (firstStopX !== null && firstTargetX !== null) {
    if (Math.abs(firstStopX - firstTargetX) <= 3) {
      return null;
    }

    const stopFirst = firstStopX < firstTargetX;
    return {
      exit_reason: stopFirst ? 'SL' : 'TP',
      evidence: stopFirst
        ? 'Price touched the stop-loss before the take-profit.'
        : 'Price touched the take-profit before the stop-loss.',
    };
  }

  return null;
}

function parseNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizeScannedSymbol(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.toUpperCase().trim();
  const cleaned = normalized
    .replace(/[|:,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const rootCleaned = cleaned.replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, '');
  const invalidValues = new Set([
    'UNKNOWN',
    'UNKWN',
    'N/A',
    'NA',
    'NONE',
    'NULL',
    'FUTURES',
    'MICRO',
    'E-MINI',
    'EMINI',
    'MICRO FUTURES',
    'NASDAQ FUTURES',
    'S&P FUTURES',
    'TRADINGVIEW',
  ]);

  if (invalidValues.has(rootCleaned)) {
    return null;
  }

  const explicitTickerPatterns: Array<[RegExp, string]> = [
    [/\bMNQ[A-Z]?\d{1,2}\b/, 'MNQ'],
    [/\bMES[A-Z]?\d{1,2}\b/, 'MES'],
    [/\bMYM[A-Z]?\d{1,2}\b/, 'MYM'],
    [/\bM2K[A-Z]?\d{1,2}\b/, 'M2K'],
    [/\bMCL[A-Z]?\d{1,2}\b/, 'MCL'],
    [/\bMGC[A-Z]?\d{1,2}\b/, 'MGC'],
    [/\bMBT[A-Z]?\d{1,2}\b/, 'MBT'],
    [/\bMET[A-Z]?\d{1,2}\b/, 'MET'],
    [/\bNQ[A-Z]?\d{1,2}\b/, 'NQ'],
    [/\bES[A-Z]?\d{1,2}\b/, 'ES'],
    [/\bYM[A-Z]?\d{1,2}\b/, 'YM'],
    [/\bRTY[A-Z]?\d{1,2}\b/, 'RTY'],
    [/\bCL[A-Z]?\d{1,2}\b/, 'CL'],
    [/\bGC[A-Z]?\d{1,2}\b/, 'GC'],
    [/\bSI[A-Z]?\d{1,2}\b/, 'SI'],
    [/\bZB[A-Z]?\d{1,2}\b/, 'ZB'],
    [/\bZN[A-Z]?\d{1,2}\b/, 'ZN'],
    [/\bZF[A-Z]?\d{1,2}\b/, 'ZF'],
    [/\b6E[A-Z]?\d{1,2}\b/, '6E'],
    [/\b6B[A-Z]?\d{1,2}\b/, '6B'],
    [/\b6J[A-Z]?\d{1,2}\b/, '6J'],
    [/\bBTC[A-Z]?\d{0,2}\b/, 'BTC'],
    [/\bETH[A-Z]?\d{0,2}\b/, 'ETH'],
  ];

  for (const [pattern, ticker] of explicitTickerPatterns) {
    if (pattern.test(cleaned)) {
      return ticker;
    }
  }

  if (cleaned.includes('MICRO NASDAQ') || cleaned.includes('MICRO E-MINI NASDAQ') || cleaned.includes('MICRO NASDAQ-100')) {
    return 'MNQ';
  }

  if (cleaned.includes('NASDAQ')) {
    return cleaned.includes('MICRO') ? 'MNQ' : 'NQ';
  }

  if (cleaned.includes('MICRO S&P') || cleaned.includes('MICRO SP')) {
    return 'MES';
  }

  if (cleaned.includes('S&P') || cleaned.includes('SP 500') || cleaned.includes('E-MINI S&P') || cleaned.includes('E MINI S&P')) {
    return cleaned.includes('MICRO') ? 'MES' : 'ES';
  }

  return invalidValues.has(rootCleaned) ? null : rootCleaned;
}

function parseNullableTime(value: unknown): string | null {
  const normalized = parseNullableString(value);
  return normalized && /^\d{2}:\d{2}$/.test(normalized) ? normalized : null;
}

function parseNullableDirection(value: unknown): 'Long' | 'Short' | null {
  return value === 'Long' || value === 'Short' ? value : null;
}

function parseNullableExitReason(value: unknown): 'TP' | 'SL' | null {
  return value === 'TP' || value === 'SL' ? value : null;
}

function parseNullablePnLResult(value: unknown): 'Win' | 'Loss' | null {
  return value === 'Win' || value === 'Loss' ? value : null;
}

function parseNullableExitConfidence(value: unknown): ExitConfidence | null {
  return typeof value === 'string' && EXIT_CONFIDENCE_VALUES.includes(value as ExitConfidence)
    ? (value as ExitConfidence)
    : null;
}

function parseNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function pickFirstNonNull<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}

function appendWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function buildEntryTimeHint(extractedEntryTime: string | null): string {
  return extractedEntryTime
    ? `Use the screenshot's entry time of ${extractedEntryTime} only if it matches the x-axis.`
    : 'Do not use any fallback clock time to decide the outcome. Read the entry candle from the left edge of the risk/reward box on the screenshot.';
}

function formatScannerContext(scannerContext?: ScannerContext): string {
  if (!scannerContext) {
    return 'No geometric trade-box detection metadata was available.';
  }

  const directionDirective = scannerContext.direction_hint === 'Short'
    ? `CRITICAL â€” DIRECTION IS SHORT: Pixel analysis confirmed the red/pink zone is ABOVE entry and teal zone is BELOW entry.
  - stop-label-focus IS centered on the SL level which is ABOVE entry â†’ sl_price WILL BE GREATER than entry_price
  - target-label-focus IS centered on the TP level which is BELOW entry â†’ tp_price WILL BE LESS than entry_price
  - Do NOT swap or re-interpret these values. Read each crop as labelled. Do NOT use price ordering to override the direction.`
    : scannerContext.direction_hint === 'Long'
    ? `CRITICAL â€” DIRECTION IS LONG: Pixel analysis confirmed the teal zone is ABOVE entry and red/pink zone is BELOW entry.
  - stop-label-focus IS centered on the SL level which is BELOW entry â†’ sl_price WILL BE LESS than entry_price
  - target-label-focus IS centered on the TP level which is ABOVE entry â†’ tp_price WILL BE GREATER than entry_price
  - Do NOT swap or re-interpret these values. Read each crop as labelled. Do NOT use price ordering to override the direction.`
    : 'Direction could not be determined from pixel analysis â€” infer from box layout.';

  return `Detected trade-box geometry from image processing:
${directionDirective}
- direction_hint: ${scannerContext.direction_hint ?? 'unknown'}
- entry_line_ratio: ${scannerContext.entry_line_ratio ?? 'unknown'}
- stop_line_ratio: ${scannerContext.stop_line_ratio ?? 'unknown'}
- target_line_ratio: ${scannerContext.target_line_ratio ?? 'unknown'}
- box_left_ratio: ${scannerContext.box_left_ratio ?? 'unknown'}
- box_right_ratio: ${scannerContext.box_right_ratio ?? 'unknown'}`;
}

function describeImageLabel(label: string): string {
  switch (label) {
    case 'full_chart':
      return 'the full chart for overall candle sequence, x-axis timing, and confirmation';
    case 'header-focus':
      return 'a zoomed crop of the top-left chart header for symbol and timeframe; the timeframe is the interval immediately beside the ticker';
    case 'trade-box-focus':
      return 'a zoomed crop around the trade box for direction, entry edge, and price movement';
    case 'entry-window-focus':
      return 'a tight crop around the left edge of the trade box and the first candles after entry; use this as the primary first-touch view';
    case 'exit-path-focus':
      return 'a focused crop covering the immediate candles after entry and the full path to the first likely exit touch';
    case 'price-label-focus':
      return 'a zoomed crop of the right-side price labels; use this for the exact entry, stop, and target numbers';
    case 'entry-label-focus':
      return 'a tight crop centered on the entry price label; use this as the primary source for entry_price';
    case 'stop-label-focus':
      return 'a tight crop centered on the stop-loss label; use this as the primary source for sl_price';
    case 'target-label-focus':
      return 'a tight crop centered on the take-profit label; use this as the primary source for tp_price';
    default:
      return 'an additional focused crop of the chart';
  }
}

function selectImagesByLabels(images: ChartImageInput[], labels: string[]): ChartImageInput[] {
  const allowedLabels = new Set(labels);
  const selected = images.filter(image => allowedLabels.has(image.label));

  if (selected.length > 0) {
    return selected;
  }

  return images.filter(image => image.label === 'full_chart');
}

function hasValidLevelStructure(direction: 'Long' | 'Short' | null, entry: number | null, stop: number | null, target: number | null): boolean {
  if (!direction || entry === null || stop === null || target === null) {
    return false;
  }

  return direction === 'Long'
    ? stop < entry && entry < target
    : target < entry && entry < stop;
}

function normalizeExitConfidence(...values: Array<ExitConfidence | null>): ExitConfidence | null {
  if (values.includes('high')) return 'high';
  if (values.includes('medium')) return 'medium';
  if (values.includes('low')) return 'low';
  return null;
}

function pickMostCommonString<T extends string>(...values: Array<T | null | undefined>): T | null {
  const counts = new Map<T, number>();

  values.forEach(value => {
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  });

  let bestValue: T | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  });

  return bestValue;
}

function countVotes(...values: Array<'TP' | 'SL' | null>): { TP: number; SL: number } {
  return values.reduce((acc, value) => {
    if (value === 'TP' || value === 'SL') {
      acc[value] += 1;
    }
    return acc;
  }, { TP: 0, SL: 0 });
}

function pickMostCommonNumber(...values: Array<number | null>): number | null {
  const counts = new Map<number, number>();

  values.forEach(value => {
    if (value !== null) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  });

  let bestValue: number | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  });

  return bestValue;
}

function chooseConsensusNumber(...values: Array<number | null | undefined>): number | null {
  const normalized = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (normalized.length === 0) {
    return null;
  }

  const mostCommon = pickMostCommonNumber(...normalized);
  if (mostCommon !== null) {
    return mostCommon;
  }

  const sorted = [...normalized].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function inferDirectionFromLevels(entry: number | null, stop: number | null, target: number | null): 'Long' | 'Short' | null {
  if (entry === null || stop === null || target === null) {
    return null;
  }

  if (stop < entry && entry < target) {
    return 'Long';
  }

  if (target < entry && entry < stop) {
    return 'Short';
  }

  return null;
}

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
  return Array.from(
    new Set(
      values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    )
  );
}

function repairTradeStructure(
  direction: 'Long' | 'Short' | null,
  entry: number | null,
  stop: number | null,
  target: number | null,
  labeledCandidates: {
    entries: Array<number | null | undefined>;
    stops: Array<number | null | undefined>;
    targets: Array<number | null | undefined>;
  }
): {
  direction: 'Long' | 'Short' | null;
  entry_price: number | null;
  sl_price: number | null;
  tp_price: number | null;
} {
  const resolvedDirection = direction ?? inferDirectionFromLevels(entry, stop, target);

  if (hasValidLevelStructure(resolvedDirection, entry, stop, target)) {
    return {
      direction: resolvedDirection,
      entry_price: entry,
      sl_price: stop,
      tp_price: target,
    };
  }

  const entryCandidates = uniqueNumbers(labeledCandidates.entries);
  const stopCandidates = uniqueNumbers(labeledCandidates.stops);
  const targetCandidates = uniqueNumbers(labeledCandidates.targets);
  const allCandidates = uniqueNumbers([...entryCandidates, ...stopCandidates, ...targetCandidates]);

  if (!resolvedDirection || allCandidates.length < 3) {
    return {
      direction: resolvedDirection,
      entry_price: entry,
      sl_price: stop,
      tp_price: target,
    };
  }

  const sortedAll = [...allCandidates].sort((a, b) => a - b);
  const minCandidate = sortedAll[0];
  const maxCandidate = sortedAll[sortedAll.length - 1];
  const interiorCandidates = sortedAll.filter(value => value > minCandidate && value < maxCandidate);

  const preferredEntry = chooseConsensusNumber(entry, ...entryCandidates);
  const preferredStop = chooseConsensusNumber(stop, ...stopCandidates);
  const preferredTarget = chooseConsensusNumber(target, ...targetCandidates);

  if (resolvedDirection === 'Long') {
    const repairedStop = stopCandidates.find(value => value < (preferredEntry ?? Number.POSITIVE_INFINITY)) ?? preferredStop ?? minCandidate;
    const repairedTarget = [...targetCandidates].reverse().find(value => value > (preferredEntry ?? Number.NEGATIVE_INFINITY)) ?? preferredTarget ?? maxCandidate;
    const repairedEntry = entryCandidates.find(value => value > repairedStop && value < repairedTarget)
      ?? preferredEntry
      ?? interiorCandidates[0]
      ?? sortedAll[Math.floor(sortedAll.length / 2)];

    return {
      direction: 'Long',
      entry_price: repairedEntry,
      sl_price: repairedStop,
      tp_price: repairedTarget,
    };
  }

  const repairedStop = [...stopCandidates].reverse().find(value => value > (preferredEntry ?? Number.NEGATIVE_INFINITY)) ?? preferredStop ?? maxCandidate;
  const repairedTarget = targetCandidates.find(value => value < (preferredEntry ?? Number.POSITIVE_INFINITY)) ?? preferredTarget ?? minCandidate;
  const repairedEntry = entryCandidates.find(value => value > repairedTarget && value < repairedStop)
    ?? preferredEntry
    ?? interiorCandidates[interiorCandidates.length - 1]
    ?? sortedAll[Math.floor(sortedAll.length / 2)];

  return {
    direction: 'Short',
    entry_price: repairedEntry,
    sl_price: repairedStop,
    tp_price: repairedTarget,
  };
}

function clearExitOutcome(data: ExtractedTradeData): void {
  data.exit_reason = null;
  data.pnl_result = null;
  data.trade_length_seconds = null;
  data.candle_count = null;
  data.exit_confidence = null;
  data.first_touch_candle_index = null;
  data.first_touch_evidence = null;
}

function sanitizeExtractedTradeData(raw: Record<string, unknown>): ExtractedTradeData {
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    : [];

  const data: ExtractedTradeData = {
    symbol: parseNullableString(raw.symbol),
    direction: parseNullableDirection(raw.direction),
    entry_price: parseNullableNumber(raw.entry_price),
    entry_time: parseNullableTime(raw.entry_time),
    entry_time_confidence: parseNullableExitConfidence(raw.entry_time_confidence),
    sl_price: parseNullableNumber(raw.sl_price),
    tp_price: parseNullableNumber(raw.tp_price),
    trade_length_seconds: parseNullableNumber(raw.trade_length_seconds),
    candle_count: parseNullableNumber(raw.candle_count),
    timeframe_minutes: parseNullableNumber(raw.timeframe_minutes),
    exit_reason: parseNullableExitReason(raw.exit_reason),
    pnl_result: parseNullablePnLResult(raw.pnl_result),
    exit_confidence: parseNullableExitConfidence(raw.exit_confidence),
    first_touch_candle_index: parseNullableNumber(raw.first_touch_candle_index),
    first_touch_evidence: parseNullableString(raw.first_touch_evidence),
    warnings,
  };

  if (data.symbol) {
    data.symbol = normalizeScannedSymbol(data.symbol);
  }

  if (data.exit_reason !== null) {
    data.pnl_result = data.exit_reason === 'TP' ? 'Win' : 'Loss';
  }

  return data;
}

function sanitizeExactPriceRead(raw: Record<string, unknown>): ExactPriceRead {
  return {
    direction: parseNullableDirection(raw.direction),
    entry_price: parseNullableNumber(raw.entry_price),
    sl_price: parseNullableNumber(raw.sl_price),
    tp_price: parseNullableNumber(raw.tp_price),
  };
}

function sanitizeHeaderIdentityRead(raw: Record<string, unknown>): HeaderIdentityRead {
  return {
    symbol: normalizeScannedSymbol(parseNullableString(raw.symbol)),
    timeframe_minutes: parseNullableNumber(raw.timeframe_minutes),
  };
}

async function extractHeaderIdentity(images: ChartImageInput[]): Promise<HeaderIdentityRead> {
  const systemPrompt = `You are reading ONLY the TradingView header of the single chart that contains the colored risk/reward box.

  Read only:
  - the exact futures ticker/root from the top-left chart label
  - the timeframe from the small interval immediately beside the ticker in that same header

Critical symbol rules:
- Return the tradeable root ticker, not generic words
- Good outputs: MNQ, NQ, MES, ES, MYM, YM, M2K, RTY, CL, MCL, GC, MGC, SI, SIL, 6E, 6B, 6J, BTC, MBT, ETH, MET
- If the header shows an expiry code like MNQM26 or NQU6, return the root ticker only: MNQ or NQ
- If the header says Micro Nasdaq-100 or Micro E-mini Nasdaq-100, return MNQ
- If the header says E-mini Nasdaq-100, return NQ
- NEVER return generic words like Futures, Micro, E-mini, CME, CBOT, or TradingView as the symbol

Critical timeframe rules:
- Read the timeframe ONLY from the interval shown immediately beside the ticker/root in the top-left header
- Example: "MNQM6 Â· 1 Â· CME" => timeframe_minutes = 1
- Example: "NQ1! Â· 5" => timeframe_minutes = 5
- Example: "ES1! Â· 15" => timeframe_minutes = 15
- Do NOT estimate timeframe from candle width, chart zoom, x-axis spacing, or trade duration
- Return timeframe_minutes as a number in minutes only

Return ONLY a raw JSON object with these exact keys:
symbol, timeframe_minutes`;

  return sanitizeHeaderIdentityRead(await callClaudeJson(
    systemPrompt,
    images,
    'Read only the instrument ticker/root and the timeframe interval printed immediately beside it in the header of the chart containing the colored risk/reward box.',
    250
  ));
}

function buildPriceExtractionPrompt(scannerContext?: ScannerContext): string {
  const hasGeometry = Boolean(
    scannerContext?.entry_line_ratio != null &&
    scannerContext?.stop_line_ratio  != null &&
    scannerContext?.target_line_ratio != null
  );

  const pct = (r: number) => (r * 100).toFixed(1);

  const geometrySection = hasGeometry ? `
PIXEL GEOMETRY (from pre-scan analysis â€” use these to locate each label):
- Entry price label: ${pct(scannerContext!.entry_line_ratio!)}% from the TOP of the full chart image
- Stop price label:  ${pct(scannerContext!.stop_line_ratio!)}% from the TOP of the full chart image
- Target price label:${pct(scannerContext!.target_line_ratio!)}% from the TOP of the full chart image
- Trade direction hint: ${scannerContext!.direction_hint ?? 'unknown'}

The dedicated label crops (entry-label-focus, stop-label-focus, target-label-focus)
have been 2Ã— upscaled with nearest-neighbour interpolation so digits are crisp.
` : `
No geometry hints available. Read all visible price labels from the price axis.
`;

  return `Read the exact price values for entry, stop-loss, and take-profit from the chart.
${geometrySection}
READING PROCEDURE â€” follow every step:

STEP 1 â€” Examine the price-label-focus image (full right-hand price axis).
  Identify the labelled price levels that correspond to the trade box.
  CRITICAL: TradingView displays a floating green box label on the right axis showing the current live market price.
  This is NOT a trade level â€” it is where price is right now, not entry/SL/TP.
  IGNORE IT COMPLETELY. Do not assign it to entry, stop-loss, or take-profit under any circumstances.

STEP 2 â€” Examine the trade-box-focus image.
  Identify the coloured boxes (red = SL zone, teal/green = TP zone).
  Note where each box begins and ends relative to the price axis.

AUTHORITY RULE: The dedicated crops (entry-label-focus, stop-label-focus, target-label-focus) are
  the ONLY authoritative source for each price. Read the digits in THAT crop for THAT field only.
  Never substitute a value from the general price axis or from any other crop into a different field.

STEP 3 â€” For the ENTRY price:
  Look at the entry-label-focus crop. It is centred on the entry level.
  Read every digit left to right. Do not guess. Do not round.
  Cross-check: the entry price should be at the BOUNDARY between the red and green boxes.

STEP 4 â€” For the STOP-LOSS price:
  Look at the stop-label-focus crop. It is centred on the stop level.
  Read every digit left to right. Do not guess. Do not round.
  IMPORTANT: The crop label tells you what level this is â€” trust it. Do NOT swap this value with the target.

STEP 5 â€” For the TAKE-PROFIT price:
  Look at the target-label-focus crop. It is centred on the target level.
  Read every digit left to right. Do not guess. Do not round.
  IMPORTANT: The crop label tells you what level this is â€” trust it. Do NOT swap this value with the stop.

STEP 6 â€” DIGIT VERIFICATION:
  For each price, spell out the digits you read (e.g., "2 1 3 4 5 point 5 0").
  If any digit is ambiguous between two values (e.g., 3 vs 8, 1 vs 7), read the
  full-price-axis image to find a nearby unambiguous label for context.

STEP 7 â€” RETURN JSON:
  Only return prices you are certain about. Return null for any price you cannot
  read with full confidence.

Return ONLY this JSON with no preamble:
{
  "entry_price": number | null,
  "sl_price": number | null,
  "tp_price": number | null,
  "direction": "Long" | "Short" | null,
  "entry_digits_read": string,
  "sl_digits_read": string,
  "tp_digits_read": string,
  "entry_confidence": "high" | "medium" | "low",
  "sl_confidence": "high" | "medium" | "low",
  "tp_confidence": "high" | "medium" | "low"
}`;
}

async function extractExactPriceLevels(
  images: ChartImageInput[],
  scannerContext?: ScannerContext
): Promise<ExactPriceRead> {
  const systemPrompt = `You are a price-axis OCR engine. You read exact numerical values from TradingView
chart screenshots with zero tolerance for errors. You never estimate or interpolate.
You never round to a "nice" number. You read the digits that are literally printed
on screen. Return only valid JSON.`;

  const imageContent = images.map(image => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: image.mimeType as ImageMimeType,
      data: image.base64Image,
    },
  }));

  const imageGuide = images
    .map((image, index) => `Image ${index + 1} (${image.label}): ${describeImageLabel(image.label)}`)
    .join('\n');

  const response = await (anthropic as unknown as { messages: { create: (params: unknown, options?: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }> } }).messages.create(
    {
      model: MODEL,
      max_tokens: 4000,
      temperature: 0,
      thinking: { type: 'enabled', budget_tokens: 2000 },
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `${buildPriceExtractionPrompt(scannerContext)}\n\nAttached views:\n${imageGuide}`,
            },
          ],
        },
      ],
    },
    { headers: { 'anthropic-beta': 'interleaved-thinking-2025-05-14' } }
  );

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');

  return sanitizeExactPriceRead(parseJsonObject(text.trim()));
}

async function verifyPriceDigits(
  priceImages: ChartImageInput[],
  candidate: { entry_price: number | null; sl_price: number | null; tp_price: number | null; direction: string | null },
  scannerContext?: ScannerContext
): Promise<{ entry_price: number | null; sl_price: number | null; tp_price: number | null; changed: boolean }> {
  if (!candidate.entry_price && !candidate.sl_price && !candidate.tp_price) {
    return { ...candidate, changed: false };
  }

  const imageContent = priceImages.map(img => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: img.mimeType as ImageMimeType, data: img.base64Image },
  }));

  const pct = (r: number | undefined | null) => r != null ? (r * 100).toFixed(1) : 'unknown';

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    temperature: 0,
    system: 'You verify that price numbers read from a chart are correct. You double-check digit by digit. Return only JSON.',
    messages: [{
      role: 'user',
      content: [
        ...imageContent,
        {
          type: 'text',
          text: `A previous read extracted these prices from the chart:
- Entry: ${candidate.entry_price ?? 'not found'}
- Stop Loss: ${candidate.sl_price ?? 'not found'}
- Take Profit: ${candidate.tp_price ?? 'not found'}
- Direction: ${candidate.direction ?? 'unknown'}
${scannerContext?.entry_line_ratio != null ? `
Pixel positions (% from top of image):
- Entry label at: ${pct(scannerContext.entry_line_ratio)}%
- Stop label at:  ${pct(scannerContext.stop_line_ratio)}%
- Target label at:${pct(scannerContext.target_line_ratio)}%` : ''}

For each price that was found, look at the corresponding label crop image and verify:
1. Are the digits correct? Read them left-to-right explicitly.
2. Could any digit be misread (3â†”8, 1â†”7, 5â†”6, 0â†”9)?
3. Is the decimal point in the right place?
4. Does the price order make sense for a ${candidate.direction ?? 'unknown'} trade?

If a price is CORRECT, return it unchanged.
If a price has a WRONG DIGIT, return the corrected value.
If you CANNOT VERIFY a price (label not visible), return the original value unchanged.

Return ONLY:
{
  "entry_price": number | null,
  "sl_price": number | null,
  "tp_price": number | null,
  "entry_verified": boolean,
  "sl_verified": boolean,
  "tp_verified": boolean,
  "corrections": string[]
}`,
        },
      ],
    }],
  });

  const text = response.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('');
  const clean = text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    const changed =
      parsed.entry_price !== candidate.entry_price ||
      parsed.sl_price    !== candidate.sl_price    ||
      parsed.tp_price    !== candidate.tp_price;

    return {
      entry_price: parseNullableNumber(parsed.entry_price) ?? candidate.entry_price,
      sl_price:    parseNullableNumber(parsed.sl_price)    ?? candidate.sl_price,
      tp_price:    parseNullableNumber(parsed.tp_price)    ?? candidate.tp_price,
      changed,
    };
  } catch {
    return { ...candidate, changed: false };
  }
}

function applyExactPriceRead(base: ExtractedTradeData, exactPriceRead: ExactPriceRead | null): ExtractedTradeData {
  if (!exactPriceRead) {
    return base;
  }

  const exactValueCount = [
    exactPriceRead.entry_price,
    exactPriceRead.sl_price,
    exactPriceRead.tp_price,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).length;

  if (exactValueCount < 2) {
    return base;
  }

  const repairedStructure = repairTradeStructure(
    pickMostCommonString(exactPriceRead.direction, base.direction),
    chooseConsensusNumber(exactPriceRead.entry_price, base.entry_price),
    chooseConsensusNumber(exactPriceRead.sl_price, base.sl_price),
    chooseConsensusNumber(exactPriceRead.tp_price, base.tp_price),
    {
      entries: [exactPriceRead.entry_price, base.entry_price],
      stops: [exactPriceRead.sl_price, base.sl_price],
      targets: [exactPriceRead.tp_price, base.tp_price],
    }
  );

  return {
    ...base,
    direction: repairedStructure.direction ?? base.direction,
    entry_price: repairedStructure.entry_price ?? base.entry_price,
    sl_price: repairedStructure.sl_price ?? base.sl_price,
    tp_price: repairedStructure.tp_price ?? base.tp_price,
  };
}

function applyHeaderIdentityRead(base: ExtractedTradeData, headerIdentityRead: HeaderIdentityRead | null): ExtractedTradeData {
  if (!headerIdentityRead) {
    return base;
  }

  return {
    ...base,
    symbol: headerIdentityRead.symbol ?? base.symbol,
    timeframe_minutes: headerIdentityRead.timeframe_minutes ?? base.timeframe_minutes,
  };
}

async function callClaudeJson(
  system: string,
  images: ChartImageInput[],
  userText: string,
  maxTokens = 1024
): Promise<Record<string, unknown>> {
  const imageContent = images.map(image => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: image.mimeType,
      data: image.base64Image,
    },
  }));

  const imageGuide = images
    .map((image, index) => `Image ${index + 1} (${image.label}): ${describeImageLabel(image.label)}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: maxTokens,
    system,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `${userText}\n\nAttached views:\n${imageGuide}`,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return parseJsonObject(content.text.trim());
}

async function extractTradeFacts(
  images: ChartImageInput[],
  entryDate: string,
  fallbackEntryTime: string,
  scannerContext?: ScannerContext
): Promise<ExtractedTradeData> {
  const systemPrompt = `You are a futures trade data extractor analysing TradingView screenshots with a risk/reward box.
${MANUAL_READING_PROCESS}

Read these facts directly from the screenshot:
- symbol
- direction
- entry_price
- entry_time
- sl_price
- tp_price
- timeframe_minutes

Symbol rules:
- Read the symbol from the top-left chart label only
- Return the tradable root ticker such as MNQ, NQ, MES, ES, MYM, YM, M2K, RTY, CL, MCL, GC, MGC, SI, SIL, 6E, 6B, 6J, BTC, MBT, ETH, MET
- If the header shows an expiry code like MNQM26 or NQU6, return MNQ or NQ
- Never return generic words like Futures, Micro, E-mini, CME, CBOT, or TradingView as the symbol

Timeframe rules:
- Read timeframe_minutes from the top-left header only
- The timeframe is the interval value printed immediately beside the symbol/ticker
- Example: "MNQM6 Â· 1 Â· CME" means timeframe_minutes = 1
- Do not infer timeframe from the x-axis, candle spacing, zoom level, or trade duration

Never estimate price labels. Read the exact numbers shown on the right axis labels.
If entry-label-focus, stop-label-focus, or target-label-focus are attached, use those as the primary source for the exact prices.
If entry time is not clearly readable, return null for entry_time and low or null confidence.

Return ONLY a raw JSON object with these exact keys:
symbol, direction, entry_price, entry_time, entry_time_confidence, sl_price, tp_price, timeframe_minutes, exit_reason, pnl_result, trade_length_seconds, candle_count

Rules for these extra fields:
- You may include exit_reason, pnl_result, trade_length_seconds, candle_count if the chart is clear.
- If unclear, return null for them.
- exit_reason must be TP or SL only if you can visibly determine which was touched first.`;

  return sanitizeExtractedTradeData(await callClaudeJson(
    systemPrompt,
    images,
    `Trade date: ${entryDate}. Fallback entry time hint if the x-axis is unclear: ${fallbackEntryTime}. ${formatScannerContext(scannerContext)} Extract the trade facts from this screenshot.`,
    1100
  ));
}

async function verifyExitOrder(
  images: ChartImageInput[],
  entryDate: string,
  baseRead: ExtractedTradeData,
  scannerContext?: ScannerContext
): Promise<ExitVerificationResult> {
  const exitImages = selectImagesByLabels(images, [
    'full_chart',
    'exit-path-focus',
    'trade-box-focus',
    'price-label-focus',
  ]);

  if (!baseRead.direction || !baseRead.entry_price || !baseRead.sl_price || !baseRead.tp_price) {
    return {
      exit_reason: null,
      trade_length_seconds: null,
      candle_count: null,
      timeframe_minutes: baseRead.timeframe_minutes ?? null,
      exit_confidence: 'low',
      first_touch_candle_index: null,
      first_touch_evidence: null,
    };
  }

  const direction = baseRead.direction;
  const entry     = baseRead.entry_price;
  const sl        = baseRead.sl_price;
  const tp        = baseRead.tp_price;
  const isShort   = direction === 'Short';

  const geoHints = scannerContext?.entry_line_ratio != null ? `
PIXEL GEOMETRY (pre-calculated â€” use to orient yourself):
- Entry level is at ${(scannerContext.entry_line_ratio! * 100).toFixed(1)}% from top of image
- Stop level is at ${(scannerContext.stop_line_ratio! * 100).toFixed(1)}% from top of image
- Target level is at ${(scannerContext.target_line_ratio! * 100).toFixed(1)}% from top of image
- Trade box spans ${(scannerContext.box_left_ratio! * 100).toFixed(1)}%â€“${(scannerContext.box_right_ratio! * 100).toFixed(1)}% of image width
` : '';

  const imageContent = exitImages.map(img => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mimeType as ImageMimeType,
      data: img.base64Image,
    },
  }));

  const response = await (anthropic as unknown as { messages: { create: (params: unknown, options?: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }> } }).messages.create(
    {
      model: MODEL,
      max_tokens: 3000,
      temperature: 0,
      thinking: { type: 'enabled', budget_tokens: 2000 },
      system: `You are a chart exit analyst. You determine whether a trade hit its stop loss
or take profit by visually reading a TradingView candlestick chart. You are precise,
methodical, and never guess. You only report what you can directly see.`,
      messages: [{
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `Determine whether this trade exited at Stop Loss or Take Profit.

TRADE DETAILS:
- Instrument: ${baseRead.symbol ?? 'unknown'}
- Direction: ${direction}
- Entry Price: ${entry}
- Stop Loss: ${sl} (${isShort ? 'ABOVE entry â€” a SHORT stop, price must NOT exceed this' : 'BELOW entry â€” a LONG stop, price must NOT fall below this'})
- Take Profit: ${tp} (${isShort ? 'BELOW entry â€” target price for the short' : 'ABOVE entry â€” target price for the long'})
- Entry Date: ${entryDate}
${geoHints}

READING PROCEDURE â€” follow every step exactly:

STEP 1 â€” LOCATE THE PRICE AXIS
Look at the right edge of the chart. Find the numerical price labels.
Confirm you can see labels near ${sl} and ${tp} on the axis.

STEP 2 â€” DRAW MENTAL HORIZONTAL LINES
From the ${sl} label, trace a horizontal line LEFT across the entire chart.
From the ${tp} label, trace a horizontal line LEFT across the entire chart.
These are your two trigger lines.

STEP 3 â€” IDENTIFY THE ENTRY CANDLE
Find the candle at the entry point (approximately where the trade box ends on the right side).
Everything to the LEFT of this candle is irrelevant â€” ignore it.

STEP 4 â€” SCAN CANDLES AFTER ENTRY (left to right, one by one)
For each candle AFTER the entry candle, check:

${isShort ? `- Does the candle HIGH (top of wick) reach OR exceed ${sl}?
  If YES â†’ this candle triggered the STOP LOSS
- Does the candle LOW (bottom of wick) reach OR go below ${tp}?
  If YES â†’ this candle triggered the TAKE PROFIT` : `- Does the candle LOW (bottom of wick) reach OR go below ${sl}?
  If YES â†’ this candle triggered the STOP LOSS
- Does the candle HIGH (top of wick) reach OR exceed ${tp}?
  If YES â†’ this candle triggered the TAKE PROFIT`}

STEP 5 â€” DETERMINE WHICH CAME FIRST
The FIRST candle (leftmost / earliest) that triggered either level = the exit.
If stop was triggered before target â†’ exit_reason = "SL"
If target was triggered before stop â†’ exit_reason = "TP"
If neither level was reached in the visible chart â†’ exit_reason = null

STEP 6 â€” CHECK THE CURRENT PRICE LABEL
Look at the current price shown on the right axis (the highlighted marker).
${isShort ? `If current price > ${sl}, price has already blown through the stop.` : `If current price < ${sl}, price has already blown through the stop.`}
Use this as a final confirmation.

STEP 7 â€” COUNT CANDLES
Count how many 1-minute candles elapsed between entry and exit.
Multiply by 60 to get trade_length_seconds.

STEP 8 â€” WRITE YOUR EVIDENCE
In first_touch_evidence, describe in one sentence exactly what you saw.
Example: "The candle at approximately 10:17 has a wick that rises above the 25,773.75 stop level, while no candle reached the 25,704 target."

Return ONLY this JSON:
{
  "exit_reason": "TP" | "SL" | null,
  "exit_confidence": "high" | "medium" | "low",
  "sl_triggered": boolean,
  "tp_triggered": boolean,
  "sl_triggered_first": boolean | null,
  "tp_triggered_first": boolean | null,
  "candles_after_entry_checked": number,
  "candle_count": number | null,
  "trade_length_seconds": number | null,
  "timeframe_minutes": 1,
  "first_touch_candle_index": number | null,
  "first_touch_evidence": string
}`,
          },
        ],
      }],
    },
    { headers: { 'anthropic-beta': 'interleaved-thinking-2025-05-14' } }
  );

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');

  const clean = text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(clean) as Record<string, unknown>;

    let exitReason = parseNullableExitReason(parsed.exit_reason);
    if (parsed.sl_triggered && parsed.tp_triggered) {
      exitReason = parsed.sl_triggered_first ? 'SL' : 'TP';
    } else if (parsed.sl_triggered && !parsed.tp_triggered) {
      exitReason = 'SL';
    } else if (parsed.tp_triggered && !parsed.sl_triggered) {
      exitReason = 'TP';
    }

    return {
      exit_reason:              exitReason,
      trade_length_seconds:     parseNullableNumber(parsed.trade_length_seconds),
      candle_count:             parseNullableNumber(parsed.candle_count),
      timeframe_minutes:        parseNullableNumber(parsed.timeframe_minutes) ?? baseRead.timeframe_minutes ?? null,
      exit_confidence:          parseNullableExitConfidence(parsed.exit_confidence) ?? 'low',
      first_touch_candle_index: parseNullableNumber(parsed.first_touch_candle_index),
      first_touch_evidence:     parseNullableString(parsed.first_touch_evidence),
    };
  } catch {
    throw new Error('verifyExitOrder: failed to parse response');
  }
}

async function sanityCheckLevelTouches(
  images: ChartImageInput[],
  entryDate: string,
  baseRead: ExtractedTradeData
): Promise<LevelTouchSanityResult> {
  const sanityImages = selectImagesByLabels(images, [
    'full_chart',
    'trade-box-focus',
    'exit-path-focus',
  ]);

  if (!baseRead.direction || !baseRead.entry_price || !baseRead.sl_price || !baseRead.tp_price) {
    return { stop_touched: null, target_touched: null, first_touch: null, evidence: null };
  }

  const isShort = baseRead.direction === 'Short';
  const sl      = baseRead.sl_price;
  const tp      = baseRead.tp_price;

  const imageContent = sanityImages.map(img => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.mimeType as ImageMimeType,
      data: img.base64Image,
    },
  }));

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    temperature: 0,
    system: 'You are a binary chart level checker. Answer only with JSON. No explanations outside the JSON.',
    messages: [{
      role: 'user',
      content: [
        ...imageContent,
        {
          type: 'text',
          text: `Look at this TradingView chart from ${entryDate}. Answer two yes/no questions about candles that appear AFTER the trade entry.

Trade:
- Direction: ${baseRead.direction}
- Entry: ${baseRead.entry_price}
- Stop Loss: ${sl}
- Take Profit: ${tp}

The entry candle is where the coloured trade box ends on the right side.
Only look at candles to the RIGHT of the trade box.

QUESTION 1: Do any candle ${isShort ? 'HIGHS (wicks)' : 'LOWS (wicks)'} touch or cross the Stop Loss level of ${sl}?
Answer yes if you can see any wick reach that price level.

QUESTION 2: Do any candle ${isShort ? 'LOWS (wicks)' : 'HIGHS (wicks)'} touch or cross the Take Profit level of ${tp}?
Answer yes if you can see any wick reach that price level.

QUESTION 3: Which happened on an earlier candle (further left on the chart)?

Return ONLY:
{
  "stop_touched": true | false,
  "target_touched": true | false,
  "first_touch": "SL" | "TP" | null,
  "evidence": "one sentence describing what you saw"
}`,
        },
      ],
    }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('');

  const clean = text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(clean) as Record<string, unknown>;
    return {
      stop_touched:   parseNullableBoolean(parsed.stop_touched),
      target_touched: parseNullableBoolean(parsed.target_touched),
      first_touch:    parseNullableExitReason(parsed.first_touch),
      evidence:       parseNullableString(parsed.evidence),
    };
  } catch {
    return { stop_touched: null, target_touched: null, first_touch: null, evidence: null };
  }
}

async function humanStyleReview(
  images: ChartImageInput[],
  entryDate: string,
  fallbackEntryTime: string,
  scannerContext?: ScannerContext
): Promise<ExtractedTradeData> {
  const reviewPrompt = `Review this chart exactly like a skilled human trader filling out a trade journal by eye.
${MANUAL_READING_PROCESS}
${FIRST_TOUCH_RULE}

Use only the screenshot itself and read it in this exact order:
1. Read the symbol and timeframe from the top-left label.
   The timeframe is the interval shown immediately beside the ticker in the header.
2. Read entry, stop loss, and take profit from the exact right-axis labels.
3. Infer long or short from the box layout.
4. Read the entry time from the x-axis using the left edge of the risk/reward box.
5. Follow candles from the entry candle until the first touch of stop or target.
6. Count candles to the exit and compute trade_length_seconds.

You should make the most likely decision even when the chart is slightly messy, but do not invent price labels.

Return ONLY a raw JSON object with these exact keys:
symbol, direction, entry_price, entry_time, entry_time_confidence, sl_price, tp_price, timeframe_minutes, exit_reason, pnl_result, trade_length_seconds, candle_count, exit_confidence, first_touch_evidence`;

  return sanitizeExtractedTradeData(await callClaudeJson(
    reviewPrompt,
    images,
    `Trade date: ${entryDate}. ${buildEntryTimeHint(null)} Fallback time for the form is ${fallbackEntryTime}, but do not let that override the chart itself. Read this chart the same way a human would fill a journal entry.`,
    1200
  ));
}

async function decisiveFinalReview(
  images: ChartImageInput[],
  entryDate: string,
  fallbackEntryTime: string,
  extraction: ExtractedTradeData,
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  scannerContext?: ScannerContext
): Promise<ExtractedTradeData> {
  const decisivePrompt = `You are the final decision-maker for a futures trade journal scanner.

Your job is to read the TradingView screenshot exactly the way an experienced trader would manually journal it.
You must return one single best final answer, not an abstention.

${MANUAL_READING_PROCESS}
${FIRST_TOUCH_RULE}

Use header-focus for symbol/timeframe, the three label-focus crops for exact levels, entry-window-focus for the exact entry anchor, and exit-path-focus for the first-touch path after entry.
When deciding timeframe_minutes, trust the header-focus interval immediately beside the ticker over every other clue.
If a comparison chart is visible anywhere, ignore it unless it is the chart with the colored risk/reward box.

If the earlier passes disagree, use them only as hints. The screenshot itself is the source of truth.
Do not return manual review text. Choose the single most likely final interpretation.
Never invent price levels that are not visible on the screenshot. If one field is slightly unclear, use the best supported value from the hints below.

Hint pass 1:
${JSON.stringify({
  symbol: extraction.symbol,
  direction: extraction.direction,
  entry_price: extraction.entry_price,
  entry_time: extraction.entry_time,
  sl_price: extraction.sl_price,
  tp_price: extraction.tp_price,
  timeframe_minutes: extraction.timeframe_minutes,
  exit_reason: extraction.exit_reason,
  trade_length_seconds: extraction.trade_length_seconds,
  candle_count: extraction.candle_count,
}, null, 2)}

Hint pass 2:
${JSON.stringify(verification, null, 2)}

Hint pass 3:
${JSON.stringify({
  symbol: humanReview.symbol,
  direction: humanReview.direction,
  entry_price: humanReview.entry_price,
  entry_time: humanReview.entry_time,
  sl_price: humanReview.sl_price,
  tp_price: humanReview.tp_price,
  timeframe_minutes: humanReview.timeframe_minutes,
  exit_reason: humanReview.exit_reason,
  trade_length_seconds: humanReview.trade_length_seconds,
  candle_count: humanReview.candle_count,
  first_touch_evidence: humanReview.first_touch_evidence,
}, null, 2)}

Return ONLY a raw JSON object with these exact keys:
symbol, direction, entry_price, entry_time, entry_time_confidence, sl_price, tp_price, timeframe_minutes, exit_reason, pnl_result, trade_length_seconds, candle_count, exit_confidence, first_touch_evidence`;

  return sanitizeExtractedTradeData(await callClaudeJson(
    decisivePrompt,
    images,
    `Trade date: ${entryDate}. ${buildEntryTimeHint(extraction.entry_time ?? humanReview.entry_time)} ${formatScannerContext(scannerContext)} Fallback time for the form is ${fallbackEntryTime}, but do not let that override the chart itself. Produce the single best final journal-ready trade analysis from this screenshot.`,
    1400
  ));
}

async function directExitRead(
  images: ChartImageInput[],
  trade: { direction: string; entry: number; sl: number; tp: number },
  entryDate: string
): Promise<{ exit_reason: 'TP' | 'SL' | null; confidence: 'high' | 'medium' | 'low'; evidence: string }> {
  const isShort = trade.direction === 'Short';
  const imageContent = images.map(img => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: img.mimeType as ImageMimeType, data: img.base64Image },
  }));
  const imageGuide = images.map((img, i) => `Image ${i + 1} (${img.label}): ${describeImageLabel(img.label)}`).join('\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0,
    system: `You are a precise chart reader. You look at a TradingView candlestick chart and determine whether a trade exited at Stop Loss or Take Profit. You answer decisively based only on what you can see. Return only valid JSON.`,
    messages: [{
      role: 'user',
      content: [
        ...imageContent,
        {
          type: 'text',
          text: `This is a ${trade.direction.toUpperCase()} trade on ${entryDate}.

PRICE LEVELS:
- Entry: ${trade.entry}
- Stop Loss: ${trade.sl} â€” this is ${isShort ? 'ABOVE' : 'BELOW'} entry (${isShort ? 'price must NOT rise above this' : 'price must NOT fall below this'})
- Take Profit: ${trade.tp} â€” this is ${isShort ? 'BELOW' : 'ABOVE'} entry (${isShort ? 'price drops to this target' : 'price rises to this target'})

TASK: Starting from the entry candle (at the LEFT edge of the coloured trade box), scan candles left-to-right.
- ONLY look at candles inside and immediately after the trade box. Do NOT look at candles far to the right that occur long after the trade.
- For a ${isShort ? 'SHORT' : 'LONG'} trade: if ${isShort ? 'the candle HIGH (wick tip) reaches or exceeds' : 'the candle LOW (wick bottom) reaches or drops below'} ${trade.sl} â†’ SL hit.
- For a ${isShort ? 'SHORT' : 'LONG'} trade: if ${isShort ? 'the candle LOW (wick bottom) reaches or drops below' : 'the candle HIGH (wick tip) reaches or exceeds'} ${trade.tp} â†’ TP hit.
- The FIRST level touched decides the result. Stop immediately at that candle.
- IGNORE any price labels or candles outside the trade box region and to the far right of the chart.

Return this JSON exactly:
{
  "exit_reason": "TP" or "SL",
  "confidence": "high" or "medium" or "low",
  "evidence": "one sentence describing which candle after entry touched which level first"
}

Attached views:
${imageGuide}`,
        },
      ],
    }],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();
  const parsed = parseJsonObject(text) as { exit_reason?: string; confidence?: string; evidence?: string };
  const exitReason = parsed.exit_reason === 'TP' ? 'TP' : parsed.exit_reason === 'SL' ? 'SL' : null;
  const confidence = (['high', 'medium', 'low'] as const).includes(parsed.confidence as 'high' | 'medium' | 'low')
    ? (parsed.confidence as 'high' | 'medium' | 'low')
    : 'low';
  return { exit_reason: exitReason, confidence, evidence: parsed.evidence ?? '' };
}

function resolveExitReason(
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  decisiveReview: ExtractedTradeData,
  extraction: ExtractedTradeData
): 'TP' | 'SL' | null {
  if (verification.exit_reason && humanReview.exit_reason === verification.exit_reason) {
    return verification.exit_reason;
  }

  if (verification.exit_reason && decisiveReview.exit_reason === verification.exit_reason) {
    return verification.exit_reason;
  }

  if (humanReview.exit_reason && decisiveReview.exit_reason === humanReview.exit_reason) {
    return humanReview.exit_reason;
  }

  return verification.exit_reason
    ?? humanReview.exit_reason
    ?? decisiveReview.exit_reason
    ?? extraction.exit_reason;
}

function buildManualReaderBase(
  extraction: ExtractedTradeData,
  humanReview: ExtractedTradeData,
  fallbackEntryTime: string
): ExtractedTradeData {
  const warnings = [
    ...(extraction.warnings ?? []),
    ...(humanReview.warnings ?? []),
  ];

  const humanStructureValid = hasValidLevelStructure(
    humanReview.direction,
    humanReview.entry_price,
    humanReview.sl_price,
    humanReview.tp_price
  );
  const extractionStructureValid = hasValidLevelStructure(
    extraction.direction,
    extraction.entry_price,
    extraction.sl_price,
    extraction.tp_price
  );

  const repairedStructure = repairTradeStructure(
    humanReview.direction ?? extraction.direction,
    chooseConsensusNumber(humanReview.entry_price, extraction.entry_price),
    chooseConsensusNumber(humanReview.sl_price, extraction.sl_price),
    chooseConsensusNumber(humanReview.tp_price, extraction.tp_price),
    {
      entries: [humanReview.entry_price, extraction.entry_price],
      stops: [humanReview.sl_price, extraction.sl_price],
      targets: [humanReview.tp_price, extraction.tp_price],
    }
  );

  const direction = humanStructureValid
    ? humanReview.direction
    : extractionStructureValid
      ? extraction.direction
      : repairedStructure.direction;
  const entryPrice = humanStructureValid
    ? humanReview.entry_price
    : extractionStructureValid
      ? extraction.entry_price
      : repairedStructure.entry_price;
  const stopPrice = humanStructureValid
    ? humanReview.sl_price
    : extractionStructureValid
      ? extraction.sl_price
      : repairedStructure.sl_price;
  const targetPrice = humanStructureValid
    ? humanReview.tp_price
    : extractionStructureValid
      ? extraction.tp_price
      : repairedStructure.tp_price;

  return {
    symbol: humanReview.symbol ?? extraction.symbol,
    direction,
    entry_price: entryPrice,
    entry_time: humanReview.entry_time ?? extraction.entry_time ?? parseNullableTime(fallbackEntryTime),
    entry_time_confidence: normalizeExitConfidence(humanReview.entry_time_confidence, extraction.entry_time_confidence, 'low'),
    sl_price: stopPrice,
    tp_price: targetPrice,
    trade_length_seconds: null,
    candle_count: null,
    timeframe_minutes: humanReview.timeframe_minutes ?? extraction.timeframe_minutes ?? 1,
    exit_reason: null,
    pnl_result: null,
    exit_confidence: null,
    first_touch_candle_index: null,
    first_touch_evidence: null,
    warnings,
  };
}

function finalizeManualReaderResult(
  baseRead: ExtractedTradeData,
  verification: ExitVerificationResult,
  extraction: ExtractedTradeData,
  humanReview: ExtractedTradeData
): ExtractedTradeData {
  const exitReason = verification.exit_reason
    ?? humanReview.exit_reason
    ?? extraction.exit_reason
    ?? null;

  return {
    ...baseRead,
    exit_reason: exitReason,
    pnl_result: exitReason === 'TP' ? 'Win' : exitReason === 'SL' ? 'Loss' : null,
    trade_length_seconds: verification.trade_length_seconds
      ?? humanReview.trade_length_seconds
      ?? extraction.trade_length_seconds
      ?? null,
    candle_count: verification.candle_count
      ?? humanReview.candle_count
      ?? extraction.candle_count
      ?? null,
    timeframe_minutes: verification.timeframe_minutes
      ?? baseRead.timeframe_minutes
      ?? null,
    exit_confidence: verification.exit_confidence
      ?? humanReview.exit_confidence
      ?? extraction.exit_confidence
      ?? 'low',
    first_touch_candle_index: verification.first_touch_candle_index
      ?? humanReview.first_touch_candle_index
      ?? extraction.first_touch_candle_index
      ?? null,
    first_touch_evidence: verification.first_touch_evidence
      ?? humanReview.first_touch_evidence
      ?? extraction.first_touch_evidence
      ?? null,
  };
}

function applySanityOverride(
  result: ExtractedTradeData,
  sanity: LevelTouchSanityResult | null
): ExtractedTradeData {
  if (!sanity) {
    return result;
  }

  const next = { ...result };

  if (sanity.target_touched === false && sanity.stop_touched === true) {
    next.exit_reason = 'SL';
  } else if (sanity.target_touched === true && sanity.stop_touched === false) {
    next.exit_reason = 'TP';
  } else if (sanity.first_touch) {
    next.exit_reason = sanity.first_touch;
  }

  if (next.exit_reason) {
    next.pnl_result = next.exit_reason === 'TP' ? 'Win' : 'Loss';
  }

  if (sanity.evidence) {
    next.first_touch_evidence = sanity.evidence;
  }

  return next;
}

function hasHighConfidenceExit(
  source: ExtractedTradeData | ExitVerificationResult,
  exitReason: 'TP' | 'SL'
): boolean {
  return source.exit_reason === exitReason && source.exit_confidence === 'high';
}

function applyConservativeExitDecision(
  result: ExtractedTradeData,
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  decisiveReview: ExtractedTradeData,
  extraction: ExtractedTradeData,
  sanity: LevelTouchSanityResult | null
): ExtractedTradeData {
  const next = { ...result };

  // Cross-check: if we have all three prices, the direction must produce a sane P&L sign
  if (next.entry_price != null && next.sl_price != null && next.tp_price != null) {
    const tpRisk    = next.tp_price - next.entry_price;
    const slRisk    = next.sl_price - next.entry_price;
    const looksLong  = tpRisk > 0 && slRisk < 0;
    const looksShort = tpRisk < 0 && slRisk > 0;

    if (looksLong && next.direction === 'Short') {
      next.direction = 'Long';
      appendWarning(
        next.warnings ?? (next.warnings = []),
        'Direction corrected to Long: price structure (TP above entry, SL below) contradicted Short.'
      );
    } else if (looksShort && next.direction === 'Long') {
      next.direction = 'Short';
      appendWarning(
        next.warnings ?? (next.warnings = []),
        'Direction corrected to Short: price structure (TP below entry, SL above) contradicted Long.'
      );
    }

    const entryIsValid = next.direction === 'Long'
      ? (next.sl_price < next.entry_price && next.tp_price > next.entry_price)
      : (next.sl_price > next.entry_price && next.tp_price < next.entry_price);

    if (!entryIsValid && next.sl_price != null && next.tp_price != null) {
      const swappedSlValid = next.direction === 'Long'
        ? (next.tp_price < next.entry_price && next.sl_price > next.entry_price)
        : (next.tp_price > next.entry_price && next.sl_price < next.entry_price);

      if (swappedSlValid) {
        [next.sl_price, next.tp_price] = [next.tp_price, next.sl_price];
        appendWarning(
          next.warnings ?? (next.warnings = []),
          'SL and TP were swapped â€” corrected based on direction and entry price.'
        );
      }
    }
  }

  const votes = countVotes(
    verification.exit_reason,
    humanReview.exit_reason,
    decisiveReview.exit_reason,
    extraction.exit_reason
  );
  const hasSanityConfirmation = Boolean(
    sanity && (sanity.first_touch || sanity.stop_touched !== null || sanity.target_touched !== null)
  );

  if (sanity?.stop_touched === true && sanity?.target_touched === false) {
    next.exit_reason = 'SL';
  } else if (sanity?.target_touched === true && sanity?.stop_touched === false) {
    next.exit_reason = 'TP';
  } else if (votes.SL >= 2 && votes.TP <= 1) {
    next.exit_reason = 'SL';
  } else if (votes.TP >= 2 && votes.SL === 0) {
    next.exit_reason = 'TP';
  } else if (
    next.exit_reason === 'TP' &&
    votes.SL >= 1 &&
    !hasHighConfidenceExit(verification, 'TP') &&
    !hasHighConfidenceExit(humanReview, 'TP') &&
    !hasHighConfidenceExit(decisiveReview, 'TP')
  ) {
    appendWarning(
      next.warnings ?? (next.warnings = []),
      'Exit-order signals disagreed â€” kept the primary extraction result.'
    );
  } else if (
    next.exit_reason === 'TP' &&
    votes.TP < 3 &&
    votes.SL >= 1 &&
    !hasSanityConfirmation
  ) {
    appendWarning(
      next.warnings ?? (next.warnings = []),
      'TP was not confirmed by the sanity pass â€” kept the primary extraction result.'
    );
  }

  if (next.exit_reason) {
    next.pnl_result = next.exit_reason === 'TP' ? 'Win' : 'Loss';
  }

  return next;
}

function buildConsensusTradeAnalysis(
  extraction: ExtractedTradeData,
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  decisiveReview: ExtractedTradeData,
  fallbackEntryTime: string
): ExtractedTradeData {
  const warnings = [
    ...(extraction.warnings ?? []),
    ...(humanReview.warnings ?? []),
    ...(decisiveReview.warnings ?? []),
  ];

  const resolvedStructure = repairTradeStructure(
    pickMostCommonString(decisiveReview.direction, humanReview.direction, extraction.direction),
    chooseConsensusNumber(decisiveReview.entry_price, humanReview.entry_price, extraction.entry_price),
    chooseConsensusNumber(decisiveReview.sl_price, humanReview.sl_price, extraction.sl_price),
    chooseConsensusNumber(decisiveReview.tp_price, humanReview.tp_price, extraction.tp_price),
    {
      entries: [decisiveReview.entry_price, humanReview.entry_price, extraction.entry_price],
      stops: [decisiveReview.sl_price, humanReview.sl_price, extraction.sl_price],
      targets: [decisiveReview.tp_price, humanReview.tp_price, extraction.tp_price],
    }
  );

  const result: ExtractedTradeData = {
    symbol: decisiveReview.symbol
      ?? pickMostCommonString(humanReview.symbol, extraction.symbol)
      ?? pickFirstNonNull(humanReview.symbol, extraction.symbol),
    direction: resolvedStructure.direction,
    entry_price: resolvedStructure.entry_price,
    entry_time: pickFirstNonNull(decisiveReview.entry_time, humanReview.entry_time, extraction.entry_time, parseNullableTime(fallbackEntryTime)),
    entry_time_confidence: normalizeExitConfidence(decisiveReview.entry_time_confidence, humanReview.entry_time_confidence, extraction.entry_time_confidence, 'low'),
    sl_price: resolvedStructure.sl_price,
    tp_price: resolvedStructure.tp_price,
    trade_length_seconds: null,
    candle_count: null,
    timeframe_minutes: decisiveReview.timeframe_minutes
      ?? chooseConsensusNumber(humanReview.timeframe_minutes, verification.timeframe_minutes, extraction.timeframe_minutes),
    exit_reason: null,
    pnl_result: null,
    exit_confidence: null,
    first_touch_candle_index: null,
    first_touch_evidence: null,
    warnings,
  };

  if (!hasValidLevelStructure(result.direction, result.entry_price, result.sl_price, result.tp_price)) {
    result.direction = inferDirectionFromLevels(result.entry_price, result.sl_price, result.tp_price);
  }

  const votes = countVotes(decisiveReview.exit_reason, extraction.exit_reason, verification.exit_reason, humanReview.exit_reason);
  result.exit_reason = resolveExitReason(verification, humanReview, decisiveReview, extraction);

  const durationSource = [
    verification.exit_reason === result.exit_reason ? verification : null,
    humanReview.exit_reason === result.exit_reason ? humanReview : null,
    decisiveReview.exit_reason === result.exit_reason ? decisiveReview : null,
    extraction.exit_reason === result.exit_reason ? extraction : null,
  ].find(Boolean) as (ExtractedTradeData | ExitVerificationResult | null);

  result.trade_length_seconds = chooseConsensusNumber(
    durationSource?.trade_length_seconds,
    verification.trade_length_seconds,
    humanReview.trade_length_seconds,
    decisiveReview.trade_length_seconds,
    extraction.trade_length_seconds
  );
  result.candle_count = chooseConsensusNumber(
    durationSource?.candle_count,
    verification.candle_count,
    humanReview.candle_count,
    decisiveReview.candle_count,
    extraction.candle_count
  );
  result.timeframe_minutes = result.timeframe_minutes ?? durationSource?.timeframe_minutes ?? null;
  result.pnl_result = result.exit_reason === 'TP' ? 'Win' : result.exit_reason === 'SL' ? 'Loss' : null;
  result.exit_confidence = verification.exit_confidence
    ?? humanReview.exit_confidence
    ?? decisiveReview.exit_confidence
    ?? (votes.TP === 3 || votes.SL === 3
    ? 'high'
    : votes.TP >= 2 || votes.SL >= 2
      ? 'medium'
      : normalizeExitConfidence(extraction.exit_confidence, 'low'));
  result.first_touch_candle_index = pickFirstNonNull(verification.first_touch_candle_index, humanReview.first_touch_candle_index, result.candle_count);
  result.first_touch_evidence = pickFirstNonNull(verification.first_touch_evidence, humanReview.first_touch_evidence, decisiveReview.first_touch_evidence, extraction.first_touch_evidence);

  if (result.trade_length_seconds === null && result.candle_count !== null && result.timeframe_minutes !== null) {
    result.trade_length_seconds = result.candle_count * result.timeframe_minutes * 60;
  }

  if (result.entry_time === null) {
    result.entry_time = parseNullableTime(fallbackEntryTime);
    result.entry_time_confidence = 'low';
  }

  return result;
}

async function upscaleLabelCrops(
  images: ChartImageInput[]
): Promise<ChartImageInput[]> {
  const LABEL_CROP_NAMES = new Set(['entry-label-focus', 'stop-label-focus', 'target-label-focus']);

  return Promise.all(images.map(async (img) => {
    if (!LABEL_CROP_NAMES.has(img.label)) return img;
    try {
      const buffer = Buffer.from(img.base64Image, 'base64');
      const metadata = await sharp(buffer).metadata();
      const upscaledBuffer = await sharp(buffer)
        .resize(
          Math.round((metadata.width ?? 100) * 2),
          Math.round((metadata.height ?? 100) * 2),
          { kernel: 'nearest' }
        )
        .png()
        .toBuffer();
      return {
        ...img,
        base64Image: upscaledBuffer.toString('base64'),
        mimeType: 'image/png' as ImageMimeType,
      };
    } catch {
      return img;
    }
  }));
}

async function cropImageToBoxBoundary(
  images: ChartImageInput[],
  scannerContext?: ScannerContext
): Promise<ChartImageInput[]> {
  if (!scannerContext?.box_right_ratio) return images;
  return Promise.all(images.map(async (img) => {
    const buffer = Buffer.from(img.base64Image, 'base64');
    const metadata = await sharp(buffer).metadata();
    const cropWidth = Math.round((metadata.width ?? 0) * scannerContext.box_right_ratio!);
    const cropped = await sharp(buffer)
      .extract({ left: 0, top: 0, width: cropWidth, height: metadata.height ?? 0 })
      .png()
      .toBuffer();
    return { ...img, base64Image: cropped.toString('base64'), mimeType: 'image/png' as ImageMimeType };
  }));
}

export async function analyzeChartImage(
  base64Image: string,
  mimeType: string,
  entryDate: string,
  entryTime: string,
  focusImages: Array<{ base64Image: string; mimeType: string; label: string }> = [],
  scannerContext?: Record<string, unknown>
): Promise<ExtractedTradeData> {
  const safeMimeType: ImageMimeType = VALID_MIME_TYPES.includes(mimeType as ImageMimeType)
    ? (mimeType as ImageMimeType)
    : 'image/jpeg';
  const analysisImages: ChartImageInput[] = [
    { base64Image, mimeType: safeMimeType, label: 'full_chart' },
    ...focusImages.map((image, index) => ({
      base64Image: image.base64Image,
      mimeType: VALID_MIME_TYPES.includes(image.mimeType as ImageMimeType)
        ? (image.mimeType as ImageMimeType)
        : 'image/jpeg',
      label: image.label || `focus_${index + 1}`,
    })),
  ];
  const normalizedScannerContext = scannerContext as ScannerContext | undefined;
  const decodedFullImage = decodePngImage(base64Image);
  const deterministicExit = detectDeterministicExitFromDecodedImage(
    decodedFullImage,
    normalizedScannerContext
  );
  const identityImages = selectImagesByLabels(analysisImages, [
    'header-focus',
    'full_chart',
  ]);
  const exactPriceImages = selectImagesByLabels(analysisImages, [
    'trade-box-focus',
    'price-label-focus',
    'entry-label-focus',
    'stop-label-focus',
    'target-label-focus',
  ]);
  const extractionImages = selectImagesByLabels(analysisImages, [
    'header-focus',
    'trade-box-focus',
    'entry-window-focus',
    'exit-path-focus',
    'price-label-focus',
    'entry-label-focus',
    'stop-label-focus',
    'target-label-focus',
  ]);
  const verificationImages = selectImagesByLabels(analysisImages, [
    'full_chart',
    'exit-path-focus',
    'trade-box-focus',
    'price-label-focus',
    'entry-label-focus',
    'stop-label-focus',
    'target-label-focus',
    'header-focus',
  ]);
  const sanityImages = selectImagesByLabels(analysisImages, [
    'full_chart',
    'trade-box-focus',
    'exit-path-focus',
  ]);
  const directExitImages = selectImagesByLabels(analysisImages, [
    'exit-path-focus',
    'trade-box-focus',
    'entry-window-focus',
  ]);
  const [
    croppedVerificationImages,
    croppedSanityImages,
    croppedDirectExitImages,
  ] = await Promise.all([
    cropImageToBoxBoundary(verificationImages, normalizedScannerContext),
    cropImageToBoxBoundary(sanityImages, normalizedScannerContext),
    cropImageToBoxBoundary(directExitImages, normalizedScannerContext),
  ]);
  const preAnalysisWarnings: string[] = [];
  const upscaledPriceImages = await upscaleLabelCrops(exactPriceImages);
  const [
    headerIdentityResult,
    exactPriceResult,
    extractionResult,
    humanReviewResult,
  ] = await Promise.allSettled([
    extractHeaderIdentity(identityImages),
    extractExactPriceLevels(upscaledPriceImages, normalizedScannerContext),
    extractTradeFacts(extractionImages, entryDate, entryTime, normalizedScannerContext),
    humanStyleReview(extractionImages, entryDate, entryTime, normalizedScannerContext),
  ]);

  const headerIdentityRead = headerIdentityResult.status === 'fulfilled'
    ? headerIdentityResult.value
    : null;
  if (headerIdentityResult.status === 'rejected') {
    preAnalysisWarnings.push('Header symbol/timeframe read failed, so identity relied on the broader chart reads.');
  }

  const exactPriceRead = exactPriceResult.status === 'fulfilled'
    ? exactPriceResult.value
    : null;
  if (exactPriceResult.status === 'rejected') {
    preAnalysisWarnings.push('Exact price-label review failed, so price levels relied on the broader chart reads.');
  }

  // Run digit verification pass on the exact price read
  if (exactPriceRead && (exactPriceRead.entry_price || exactPriceRead.sl_price || exactPriceRead.tp_price)) {
    try {
      const verified = await verifyPriceDigits(
        upscaledPriceImages,
        {
          entry_price: exactPriceRead.entry_price,
          sl_price:    exactPriceRead.sl_price,
          tp_price:    exactPriceRead.tp_price,
          direction:   exactPriceRead.direction,
        },
        normalizedScannerContext
      );
      if (verified.entry_price != null) exactPriceRead.entry_price = verified.entry_price;
      if (verified.sl_price    != null) exactPriceRead.sl_price    = verified.sl_price;
      if (verified.tp_price    != null) exactPriceRead.tp_price    = verified.tp_price;
      if (verified.changed) {
        appendWarning(preAnalysisWarnings, 'Digit verification corrected one or more price values.');
      }
    } catch {
      // Verification failed silently â€” use original exactPriceRead values
    }
  }

  if (extractionResult.status === 'rejected' && humanReviewResult.status === 'rejected') {
    console.error('extractionResult error:', extractionResult.reason);
    console.error('humanReviewResult error:', humanReviewResult.reason);
    throw new Error('Chart analysis failed for both the primary and fallback Claude passes.');
  }

  const extractionSource = extractionResult.status === 'fulfilled'
    ? extractionResult.value
    : (humanReviewResult as PromiseFulfilledResult<ExtractedTradeData>).value;
  const humanReviewSource = humanReviewResult.status === 'fulfilled'
    ? humanReviewResult.value
    : (extractionResult as PromiseFulfilledResult<ExtractedTradeData>).value;

  if (extractionResult.status === 'rejected') {
    preAnalysisWarnings.push('Primary chart extraction failed, so the scanner fell back to the human-style review pass.');
  }

  if (humanReviewResult.status === 'rejected') {
    preAnalysisWarnings.push('Human-style review failed, so the scanner relied on the primary extraction pass.');
  }

  const extraction = applyHeaderIdentityRead(
    applyExactPriceRead(
      extractionSource,
      exactPriceRead
    ),
    headerIdentityRead
  );
  const rawHumanReview = applyHeaderIdentityRead(
    applyExactPriceRead(
      humanReviewSource,
      exactPriceRead
    ),
    headerIdentityRead
  );
  const baseRead = buildManualReaderBase(extraction, rawHumanReview, entryTime);



  // If scanner context has a confirmed direction but prices are inverted, swap sl/tp to match.
  if (
    normalizedScannerContext?.direction_hint &&
    baseRead.direction !== normalizedScannerContext.direction_hint &&
    baseRead.entry_price !== null &&
    baseRead.sl_price !== null &&
    baseRead.tp_price !== null
  ) {
    const hint = normalizedScannerContext.direction_hint;
    const slAboveEntry = baseRead.sl_price > baseRead.entry_price;
    const tpBelowEntry = baseRead.tp_price < baseRead.entry_price;
    if (hint === 'Short' && !slAboveEntry && !tpBelowEntry) {
      // Claude swapped sl and tp for this Short trade â€” correct it
      [baseRead.sl_price, baseRead.tp_price] = [baseRead.tp_price, baseRead.sl_price];
      baseRead.direction = 'Short';
      appendWarning(baseRead.warnings ?? (baseRead.warnings = []), 'Direction corrected to Short based on pixel scan â€” sl/tp were swapped.');
    } else if (hint === 'Long' && slAboveEntry && !tpBelowEntry) {
      [baseRead.sl_price, baseRead.tp_price] = [baseRead.tp_price, baseRead.sl_price];
      baseRead.direction = 'Long';
      appendWarning(baseRead.warnings ?? (baseRead.warnings = []), 'Direction corrected to Long based on pixel scan â€” sl/tp were swapped.');
    }
  }

  preAnalysisWarnings.forEach(warning => appendWarning(baseRead.warnings ?? (baseRead.warnings = []), warning));

  let verification: ExitVerificationResult = {
    exit_reason: baseRead.exit_reason,
    trade_length_seconds: baseRead.trade_length_seconds,
    candle_count: baseRead.candle_count,
    timeframe_minutes: baseRead.timeframe_minutes,
    exit_confidence: baseRead.exit_confidence,
    first_touch_candle_index: baseRead.first_touch_candle_index,
    first_touch_evidence: baseRead.first_touch_evidence,
  };

  // Run exit verification first
  const verificationResult = await (async () => {
    try {
      return await verifyExitOrder(
        croppedVerificationImages,
        entryDate,
        baseRead,
        normalizedScannerContext
      );
    } catch {
      appendWarning(
        baseRead.warnings ?? (baseRead.warnings = []),
        'Exit verification failed â€” relying on manual chart read.'
      );
      return null;
    }
  })();

  if (verificationResult) {
    verification = verificationResult;
  }

  // Run sanity check after, seeding it with verification's exit_reason
  const sanityResult = await (async () => {
    try {
      return await sanityCheckLevelTouches(
        croppedSanityImages,
        entryDate,
        {
          ...baseRead,
          exit_reason: verificationResult?.exit_reason ?? baseRead.exit_reason,
        }
      );
    } catch {
      appendWarning(
        baseRead.warnings ?? (baseRead.warnings = []),
        'Sanity check failed â€” relying on exit verification result.'
      );
      return null;
    }
  })();

  let sanityCheck: LevelTouchSanityResult | null = sanityResult;

  let decisiveReview = rawHumanReview;
  try {
    decisiveReview = applyHeaderIdentityRead(
      applyExactPriceRead(
        await decisiveFinalReview(
          extractionImages,
          entryDate,
          entryTime,
          extraction,
          verification,
          rawHumanReview,
          normalizedScannerContext
        ),
        exactPriceRead
      ),
      headerIdentityRead
    );
  } catch {
    appendWarning(baseRead.warnings ?? (baseRead.warnings = []), 'Final consensus review failed, so the result relied on the primary extraction passes.');
  }

  const consensus = applyHeaderIdentityRead(
    applyExactPriceRead(
      buildConsensusTradeAnalysis(
        extraction,
        verification,
        rawHumanReview,
        decisiveReview,
        entryTime
      ),
      exactPriceRead
    ),
    headerIdentityRead
  );
  const fallbackResult = applyHeaderIdentityRead(
    applyExactPriceRead(
      finalizeManualReaderResult(baseRead, verification, extraction, rawHumanReview),
      exactPriceRead
    ),
    headerIdentityRead
  );
  const structureSafeResult = hasValidLevelStructure(consensus.direction, consensus.entry_price, consensus.sl_price, consensus.tp_price)
    ? consensus
    : fallbackResult;
  const finalResult = applyConservativeExitDecision(
    applySanityOverride(structureSafeResult, sanityCheck),
    verification,
    rawHumanReview,
    decisiveReview,
    extraction,
    sanityCheck
  );

  // Direct single-shot exit read â€” final authority over all voting passes
  const directExit = finalResult.entry_price != null && finalResult.sl_price != null && finalResult.tp_price != null
    ? await (async () => {
        try {
          return await directExitRead(
            croppedDirectExitImages,
            {
              direction: finalResult.direction ?? 'Long',
              entry: finalResult.entry_price!,
              sl: finalResult.sl_price!,
              tp: finalResult.tp_price!,
            },
            entryDate
          );
        } catch {
          return null;
        }
      })()
    : null;

  if (directExit?.exit_reason) {
    finalResult.exit_reason = directExit.exit_reason;
    finalResult.pnl_result = directExit.exit_reason === 'TP' ? 'Win' : 'Loss';
    finalResult.exit_confidence = directExit.confidence;
    finalResult.first_touch_evidence = directExit.evidence || finalResult.first_touch_evidence;
  } else if (deterministicExit?.exit_reason) {
    finalResult.exit_reason = deterministicExit.exit_reason;
    finalResult.pnl_result = deterministicExit.exit_reason === 'TP' ? 'Win' : 'Loss';
    finalResult.exit_confidence = 'high';
    finalResult.first_touch_evidence = deterministicExit.evidence ?? finalResult.first_touch_evidence;
  }

  finalResult.warnings = [
    ...(finalResult.warnings ?? []),
    ...(baseRead.warnings ?? []),
  ];

  return finalResult;
}

export async function analyzeIndividualTrade(trade: Trade): Promise<string> {
  const rr = trade.sl_price && trade.entry_price && trade.tp_price
    ? Math.abs(trade.tp_price - trade.entry_price) / Math.abs(trade.sl_price - trade.entry_price)
    : 0;

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 2048,
    system: `You are a brutally honest professional futures trading coach with 20+ years of experience.
Your job is to give traders raw, unfiltered feedback on their trades. Do not sugarcoat.
Be direct, insightful, and constructive. Focus on what they did right, what they did wrong,
and exactly what they need to improve. Use specific numbers from the trade.`,
    messages: [
      {
        role: 'user',
        content: `Analyse this trade in detail:

Symbol: ${trade.symbol}
Direction: ${trade.direction}
Date: ${trade.trade_date} at ${trade.trade_time}
Session: ${trade.session}
Entry: ${trade.entry_price}
Stop Loss: ${trade.sl_price}
Take Profit: ${trade.tp_price}
Exit Price: ${trade.exit_price}
Exit Reason: ${trade.exit_reason}
Contracts: ${trade.contract_size}
Point Value: $${trade.point_value}
P&L: $${trade.pnl.toFixed(2)}
R:R Ratio: ${rr.toFixed(2)}
Trade Duration: ${trade.trade_length_seconds ? Math.round(trade.trade_length_seconds / 60) + ' minutes' : 'unknown'}
Emotional State: ${trade.emotional_state}
Confidence Level: ${trade.confidence_level}/10
Followed Plan: ${trade.followed_plan ? 'Yes' : 'No'}
Confluences: ${Array.isArray(trade.confluences) && trade.confluences.length > 0 ? trade.confluences.join(', ') : 'None tagged'}
Pre-trade Notes: ${trade.pre_trade_notes || 'None'}
Post-trade Notes: ${trade.post_trade_notes || 'None'}

Provide a brutally honest breakdown covering:
1. Trade quality assessment
2. Risk management evaluation
3. Execution analysis
4. Psychology and emotional factors
5. What was done well (if anything)
6. Key mistakes and how to fix them
7. Specific actionable improvements for next time`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function analyzePatterns(trades: Trade[]): Promise<string> {
  const tradeSummaries = trades.map(t => ({
    symbol: t.symbol,
    direction: t.direction,
    date: t.trade_date,
    time: t.trade_time,
    session: t.session,
    pnl: t.pnl,
    exit_reason: t.exit_reason,
    emotional_state: t.emotional_state,
    confidence: t.confidence_level,
    followed_plan: t.followed_plan,
    confluences: Array.isArray(t.confluences) ? t.confluences : [],
    rr: t.sl_price && t.entry_price && t.tp_price
      ? (Math.abs(t.tp_price - t.entry_price) / Math.abs(t.sl_price - t.entry_price)).toFixed(2)
      : 'N/A',
  }));

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 3000,
    system: `You are a professional trading performance analyst specialising in pattern recognition and behavioral finance.
Analyse trading data to find actionable patterns, both profitable and detrimental.
Be specific with numbers and percentages. Identify root causes of problems.`,
    messages: [
      {
        role: 'user',
        content: `Analyse these ${trades.length} futures trades and identify all significant patterns:

${JSON.stringify(tradeSummaries, null, 2)}

Provide a comprehensive pattern analysis covering:
1. Best performing setups (time, session, symbol, direction)
2. Worst performing patterns and why
3. Emotional state impact on performance
4. Plan adherence correlation with results
5. Risk management patterns
6. Time-of-day and session edge analysis
7. Confidence calibration (do high confidence trades perform better?)
8. Confluence performance (which tagged confluences are most profitable vs most costly)
9. Most critical behavioural improvements needed
10. Top 3 strengths to capitalise on
11. Top 3 weaknesses that are costing the most money`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function generateWeeklyReport(
  trades: Trade[],
  weekStart: string,
  weekEnd: string
): Promise<string> {
  const wins = trades.filter(t => t.exit_reason === 'TP');
  const losses = trades.filter(t => t.exit_reason === 'SL');
  const netPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length * 100).toFixed(1) : '0';
  const confluenceBuckets = trades.reduce<Record<string, { count: number; pnl: number }>>((acc, trade) => {
    const tags = Array.isArray(trade.confluences) ? trade.confluences : [];
    tags.forEach(tag => {
      if (typeof tag !== 'string' || !tag.trim()) return;
      const key = tag.trim().toLowerCase();
      if (!acc[key]) {
        acc[key] = { count: 0, pnl: 0 };
      }
      acc[key].count += 1;
      acc[key].pnl += trade.pnl;
    });
    return acc;
  }, {});

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 3000,
    system: `You are a professional trading performance coach generating weekly review reports.
Create comprehensive, structured reports that help traders improve systematically.
Be specific, actionable, and data-driven. Format your response with clear sections using markdown.`,
    messages: [
      {
        role: 'user',
        content: `Generate a comprehensive weekly performance report for the week of ${weekStart} to ${weekEnd}.

Summary Statistics:
- Total Trades: ${trades.length}
- Wins: ${wins.length} | Losses: ${losses.length}
- Win Rate: ${winRate}%
- Net P&L: $${netPnL.toFixed(2)}

Confluence Breakdown:
${JSON.stringify(
  Object.entries(confluenceBuckets)
    .map(([confluence, data]) => ({ confluence, trades: data.count, net_pnl: data.pnl }))
    .sort((a, b) => b.net_pnl - a.net_pnl),
  null,
  2
)}

Individual Trades:
${JSON.stringify(trades.map(t => ({
  date: t.trade_date,
  time: t.trade_time,
  symbol: t.symbol,
  direction: t.direction,
  session: t.session,
  pnl: t.pnl,
  exit_reason: t.exit_reason,
  emotional_state: t.emotional_state,
  confidence: t.confidence_level,
  followed_plan: t.followed_plan,
  confluences: Array.isArray(t.confluences) ? t.confluences : [],
})), null, 2)}

Create a report with these sections:
# Weekly Performance Report: ${weekStart} to ${weekEnd}

## Executive Summary
## Performance Statistics
## Best Trades of the Week
## Worst Trades and Lessons
## Psychological Performance
## Plan Adherence Analysis
## Key Patterns Observed
## Confluence Performance (best vs worst tagged confluences)
## Goals for Next Week
## Action Items (specific, numbered list)`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function generatePsychologyReport(
  trades: Trade[],
  psychLogs: Array<{
    date: string;
    mood: string;
    mindset_score: number;
    pre_session_notes: string;
    post_session_notes: string;
  }>
): Promise<string> {
  const emotionalBreakdown = trades.reduce<Record<string, { count: number; pnl: number }>>((acc, t) => {
    const state = t.emotional_state || 'Unknown';
    if (!acc[state]) acc[state] = { count: 0, pnl: 0 };
    acc[state].count++;
    acc[state].pnl += t.pnl;
    return acc;
  }, {});

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 3000,
    system: `You are a trading psychologist specialising in performance psychology and behavioral finance.
Provide deep, insightful analysis of a trader's psychological patterns.
Be empathetic but brutally honest about destructive patterns.
Give concrete, practical psychological techniques to improve performance.`,
    messages: [
      {
        role: 'user',
        content: `Perform a deep psychology analysis for this futures trader.

Emotional State vs Performance:
${JSON.stringify(emotionalBreakdown, null, 2)}

Plan Adherence: ${trades.filter(t => t.followed_plan).length}/${trades.length} trades followed the plan

Psychology Logs (recent):
${JSON.stringify(psychLogs.slice(-14), null, 2)}

Trades Not Following Plan:
${JSON.stringify(trades.filter(t => !t.followed_plan).map(t => ({
  date: t.trade_date,
  emotional_state: t.emotional_state,
  pnl: t.pnl,
  notes: t.post_trade_notes,
})), null, 2)}

Provide a comprehensive psychology report:
# Trading Psychology Report

## Emotional State Analysis
## Behavioral Patterns
## Tilt and Revenge Trading Assessment
## FOMO and Overconfidence Patterns
## Discipline and Plan Adherence
## Mindset Score Trends
## Root Cause Analysis
## Recommended Psychological Strategies
## Daily Routine Recommendations
## Affirmations and Mental Framework`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function compareTradeToPlaybook(
  trade: Trade,
  playbookEntries: Array<{
    setup_name: string;
    description: string;
    rules: string;
    ideal_conditions: string;
  }>
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 2048,
    system: `You are a trading coach that specialises in evaluating whether trades adhere to established trading playbooks and rules.
Be specific about which rules were followed and which were violated.
Provide a structured compliance assessment.`,
    messages: [
      {
        role: 'user',
        content: `Evaluate this trade against the trading playbook.

Trade Details:
${JSON.stringify({
  symbol: trade.symbol,
  direction: trade.direction,
  date: trade.trade_date,
  time: trade.trade_time,
  session: trade.session,
  entry_price: trade.entry_price,
  sl_price: trade.sl_price,
  tp_price: trade.tp_price,
  exit_reason: trade.exit_reason,
  pnl: trade.pnl,
  emotional_state: trade.emotional_state,
  confidence_level: trade.confidence_level,
  followed_plan: trade.followed_plan,
  confluences: Array.isArray(trade.confluences) ? trade.confluences : [],
  pre_trade_notes: trade.pre_trade_notes,
  post_trade_notes: trade.post_trade_notes,
}, null, 2)}

Playbook Entries:
${JSON.stringify(playbookEntries, null, 2)}

Provide a detailed compliance assessment:
# Playbook Compliance Report

## Best Matching Setup
## Rules Followed
## Rules Violated
## Ideal Conditions Match
## Compliance Score (0-100%)
## Specific Violations and Impact
## How to Better Execute This Setup Next Time`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function answerFlyxaQuestion(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    throw new Error('Question is required');
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 700,
    system: `You are Flyxa's built-in product assistant.

Flyxa is a futures trading journal and review workspace. Key areas include:
- Trade journaling and daily reflections
- Dashboard analytics and performance review
- AI Coach analysis
- Risk Manager and daily risk controls
- Trade Scanner and chart import workflows
- Backtesting / replay
- Playbook and psychology tracking

Rules:
- Answer questions about Flyxa clearly and helpfully.
- Be concise, practical, and product-focused.
- If the user asks how to do something in Flyxa, give direct steps.
- If the user asks about account-specific data, explain you cannot see their private data from the chat widget.
- If the question is unrelated to Flyxa, gently steer back to Flyxa and what the product does.
- Do not invent features that Flyxa does not clearly have.
- Keep responses in plain text, usually 2-6 short sentences.`,
    messages: [
      ...history
        .filter(message => message.content.trim() !== '')
        .slice(-8)
        .map(message => ({
          role: message.role,
          content: message.content,
        })),
      {
        role: 'user',
        content: trimmedQuestion,
      },
    ],
  });

  const textBlocks = response.content.filter(block => block.type === 'text');
  const combined = textBlocks.map(block => block.text.trim()).filter(Boolean).join('\n\n');

  if (!combined) {
    throw new Error('Unexpected response type from Claude');
  }

  return combined;
}

export async function analyzeChartAnalyzerImage(
  base64Image: string,
  mimeType: string,
  contractSize: number
): Promise<Array<{
  symbol?: string;
  direction?: 'Long' | 'Short' | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rr_ratio: string | null;
  outcome: 'WIN' | 'LOSS' | null;
  trade_duration: string | null;
  net_pnl: number | null;
}>> {
  const supportedMimeType = VALID_MIME_TYPES.includes(mimeType as ImageMimeType)
    ? (mimeType as ImageMimeType)
    : 'image/jpeg';

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 2048,
    system: `You are a trading chart P&L analyst. When given a TradingView screenshot, follow these steps precisely:

STEP 1 - READ SYMBOL & TIMEFRAME: Read the ticker symbol and timeframe from the top-left of the chart label (e.g. "NQM26, 1" means NQM26 on the 1-minute chart).

STEP 2 - IDENTIFY THE P&L BOX AND ITS THREE LEVELS:
The P&L box is a semi-transparent overlay of two colored zones:
- TEAL (mint/cyan green) zone = profit target area
- PINK (light red/rose) zone = stop loss risk area

Read the three price levels:
- ENTRY PRICE: The GREY label on the right axis at the boundary between the two zones.
- STOP LOSS: The RED label on the right axis at the far edge of the pink zone.
- TAKE PROFIT - HOW TO FIND IT:
  a. Locate the FAR EDGE of the teal zone (top edge for Long, bottom edge for Short).
  b. Trace that edge horizontally to the right-axis scale to read the price.
  c. It often aligns with a horizontal line drawn on the chart.
  d. Use a small teal/green label at that exact edge if one is visible.
  e. NEVER use the live current-price label as the TP. TradingView always shows a floating green label at the very latest market price - it is far outside the P&L box and is unrelated to the trade target. If a "green" label price is well above the teal box (for Long) or well below the teal box (for Short), it is the live price - ignore it completely.

STEP 3 - DETERMINE DIRECTION FROM BOX COLORS:
- LONG: Teal zone is ABOVE entry, pink zone is BELOW entry -> your TP price must be greater than entry.
- SHORT: Pink zone is ABOVE entry, teal zone is BELOW entry -> your TP price must be less than entry.
If your identified TP is outside the visible teal box boundary, you have read the wrong label - go back to step 2e.

STEP 4 - ENTRY TIME: Draw an imaginary vertical line down from the left edge of the P&L box to the x-axis. Record this as the entry time.

STEP 5 - CALCULATE RISK & REWARD:
- TP distance = |Take Profit - Entry Price| (in points)
- SL distance = |Stop Loss - Entry Price| (in points)
- R:R Ratio = TP distance / SL distance, expressed as "X:1" (e.g. if TP distance = 73.5 pts and SL distance = 39.25 pts -> R:R = "1.87:1"; if TP = 39.25 and SL = 73.5 -> R:R = "0.53:1")

STEP 6 - OUTCOME (FIRST TOUCH RULE):
Starting from the entry candle (the candle aligned with the left edge of the P&L box), scan candles forward one at a time. Stop the moment either level is first touched:
- A candle WICK touching a level counts as a hit - a body close is NOT required.
- If the stop loss level is touched first -> outcome is LOSS.
- If the take profit level is touched first -> outcome is WIN.
- If both are touched in the same candle, use visual judgment to determine which was more likely hit first.
Do not look past the first touch - ignore any later reversals.

STEP 7 - TRADE LENGTH: Count candles from the entry candle to the exit candle (inclusive). Multiply by the chart timeframe in minutes to get total trade duration (e.g. 15 candles x 1 min = 15 minutes).

STEP 8 - NET P&L:
Points at stake:
- WIN: TP distance (positive)
- LOSS: SL distance (negative)
The frontend will calculate final dollar P&L using the contract's point value. Return net_pnl as the raw points value (positive for WIN, negative for LOSS) so the frontend can apply the correct multiplier.`,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: supportedMimeType, data: base64Image },
          },
          {
            type: 'text',
            text: `Analyze this trading chart screenshot. Contract size is ${contractSize}.

If there are multiple charts in the image (e.g. NQ and ES side by side), analyze each one separately.

Return ONLY a valid JSON array with no markdown, no explanation, no code fences - just the raw JSON array. Each element represents one chart/trade with these exact keys:
[
  {
    "symbol": "full ticker as shown top-left e.g. NQM26 or MNQ or ES",
    "direction": "Long" or "Short" or null,
    "entry_price": number or null,
    "stop_loss": number or null,
    "take_profit": number or null,
    "rr_ratio": "X:1 format e.g. 1.87:1 or 0.53:1" or null,
    "outcome": "WIN" or "LOSS" or null,
    "trade_duration": "string e.g. 15 minutes" or null,
    "net_pnl": raw points value as a number (positive for WIN, negative for LOSS) or null
  }
]`,
          },
        ],
      },
    ],
  });

  const textBlocks = response.content.filter(block => block.type === 'text');
  const text = textBlocks.map(block => block.text).join('\n').trim();

  if (!text) {
    throw new Error('Could not parse response from Claude. Please try again.');
  }

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Could not parse response from Claude. Please try again.');
  }

  const parsed = JSON.parse(jsonMatch[0]) as Array<{
    symbol?: string;
    direction?: 'Long' | 'Short' | null;
    entry_price: number | null;
    stop_loss: number | null;
    take_profit: number | null;
    rr_ratio: string | null;
    outcome: 'WIN' | 'LOSS' | null;
    trade_duration: string | null;
    net_pnl: number | null;
  }>;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('No trade data found in the response.');
  }

  return parsed;
}
```


---
## FILE: backend/src/types/index.ts
```ts
import { Request } from 'express';

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  screenshot_url?: string;
  account_id?: string;
  direction: 'Long' | 'Short';
  entry_price: number;
  exit_price: number;
  sl_price: number;
  tp_price: number;
  exit_reason: 'TP' | 'SL' | 'BE';
  pnl: number;
  contract_size: number;
  point_value: number;
  trade_date: string;
  trade_time: string;
  trade_length_seconds: number;
  candle_count: number;
  timeframe_minutes: number;
  emotional_state: 'Calm' | 'Confident' | 'Anxious' | 'Revenge Trading' | 'FOMO' | 'Overconfident' | 'Tired';
  confidence_level: number;
  pre_trade_notes: string;
  post_trade_notes: string;
  confluences?: string[];
  followed_plan: boolean;
  session: 'Asia' | 'London' | 'New York' | 'Other';
  created_at: string;
}

export interface PsychologyLog {
  id: string;
  user_id: string;
  date: string;
  mood: string;
  pre_session_notes: string;
  post_session_notes: string;
  mindset_score: number;
  created_at: string;
}

export interface PlaybookEntry {
  id: string;
  user_id: string;
  setup_name: string;
  description: string;
  rules: string;
  ideal_conditions: string;
  screenshot_url: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  content: string;
  screenshots: string[];
  created_at: string;
}

export interface RiskSettings {
  id: string;
  user_id: string;
  daily_loss_limit: number;
  max_trades_per_day: number;
  max_contracts_per_trade: number;
  account_size: number;
  risk_percentage: number;
  updated_at: string;
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export interface ExtractedTradeData {
  symbol: string | null;
  direction: 'Long' | 'Short' | null;
  entry_price: number | null;
  entry_time: string | null;
  entry_time_confidence: 'high' | 'medium' | 'low' | null;
  sl_price: number | null;
  tp_price: number | null;
  trade_length_seconds: number | null;
  candle_count: number | null;
  timeframe_minutes: number | null;
  exit_reason: 'TP' | 'SL' | null;
  pnl_result: 'Win' | 'Loss' | null;
  exit_confidence: 'high' | 'medium' | 'low' | null;
  first_touch_candle_index: number | null;
  first_touch_evidence: string | null;
  warnings?: string[];
}
```


---
## FILE: frontend/src/services/api.ts
```ts
import { createClient } from '@supabase/supabase-js';
import { Trade, RiskSettings, ExtractedTradeData } from '../types/index.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const API_URL = import.meta.env.VITE_API_URL as string || 'http://localhost:3001';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

class ApiService {
  private async getHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }

  private async getAuthHeader(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  }

  async get<T>(path: string): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, { headers });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const authHeader = await this.getAuthHeader();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async delete(path: string): Promise<void> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
  }
}

export const api = new ApiService();

export const tradesApi = {
  getAll: () => api.get<Trade[]>('/api/trades'),
  create: (data: Partial<Trade>) => api.post<Trade>('/api/trades', data),
  update: (id: string, data: Partial<Trade>) => api.put<Trade>(`/api/trades/${id}`, data),
  delete: (id: string) => api.delete(`/api/trades/${id}`),
};

export const analyticsApi = {
  getSummary: () => api.get('/api/analytics/summary'),
  getDailyPnL: () => api.get('/api/analytics/daily-pnl'),
  getEquityCurve: () => api.get('/api/analytics/equity-curve'),
  getBySession: () => api.get('/api/analytics/by-session'),
  getByInstrument: () => api.get('/api/analytics/by-instrument'),
  getByConfluence: () => api.get('/api/analytics/by-confluence'),
  getByDayOfWeek: () => api.get('/api/analytics/by-day-of-week'),
  getByTimeOfDay: () => api.get('/api/analytics/by-time-of-day'),
  getMonthlyHeatmap: (year: number, month: number) =>
    api.get(`/api/analytics/monthly-heatmap?year=${year}&month=${month}`),
  getAdvanced: () => api.get('/api/analytics/advanced'),
};

export const aiApi = {
  analyzeChartScreenshot: (file: File, contractSize: number) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('contractSize', String(contractSize));
    return api.postFormData<Array<{
      symbol?: string;
      direction?: 'Long' | 'Short' | null;
      entry_price: number | null;
      stop_loss: number | null;
      take_profit: number | null;
      rr_ratio: string | null;
      outcome: 'WIN' | 'LOSS' | null;
      trade_duration: string | null;
      net_pnl: number | null;
    }>>('/api/ai/chart-analyzer', formData);
  },
  scanChart: (
    file: File,
    entryDate: string,
    entryTime: string,
    focusImages: File[] = [],
    scannerContext?: Record<string, unknown>
  ) => {
    const formData = new FormData();
    formData.append('image', file);
    focusImages.forEach(image => formData.append('focusImages', image));
    if (scannerContext) {
      formData.append('scannerContext', JSON.stringify(scannerContext));
    }
    formData.append('entryDate', entryDate);
    formData.append('entryTime', entryTime);
    return api.postFormData<ExtractedTradeData & { warnings?: string[] }>('/api/ai/scan', formData);
  },
  analyzeTradeById: (tradeId: string) => api.post(`/api/ai/trade-analysis/${tradeId}`, {}),
  analyzePatterns: () => api.post('/api/ai/patterns', {}),
  weeklyReport: (weekStart: string, weekEnd: string) =>
    api.post('/api/ai/weekly-report', { weekStart, weekEnd }),
  psychologyReport: () => api.post('/api/ai/psychology-report', {}),
  playbookCheck: (tradeId: string) => api.post(`/api/ai/playbook-check/${tradeId}`, {}),
  flyxaChat: (
    question: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ) => api.post<{ reply: string }>('/api/ai/flyxa-chat', { question, history }),
};

export const riskApi = {
  getSettings: () => api.get<RiskSettings>('/api/risk/settings'),
  updateSettings: (data: Partial<RiskSettings>) => api.put<RiskSettings>('/api/risk/settings', data),
  getDailyStatus: () => api.get('/api/risk/daily-status'),
};

export const psychologyApi = {
  getAll: () => api.get('/api/psychology'),
  create: (data: Record<string, unknown>) => api.post('/api/psychology', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/psychology/${id}`, data),
  delete: (id: string) => api.delete(`/api/psychology/${id}`),
  getMindsetChart: () => api.get('/api/psychology/mindset-chart'),
};

export const playbookApi = {
  getAll: () => api.get('/api/playbook'),
  create: (data: Record<string, unknown>) => api.post('/api/playbook', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/playbook/${id}`, data),
  delete: (id: string) => api.delete(`/api/playbook/${id}`),
};

export const journalApi = {
  getAll: () => api.get('/api/journal'),
  getById: (id: string) => api.get(`/api/journal/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/journal', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/journal/${id}`, data),
  delete: (id: string) => api.delete(`/api/journal/${id}`),
};

export const marketDataApi = {
  getChart: (symbol: string, interval: string, range: string) =>
    api.get<Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>>(
      `/api/market-data/chart?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`
    ),
};

export interface BillingLivePricesResponse {
  firm: string;
  prices: Record<string, number>;
  source: string;
  fetchedAt: string;
  live: boolean;
  fallback: boolean;
  note?: string;
  unavailableSizes?: string[];
}

export const billingApi = {
  getLivePrices: (firm: string) =>
    api.get<BillingLivePricesResponse>(`/api/billing/live-prices?firm=${encodeURIComponent(firm)}`),
};
```


---
## FILE: frontend/src/utils/scannerColors.ts
```ts
export const SCANNER_COLOR_STORAGE_KEY = 'flyxa_scanner_colors';

export type ScannerColorKey =
  | 'supplyStopZone'
  | 'targetDemandZone'
  | 'entryZone'
  | 'neutralZone';

export interface ScannerColorConfig {
  hex: string;
  opacity: number;
}

export interface ScannerColorProfile {
  supplyStopZone: ScannerColorConfig;
  targetDemandZone: ScannerColorConfig;
  entryZone: ScannerColorConfig;
  neutralZone: ScannerColorConfig;
}

const SCANNER_COLOR_KEYS: ScannerColorKey[] = [
  'supplyStopZone',
  'targetDemandZone',
  'entryZone',
  'neutralZone',
];

const DEFAULT_SCANNER_COLORS: ScannerColorProfile = {
  supplyStopZone: { hex: '#C0392B', opacity: 100 },
  targetDemandZone: { hex: '#1A6B5A', opacity: 100 },
  entryZone: { hex: '#E67E22', opacity: 100 },
  neutralZone: { hex: '#7F8C8D', opacity: 100 },
};

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return 100;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeHexInput(value: string): string | null {
  const match = value.trim().match(/^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/);
  if (!match) {
    return null;
  }

  const raw = match[1].toUpperCase();
  if (raw.length === 3) {
    return `#${raw.split('').map(ch => `${ch}${ch}`).join('')}`;
  }

  return `#${raw}`;
}

function sanitizeColorConfig(
  value: unknown,
  fallback: ScannerColorConfig
): ScannerColorConfig {
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }

  const entry = value as { hex?: unknown; opacity?: unknown };
  const normalizedHex = typeof entry.hex === 'string'
    ? normalizeHexInput(entry.hex)
    : null;
  const opacity = typeof entry.opacity === 'number'
    ? clampOpacity(entry.opacity)
    : fallback.opacity;

  return {
    hex: normalizedHex ?? fallback.hex,
    opacity,
  };
}

function sanitizeColorProfile(value: unknown): ScannerColorProfile {
  if (!value || typeof value !== 'object') {
    return getDefaultScannerColors();
  }

  const rawProfile = value as Record<string, unknown>;

  return {
    supplyStopZone: sanitizeColorConfig(rawProfile.supplyStopZone, DEFAULT_SCANNER_COLORS.supplyStopZone),
    targetDemandZone: sanitizeColorConfig(rawProfile.targetDemandZone, DEFAULT_SCANNER_COLORS.targetDemandZone),
    entryZone: sanitizeColorConfig(rawProfile.entryZone, DEFAULT_SCANNER_COLORS.entryZone),
    neutralZone: sanitizeColorConfig(rawProfile.neutralZone, DEFAULT_SCANNER_COLORS.neutralZone),
  };
}

export function getDefaultScannerColors(): ScannerColorProfile {
  return {
    supplyStopZone: { ...DEFAULT_SCANNER_COLORS.supplyStopZone },
    targetDemandZone: { ...DEFAULT_SCANNER_COLORS.targetDemandZone },
    entryZone: { ...DEFAULT_SCANNER_COLORS.entryZone },
    neutralZone: { ...DEFAULT_SCANNER_COLORS.neutralZone },
  };
}

export function getScannerColors(): ScannerColorProfile {
  if (typeof window === 'undefined') {
    return getDefaultScannerColors();
  }

  try {
    const raw = localStorage.getItem(SCANNER_COLOR_STORAGE_KEY);
    if (!raw) {
      return getDefaultScannerColors();
    }
    return sanitizeColorProfile(JSON.parse(raw));
  } catch {
    return getDefaultScannerColors();
  }
}

export function saveScannerColors(profile: ScannerColorProfile): ScannerColorProfile {
  const normalizedProfile = sanitizeColorProfile(profile);
  if (typeof window === 'undefined') {
    return normalizedProfile;
  }

  try {
    localStorage.setItem(SCANNER_COLOR_STORAGE_KEY, JSON.stringify(normalizedProfile));
  } catch {
    // Ignore write failures (e.g. private mode quota) and keep in-memory value.
  }

  return normalizedProfile;
}

export function updateScannerColor(
  profile: ScannerColorProfile,
  key: ScannerColorKey,
  update: Partial<ScannerColorConfig>
): ScannerColorProfile {
  return sanitizeColorProfile({
    ...profile,
    [key]: {
      ...profile[key],
      ...update,
    },
  });
}

export function withScannerColorContext(
  scannerContext?: Record<string, unknown> | null
): Record<string, unknown> {
  return {
    ...(scannerContext ?? {}),
    scanner_colors: getScannerColors(),
  };
}

export function formatScannerColorValue(color: ScannerColorConfig): string {
  if (color.opacity >= 100) {
    return color.hex;
  }

  const normalizedHex = normalizeHexInput(color.hex);
  if (!normalizedHex) {
    return color.hex;
  }

  const red = Number.parseInt(normalizedHex.slice(1, 3), 16);
  const green = Number.parseInt(normalizedHex.slice(3, 5), 16);
  const blue = Number.parseInt(normalizedHex.slice(5, 7), 16);
  const alpha = Math.max(0, Math.min(1, color.opacity / 100));
  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
}

export function isValidScannerHex(value: string): boolean {
  return normalizeHexInput(value) !== null;
}

export function normalizeScannerHex(value: string): string | null {
  return normalizeHexInput(value);
}

export const SCANNER_COLOR_ORDER = [...SCANNER_COLOR_KEYS];
```


---
## FILE: frontend/src/components/settings/ChartScannerColorSettings.tsx
```ts
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import {
  type ScannerColorKey,
  type ScannerColorProfile,
  formatScannerColorValue,
  getScannerColors,
  isValidScannerHex,
  normalizeScannerHex,
  saveScannerColors,
  updateScannerColor,
} from '../../utils/scannerColors.js';

const TRADINGVIEW_COLOR_GRID: string[][] = [
  ['#FFFFFF', '#D1D4DC', '#9598A1', '#6A6D78', '#50535E', '#373A45', '#2A2E39', '#1C2030', '#131722', '#0C0E15'],
  ['#FFC0CB', '#FFB3BA', '#FF9999', '#FF6B6B', '#FF4444', '#FF0000', '#E00000', '#C00000', '#8B0000', '#5C0000'],
  ['#FFE4B5', '#FFCC80', '#FFB347', '#FFA500', '#FF8C00', '#FF6600', '#E55100', '#C84B00', '#A63200', '#7A1E00'],
  ['#FFFFE0', '#FFFF99', '#FFFF00', '#FFD700', '#FFC200', '#FFB300', '#F9A825', '#E65100', '#BF360C', '#7F2704'],
  ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784', '#4CAF50', '#2E7D32', '#1B5E20', '#33691E', '#558B2F', '#76900D'],
  ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', '#00BCD4', '#0097A7', '#00796B', '#1A6B5A', '#00574B', '#004D40'],
  ['#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6', '#2196F3', '#1565C0', '#0D47A1', '#1A237E', '#283593', '#311B92'],
  ['#F3E5F5', '#CE93D8', '#BA68C8', '#AB47BC', '#9C27B0', '#7B1FA2', '#6A1B9A', '#4A148C', '#38006B', '#1A0035'],
  ['#FCE4EC', '#F8BBD9', '#F48FB1', '#F06292', '#E91E63', '#C2185B', '#AD1457', '#880E4F', '#560027', '#37001C'],
];

const COLOR_ROW_META: Array<{ key: ScannerColorKey; label: string }> = [
  { key: 'supplyStopZone', label: 'Stop loss' },
  { key: 'targetDemandZone', label: 'Take profit' },
  { key: 'entryZone', label: 'Entry zone' },
];

const TOKEN_SCOPE_STYLE: CSSProperties = {
  '--surface-1': 'var(--app-panel)',
  '--surface-2': 'var(--app-panel-strong)',
  '--surface-3': 'rgba(255,255,255,0.08)',
  '--border': 'var(--app-border)',
  '--border-sub': 'rgba(255,255,255,0.05)',
  '--txt': 'var(--app-text)',
  '--txt-2': 'var(--app-text-muted)',
  '--txt-3': 'var(--app-text-subtle)',
  '--amber': 'var(--accent)',
  '--amber-dim': 'var(--accent-dim)',
  '--amber-border': 'var(--accent-border)',
} as CSSProperties;

function areProfilesEqual(a: ScannerColorProfile, b: ScannerColorProfile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ChartScannerColorSettings() {
  const initialProfile = useMemo(() => getScannerColors(), []);
  const [draftProfile, setDraftProfile] = useState<ScannerColorProfile>(initialProfile);
  const [savedProfile, setSavedProfile] = useState<ScannerColorProfile>(initialProfile);
  const [openPopoverRow, setOpenPopoverRow] = useState<ScannerColorKey | null>(null);
  const [customHexInput, setCustomHexInput] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const rowRefs = useRef(new Map<ScannerColorKey, HTMLDivElement>());
  const swatchButtonRefs = useRef(new Map<ScannerColorKey, HTMLButtonElement>());
  const [popoverPlacement, setPopoverPlacement] = useState<{ vertical: 'below' | 'above'; horizontal: 'left' | 'right' }>({
    vertical: 'below',
    horizontal: 'left',
  });

  const isDirty = !areProfilesEqual(draftProfile, savedProfile);
  const activeColor = openPopoverRow ? draftProfile[openPopoverRow] : null;

  useEffect(() => {
    if (!openPopoverRow) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const activeRow = rowRefs.current.get(openPopoverRow);
      if (!activeRow) {
        setOpenPopoverRow(null);
        return;
      }

      if (!activeRow.contains(event.target as Node)) {
        setOpenPopoverRow(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPopoverRow(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [openPopoverRow]);

  useEffect(() => {
    if (!savedFlash) {
      return;
    }

    const timer = window.setTimeout(() => setSavedFlash(false), 1800);
    return () => window.clearTimeout(timer);
  }, [savedFlash]);

  const syncPopoverPlacement = (key: ScannerColorKey) => {
    const anchorButton = swatchButtonRefs.current.get(key);
    if (!anchorButton) return;

    const anchorRect = anchorButton.getBoundingClientRect();
    const viewportPadding = 8;
    const estimatedPopoverWidth = 220;
    const estimatedPopoverHeight = 278;
    const gap = 8;

    const opensAbove = anchorRect.bottom + gap + estimatedPopoverHeight > window.innerHeight - viewportPadding
      && anchorRect.top - gap - estimatedPopoverHeight >= viewportPadding;
    const alignRight = anchorRect.left + estimatedPopoverWidth > window.innerWidth - viewportPadding;

    setPopoverPlacement({
      vertical: opensAbove ? 'above' : 'below',
      horizontal: alignRight ? 'right' : 'left',
    });
  };

  const openColorPopover = (key: ScannerColorKey) => {
    syncPopoverPlacement(key);
    setOpenPopoverRow(current => {
      if (current === key) {
        return null;
      }
      setCustomHexInput(draftProfile[key].hex);
      return key;
    });
  };

  const applyHexToActiveRow = (rawHex: string) => {
    if (!openPopoverRow) {
      return;
    }

    const normalizedHex = normalizeScannerHex(rawHex);
    if (!normalizedHex) {
      return;
    }

    setDraftProfile(current => updateScannerColor(current, openPopoverRow, { hex: normalizedHex }));
    setCustomHexInput(normalizedHex);
    setOpenPopoverRow(null);
  };

  const handleSaveProfile = () => {
    const saved = saveScannerColors(draftProfile);
    setDraftProfile(saved);
    setSavedProfile(saved);
    setSavedFlash(true);
  };

  return (
    <div style={{ ...TOKEN_SCOPE_STYLE, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'visible' }}>
      <style>
        {`
          .chart-scanner-color-cell {
            width: 18px;
            height: 18px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            outline: 1px solid transparent;
            transform: scale(1);
            transition: transform 120ms ease, outline-color 120ms ease;
          }

          .chart-scanner-color-cell:hover {
            transform: scale(1.2);
            outline: 1.5px solid rgba(255,255,255,0.9);
          }

          .chart-scanner-color-cell.is-selected {
            transform: scale(1.1);
            outline: 2px solid rgba(255,255,255,0.95);
          }

          .chart-scanner-opacity {
            width: 100%;
            appearance: none;
            -webkit-appearance: none;
            height: 6px;
            border-radius: 999px;
            cursor: pointer;
          }

          .chart-scanner-opacity::-webkit-slider-runnable-track {
            height: 6px;
            border-radius: 999px;
            background: transparent;
          }

          .chart-scanner-opacity::-webkit-slider-thumb {
            appearance: none;
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            border: none;
            border-radius: 999px;
            background: rgba(255,255,255,0.96);
            box-shadow: 0 1px 4px rgba(0,0,0,0.5);
            margin-top: -4px;
          }

          .chart-scanner-opacity::-moz-range-track {
            height: 6px;
            border-radius: 999px;
            background: transparent;
          }

          .chart-scanner-opacity::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border: none;
            border-radius: 999px;
            background: rgba(255,255,255,0.96);
            box-shadow: 0 1px 4px rgba(0,0,0,0.5);
          }
        `}
      </style>

      <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>Chart Scanner Colors</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--txt-3)' }}>
          Tell Flyxa which colors you use for zones in TradingView
        </p>
      </header>

      {COLOR_ROW_META.map(row => {
        const colorValue = draftProfile[row.key];
        const valueText = formatScannerColorValue(colorValue);
        const isPopoverOpen = openPopoverRow === row.key;
        const sliderFillColor = formatScannerColorValue({
          hex: colorValue.hex,
          opacity: colorValue.opacity,
        });

        return (
          <div
            key={row.key}
            ref={node => {
              if (!node) {
                rowRefs.current.delete(row.key);
                return;
              }
              rowRefs.current.set(row.key, node);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-sub)',
            }}
          >
            <span style={{ minWidth: 140, fontSize: 12, color: 'var(--txt-2)' }}>{row.label}</span>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => openColorPopover(row.key)}
                aria-label={`Open ${row.label} color picker`}
                ref={node => {
                  if (!node) {
                    swatchButtonRefs.current.delete(row.key);
                    return;
                  }
                  swatchButtonRefs.current.set(row.key, node);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  border: '2px solid rgba(255,255,255,0.15)',
                  background: valueText,
                  cursor: 'pointer',
                }}
              />

              {isPopoverOpen && activeColor && (
                <div
                  style={{
                    position: 'absolute',
                    top: popoverPlacement.vertical === 'below' ? 'calc(100% + 8px)' : undefined,
                    bottom: popoverPlacement.vertical === 'above' ? 'calc(100% + 8px)' : undefined,
                    left: popoverPlacement.horizontal === 'left' ? 0 : undefined,
                    right: popoverPlacement.horizontal === 'right' ? 0 : undefined,
                    width: 220,
                    padding: 12,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    zIndex: 120,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 18px)', gap: 3 }}>
                    {TRADINGVIEW_COLOR_GRID.flat().map(color => (
                      <button
                        key={`${row.key}-${color}`}
                        type="button"
                        className={`chart-scanner-color-cell${activeColor.hex === color ? ' is-selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => applyHexToActiveRow(color)}
                        aria-label={`Use ${color}`}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => applyHexToActiveRow(customHexInput)}
                      aria-label="Apply custom hex color"
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: 'var(--surface-3)',
                        color: 'var(--txt-2)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={12} />
                    </button>
                    <input
                      value={customHexInput}
                      onChange={event => setCustomHexInput(event.target.value.trim().toUpperCase())}
                      onBlur={() => {
                        if (isValidScannerHex(customHexInput)) {
                          applyHexToActiveRow(customHexInput);
                        }
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          applyHexToActiveRow(customHexInput);
                        }
                      }}
                      placeholder="#HEX"
                      style={{
                        width: 80,
                        height: 22,
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: 'var(--surface-3)',
                        color: 'var(--txt)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        padding: '4px 8px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)' }}>
                        Opacity
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--txt-2)', fontFamily: 'var(--font-mono)' }}>
                        {activeColor.opacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={activeColor.opacity}
                      onChange={event => {
                        const nextOpacity = Number(event.target.value);
                        setDraftProfile(current => updateScannerColor(current, row.key, { opacity: nextOpacity }));
                      }}
                      className="chart-scanner-opacity"
                      style={{
                        background: `linear-gradient(to right, ${sliderFillColor} 0%, ${sliderFillColor} ${activeColor.opacity}%, var(--surface-3) ${activeColor.opacity}%, var(--surface-3) 100%)`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--txt-3)' }}>
              {valueText}
            </span>
          </div>
        );
      })}

      <p
        style={{
          margin: 0,
          padding: '12px 18px',
          fontSize: 11,
          color: 'var(--txt-3)',
          fontStyle: 'italic',
          borderBottom: '1px solid var(--border-sub)',
        }}
      >
        Match these to your TradingView Position tool Stop color and Target color settings.
      </p>

      <div style={{ padding: '12px 18px' }}>
        <button
          type="button"
          onClick={handleSaveProfile}
          style={{
            width: '100%',
            height: 34,
            border: 'none',
            borderRadius: 5,
            background: 'var(--amber)',
            color: 'var(--app-bg)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isDirty ? 1 : 0.86,
            transition: 'opacity 120ms ease',
          }}
        >
          Save Color Profile
        </button>

        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--txt-3)' }}>
          These colors are sent to Flyxa AI with every chart upload.
          {savedFlash ? ' Saved.' : ''}
        </p>
      </div>
    </div>
  );
}
```


---
## FILE: frontend/src/components/scanner/ScreenshotImportModal.tsx
```ts
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Clock3, Expand, ImagePlus, Sparkles, Wand2, X, Upload } from 'lucide-react';
import TradeForm from './TradeForm.js';
import { Trade } from '../../types/index.js';
import { aiApi } from '../../services/api.js';
import { lookupContract } from '../../constants/futuresContracts.js';
import { useAppSettings } from '../../contexts/AppSettingsContext.js';
import { withScannerColorContext } from '../../utils/scannerColors.js';

const DRAFT_KEY = 'tw_scanner_draft';
const DRAFT_IMAGE_KEY = 'tw_scanner_draft_image';

const SYMBOL_MAP: Record<string, string> = {
  NQM26:'NQ',NQH26:'NQ',NQU26:'NQ',NQZ26:'NQ',
  ESM26:'ES',ESH26:'ES',ESU26:'ES',ESZ26:'ES',
  MNQM26:'MNQ',MNQH26:'MNQ',MNQU26:'MNQ',MNQZ26:'MNQ',
  MESM26:'MES',MESH26:'MES',MESU26:'MES',MESZ26:'MES',
};

function resolveSymbol(raw: string): string {
  return SYMBOL_MAP[raw.toUpperCase()] ?? raw.toUpperCase();
}

function normalizeResolvedSymbol(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const normalized = resolveSymbol(raw.trim());
  return ['UNKNOWN', 'UNKWN', 'N/A', 'NA', 'NONE', 'NULL'].includes(normalized) ? null : normalized;
}

function inferSymbolFromFileName(fileName: string): string | null {
  const upper = fileName.toUpperCase();
  const match = upper.match(/(?:^|[^A-Z0-9])(MNQ|MES|NQ|ES|MYM|YM|M2K|RTY|CL|MCL|GC|SI|6E)(?=[^A-Z0-9]|$)/);
  return match ? match[1] : null;
}

interface CropPreset {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ComponentBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  count: number;
}

interface ScannerContext {
  direction_hint?: 'Long' | 'Short';
  chart_left_ratio?: number;
  chart_right_ratio?: number;
  box_left_ratio?: number;
  box_right_ratio?: number;
  entry_line_ratio?: number;
  stop_line_ratio?: number;
  target_line_ratio?: number;
  red_box?: Omit<ComponentBounds, 'count'>;
  green_box?: Omit<ComponentBounds, 'count'>;
}

const DEFAULT_FOCUS_CROPS: CropPreset[] = [
  { name: 'header-focus', x: 0.00, y: 0.00, width: 0.34, height: 0.12 },
  { name: 'trade-box-focus', x: 0.46, y: 0.10, width: 0.30, height: 0.72 },
  { name: 'entry-window-focus', x: 0.40, y: 0.16, width: 0.22, height: 0.62 },
  { name: 'exit-path-focus', x: 0.46, y: 0.16, width: 0.24, height: 0.62 },
  { name: 'price-label-focus', x: 0.78, y: 0.00, width: 0.22, height: 1.00 },
  { name: 'entry-label-focus', x: 0.83, y: 0.40, width: 0.17, height: 0.08 },
  { name: 'stop-label-focus', x: 0.83, y: 0.28, width: 0.17, height: 0.08 },
  { name: 'target-label-focus', x: 0.83, y: 0.52, width: 0.17, height: 0.08 },
];

const ACCOUNT_STATUS_STYLES = {
  Eval: 'border-blue-400/30 bg-blue-500/10 text-blue-300',
  Funded: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  Live: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  Blown: 'border-red-400/30 bg-red-500/10 text-red-300',
} as const;

function readScannerDraft(): Partial<Trade> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) {
      return null;
    }

    const parsed = JSON.parse(saved) as { data?: Partial<Trade> };
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load chart image for scanner crops'));
    };
    image.src = objectUrl;
  });
}

function canvasToFile(canvas: HTMLCanvasElement, fileName: string, sourceType: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Failed to create scanner crop'));
        return;
      }

      resolve(new File([blob], fileName, { type: sourceType || 'image/png' }));
    }, sourceType || 'image/png', 0.95);
  });
}

async function buildUploadImage(image: HTMLImageElement, fileName: string): Promise<File> {
  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / Math.max(1, image.naturalWidth || image.width));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to prepare scanner upload image');
  }

  context.drawImage(image, 0, 0, width, height);

  return canvasToFile(canvas, fileName.replace(/\.[^.]+$/, '') + '.webp', 'image/webp');
}

function clampRatio(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function isGreenOverlay(r: number, g: number, b: number): boolean {
  return g > r + 6 && b > r + 2 && g > 140 && b > 140;
}

function isRedOverlay(r: number, g: number, b: number): boolean {
  return r > g + 12 && r > b + 6 && r > 150;
}

function findLargestComponent(mask: Uint8Array, width: number, height: number): ComponentBounds | null {
  const visited = new Uint8Array(mask.length);
  let best: ComponentBounds | null = null;
  const queue = new Int32Array(mask.length);

  for (let index = 0; index < mask.length; index++) {
    if (!mask[index] || visited[index]) {
      continue;
    }

    let head = 0;
    let tail = 0;
    visited[index] = 1;
    queue[tail++] = index;

    let count = 0;
    let xMin = width;
    let xMax = 0;
    let yMin = height;
    let yMax = 0;

    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);

      count++;
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);

      const neighbors = [
        current - 1,
        current + 1,
        current - width,
        current + width,
      ];

      neighbors.forEach(next => {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) {
          return;
        }

        const nextX = next % width;
        if (Math.abs(nextX - x) > 1) {
          return;
        }

        visited[next] = 1;
        queue[tail++] = next;
      });
    }

    if (!best || count > best.count) {
      best = { xMin, xMax, yMin, yMax, count };
    }
  }

  return best;
}

function toRatioBounds(bounds: ComponentBounds, width: number, height: number): Omit<ComponentBounds, 'count'> {
  return {
    xMin: bounds.xMin / width,
    xMax: bounds.xMax / width,
    yMin: bounds.yMin / height,
    yMax: bounds.yMax / height,
  };
}

function inferChartPaneBounds(boxLeftRatio: number, boxRightRatio: number): { left: number; right: number } {
  if (boxRightRatio <= 0.48) {
    return { left: 0, right: 0.5 };
  }

  if (boxLeftRatio >= 0.52) {
    return { left: 0.5, right: 1 };
  }

  return { left: 0, right: 1 };
}

function detectTradeBoxContext(image: HTMLImageElement): ScannerContext | null {
  const targetWidth = Math.min(640, image.naturalWidth || image.width);
  const scale = targetWidth / (image.naturalWidth || image.width);
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const redMask = new Uint8Array(width * height);
  const greenMask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x > width * 0.88) {
        continue;
      }

      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const pixelIndex = y * width + x;

      if (isRedOverlay(r, g, b)) {
        redMask[pixelIndex] = 1;
      }

      if (isGreenOverlay(r, g, b)) {
        greenMask[pixelIndex] = 1;
      }
    }
  }

  const redBox = findLargestComponent(redMask, width, height);
  const greenBox = findLargestComponent(greenMask, width, height);

  if (!redBox || !greenBox || redBox.count < 200 || greenBox.count < 200) {
    return null;
  }

  const boxLeftRatio = Math.min(redBox.xMin, greenBox.xMin) / width;
  const boxRightRatio = Math.max(redBox.xMax, greenBox.xMax) / width;
  const chartPane = inferChartPaneBounds(boxLeftRatio, boxRightRatio);
  const redCenterY = (redBox.yMin + redBox.yMax) / 2;
  const greenCenterY = (greenBox.yMin + greenBox.yMax) / 2;
  const directionHint =
    redCenterY < greenCenterY
      ? 'Short'
      : greenCenterY < redCenterY
        ? 'Long'
        : undefined;

  let entryLineRatio: number | undefined;
  let stopLineRatio: number | undefined;
  let targetLineRatio: number | undefined;
  if (directionHint === 'Long') {
    entryLineRatio = greenBox.yMax / height;
    stopLineRatio = redBox.yMax / height;
    targetLineRatio = greenBox.yMin / height;
  } else if (directionHint === 'Short') {
    entryLineRatio = redBox.yMax / height;
    stopLineRatio = redBox.yMin / height;
    targetLineRatio = greenBox.yMax / height;
  }

  return {
    direction_hint: directionHint,
    chart_left_ratio: chartPane.left,
    chart_right_ratio: chartPane.right,
    box_left_ratio: boxLeftRatio,
    box_right_ratio: boxRightRatio,
    entry_line_ratio: entryLineRatio,
    stop_line_ratio: stopLineRatio,
    target_line_ratio: targetLineRatio,
    red_box: toRatioBounds(redBox, width, height),
    green_box: toRatioBounds(greenBox, width, height),
  };
}

function buildDynamicFocusCrops(scannerContext: ScannerContext | null): CropPreset[] {
  if (!scannerContext?.box_left_ratio || !scannerContext.box_right_ratio) {
    return DEFAULT_FOCUS_CROPS;
  }

  const chartLeft = scannerContext.chart_left_ratio ?? 0;
  const chartRight = scannerContext.chart_right_ratio ?? 1;
  const chartWidth = Math.max(0.22, chartRight - chartLeft);
  const left = scannerContext.box_left_ratio;
  const right = scannerContext.box_right_ratio;
  const boxWidth = Math.max(0.08, right - left);
  const top = Math.min(scannerContext.red_box?.yMin ?? 0.18, scannerContext.green_box?.yMin ?? 0.18);
  const bottom = Math.max(scannerContext.red_box?.yMax ?? 0.78, scannerContext.green_box?.yMax ?? 0.78);
  const boxHeight = Math.max(0.22, bottom - top);
  const entryLine = scannerContext.entry_line_ratio ?? (top + boxHeight / 2);
  const stopLine = scannerContext.stop_line_ratio ?? top;
  const targetLine = scannerContext.target_line_ratio ?? bottom;
  const labelCrop = (name: string, yCenter: number): CropPreset => ({
    name,
    x: clampRatio(chartRight - chartWidth * 0.17, chartLeft, 0.9),
    y: clampRatio(yCenter - 0.045),
    width: clampRatio(chartWidth * 0.17, 0.1, 0.18),
    height: 0.09,
  });

  return [
    {
      name: 'header-focus',
      x: chartLeft,
      y: 0.00,
      width: clampRatio(chartWidth * 0.42, 0.24, 0.42),
      height: 0.12,
    },
    {
      name: 'trade-box-focus',
      x: clampRatio(left - boxWidth * 0.25, chartLeft, chartRight - 0.12),
      y: clampRatio(top - boxHeight * 0.18),
      width: clampRatio(boxWidth * 1.7, 0.18, chartRight - clampRatio(left - boxWidth * 0.25, chartLeft, chartRight - 0.12)),
      height: clampRatio(boxHeight * 1.35, 0.30, 0.78),
    },
    {
      name: 'entry-window-focus',
      x: clampRatio(left - boxWidth * 0.45, chartLeft, chartRight - 0.12),
      y: clampRatio(top - boxHeight * 0.15),
      width: clampRatio(boxWidth * 1.2, 0.16, chartRight - clampRatio(left - boxWidth * 0.45, chartLeft, chartRight - 0.12)),
      height: clampRatio(boxHeight * 1.2, 0.32, 0.74),
    },
    {
      name: 'exit-path-focus',
      x: clampRatio(left - boxWidth * 0.10, chartLeft, chartRight - 0.12),
      y: clampRatio(top - boxHeight * 0.15),
      width: clampRatio(boxWidth * 1.55, 0.18, chartRight - clampRatio(left - boxWidth * 0.10, chartLeft, chartRight - 0.12)),
      height: clampRatio(boxHeight * 1.2, 0.32, 0.74),
    },
    {
      name: 'price-label-focus',
      x: clampRatio(chartRight - chartWidth * 0.22, chartLeft, 0.86),
      y: 0.00,
      width: clampRatio(chartWidth * 0.22, 0.14, 0.22),
      height: 1.00,
    },
    labelCrop('entry-label-focus', entryLine),
    labelCrop('stop-label-focus', stopLine),
    labelCrop('target-label-focus', targetLine),
  ];
}

export async function buildScannerAssets(file: File): Promise<{
  focusImages: File[];
  scannerContext: Record<string, unknown> | null;
  uploadImage: File;
}> {
  const image = await loadImage(file);
  const sourceType = file.type || 'image/png';
  const scannerContext = detectTradeBoxContext(image);
  const focusCrops = buildDynamicFocusCrops(scannerContext);
  const focusImages = await Promise.all(focusCrops.map(async crop => {
    const sx = Math.max(0, Math.floor(image.width * crop.x));
    const sy = Math.max(0, Math.floor(image.height * crop.y));
    const sw = Math.max(1, Math.floor(image.width * crop.width));
    const sh = Math.max(1, Math.floor(image.height * crop.height));
    const boundedWidth = Math.min(sw, image.width - sx);
    const boundedHeight = Math.min(sh, image.height - sy);

    const canvas = document.createElement('canvas');
    canvas.width = boundedWidth;
    canvas.height = boundedHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to prepare scanner crop canvas');
    }

    context.drawImage(
      image,
      sx,
      sy,
      boundedWidth,
      boundedHeight,
      0,
      0,
      boundedWidth,
      boundedHeight
    );

    return canvasToFile(canvas, `${crop.name}-${file.name}`, sourceType);
  }));

  const uploadImage = await buildUploadImage(image, file.name);

  return { focusImages, scannerContext: scannerContext ? scannerContext as unknown as Record<string, unknown> : null, uploadImage };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Trade>) => Promise<void>;
  editTrade?: Trade | null;
  prefillTrade?: Partial<Trade> | null;
  initialImageFile?: File | null;
}

export default function ScreenshotImportModal({ isOpen, onClose, onSave, editTrade, prefillTrade, initialImageFile }: Props) {
  const { accounts, getDefaultTradeAccountId, isTradeAccountAllocatable, resolveTradeAccountId } = useAppSettings();
  const getInitialTradeAccountId = useCallback(() => {
    const baseTrade = editTrade ?? prefillTrade ?? null;
    if (baseTrade?.accountId || baseTrade?.account_id || baseTrade?.id) {
      return resolveTradeAccountId(baseTrade);
    }

    return getDefaultTradeAccountId();
  }, [editTrade, getDefaultTradeAccountId, prefillTrade, resolveTradeAccountId]);
  const getInitialContractSize = useCallback(
    () => String(Math.max(1, Number(editTrade?.contract_size ?? prefillTrade?.contract_size ?? readScannerDraft()?.contract_size ?? 1))),
    [editTrade?.contract_size, prefillTrade?.contract_size]
  );

  const [scanning, setScanning]           = useState(false);
  const [scanError, setScanError]         = useState('');
  const [warnings, setWarnings]           = useState<string[]>([]);
  const [scanEvidence, setScanEvidence]   = useState<string>('');
  const [formData, setFormData]           = useState<Partial<Trade> | null>(() => {
    if (editTrade) return editTrade;
    if (prefillTrade) return prefillTrade;
    return readScannerDraft();
  });
  const [aiFields, setAiFields]           = useState<Set<string>>(new Set());
  const [imagePreview, setImagePreview]   = useState<string | null>(() => {
    if (editTrade) return editTrade.screenshot_url ?? null;
    try { return localStorage.getItem(DRAFT_IMAGE_KEY) ?? null; } catch { return null; }
  });
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [isDragging, setIsDragging]       = useState(false);
  const [saving, setSaving]              = useState(false);
  const [contractInputValue, setContractInputValue] = useState(() => getInitialContractSize());
  const [tradeAccountId, setTradeAccountId] = useState(() => getInitialTradeAccountId());

  const [currentDate, setCurrentDate] = useState(
    () => editTrade?.trade_date ?? prefillTrade?.trade_date ?? readScannerDraft()?.trade_date ?? ''
  );
  const [currentTime, setCurrentTime] = useState(
    () => editTrade?.trade_time ?? prefillTrade?.trade_time ?? readScannerDraft()?.trade_time ?? ''
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoImportedImageKeyRef = useRef('');
  const accountById = useMemo(() => new Map(accounts.map(account => [account.id, account] as const)), [accounts]);
  const existingTradeAccountId = editTrade ? resolveTradeAccountId(editTrade) : null;
  const selectedTradeAccount = accountById.get(tradeAccountId);
  const selectedTradeAccountIsAllocatable = tradeAccountId ? isTradeAccountAllocatable(tradeAccountId) : false;
  const hasAllocatableAccount = useMemo(
    () => accounts.some(account => isTradeAccountAllocatable(account.id)),
    [accounts, isTradeAccountAllocatable]
  );
  const selectedTradeAccountStatusClass = selectedTradeAccount
    ? ACCOUNT_STATUS_STYLES[selectedTradeAccount.status]
    : null;

  const getFallbackScanDate = () => new Date().toISOString().split('T')[0];
  const getFallbackScanTime = () =>
    new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const savedDraft = !editTrade && !prefillTrade ? readScannerDraft() : null;

    setCurrentDate(editTrade?.trade_date ?? prefillTrade?.trade_date ?? savedDraft?.trade_date ?? '');
    setCurrentTime(editTrade?.trade_time ?? prefillTrade?.trade_time ?? savedDraft?.trade_time ?? '');
    if (editTrade) {
      setImagePreview(editTrade.screenshot_url ?? null);
    } else {
      try { setImagePreview(localStorage.getItem(DRAFT_IMAGE_KEY) ?? null); } catch { setImagePreview(null); }
    }
    setContractInputValue(String(Math.max(1, Number(editTrade?.contract_size ?? prefillTrade?.contract_size ?? savedDraft?.contract_size ?? 1))));
    setTradeAccountId(getInitialTradeAccountId());
    setAiFields(new Set());
    setWarnings([]);
    setScanEvidence('');
    setScanError('');

    if (editTrade) {
      setFormData(editTrade);
      return;
    }

    if (prefillTrade) {
      setFormData(prefillTrade);
      return;
    }

    setFormData(savedDraft ?? null);
  }, [editTrade, getInitialContractSize, getInitialTradeAccountId, isOpen, prefillTrade]);

  const handleFormDraftChange = useCallback((draftData: Partial<Trade>) => {
    if (!isOpen || editTrade) {
      return;
    }

    const parsedContractInput = Number.parseInt(contractInputValue, 10);
    const contractSize = Number.isFinite(parsedContractInput) && parsedContractInput > 0
      ? parsedContractInput
      : draftData.contract_size;
    const persistedDraft: Partial<Trade> = {
      ...draftData,
      accountId: tradeAccountId || getDefaultTradeAccountId(),
      contract_size: contractSize,
      trade_date: currentDate || draftData.trade_date,
      trade_time: currentTime || draftData.trade_time,
      screenshot_url: imagePreview ?? undefined,
    };

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: persistedDraft }));
    } catch {
      // ignore localStorage quota/write errors
    }
  }, [
    contractInputValue,
    currentDate,
    currentTime,
    editTrade,
    getDefaultTradeAccountId,
    imagePreview,
    isOpen,
    tradeAccountId,
  ]);

  useEffect(() => {
    if (!isOpen || editTrade) {
      return;
    }

    const existingDraft = readScannerDraft();
    const hasSomethingToPersist = Boolean(currentDate || currentTime || formData || existingDraft);
    if (!hasSomethingToPersist) {
      return;
    }

    const base = formData ?? existingDraft ?? {};
    const nextDraft: Partial<Trade> = {
      ...base,
      trade_date: currentDate || undefined,
      trade_time: currentTime || undefined,
    };

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: nextDraft }));
    } catch {
      // ignore localStorage quota/write errors
    }
  }, [currentDate, currentTime, editTrade, formData, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const reset = () => {
    setFormData(editTrade ?? prefillTrade ?? null);
    setAiFields(new Set());
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_IMAGE_KEY);
    setImagePreview(editTrade?.screenshot_url ?? null);
    setFullscreenPreview(false);
    setScanError('');
    setWarnings([]);
    setScanEvidence('');
    setCurrentDate(editTrade?.trade_date ?? prefillTrade?.trade_date ?? '');
    setCurrentTime(editTrade?.trade_time ?? prefillTrade?.trade_time ?? '');
    setContractInputValue(getInitialContractSize());
    setTradeAccountId(getInitialTradeAccountId());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = useCallback(() => {
    setFormData(editTrade ?? prefillTrade ?? null);
    setAiFields(new Set());
    setImagePreview(editTrade?.screenshot_url ?? null);
    setFullscreenPreview(false);
    setScanError('');
    setWarnings([]);
    setScanEvidence('');
    setCurrentDate(editTrade?.trade_date ?? prefillTrade?.trade_date ?? '');
    setCurrentTime(editTrade?.trade_time ?? prefillTrade?.trade_time ?? '');
    setContractInputValue(getInitialContractSize());
    setTradeAccountId(getInitialTradeAccountId());
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }, [editTrade, getInitialContractSize, getInitialTradeAccountId, onClose, prefillTrade]);

  const handleImageSelected = useCallback(async (file: File) => {
    setScanError('');
    setWarnings([]);
    setScanning(true);

    const reader = new FileReader();
    reader.onload = e => {
      const preview = e.target?.result as string;
      setImagePreview(preview);
      if (!editTrade) {
        try { localStorage.setItem(DRAFT_IMAGE_KEY, preview); } catch { /* quota exceeded â€” skip */ }
      }
    };
    reader.readAsDataURL(file);

    try {
      const scanDate = currentDate || getFallbackScanDate();
      const scanTime = currentTime || getFallbackScanTime();
      const { focusImages, scannerContext, uploadImage } = await buildScannerAssets(file);
      const extracted = await aiApi.scanChart(
        uploadImage,
        scanDate,
        scanTime,
        focusImages,
        withScannerColorContext(scannerContext ? scannerContext as unknown as Record<string, unknown> : undefined)
      );
      const INTERNAL_WARNINGS = new Set([
        'Exact price-label review failed, so price levels relied on the broader chart reads.',
        'Exit verification failed â€” relying on manual chart read.',
        'Exit verification failed, so the final answer relied on the manual chart read.',
        'Stop/target sanity check failed, so the final answer relied on the broader exit review.',
        'Header symbol/timeframe read failed, so identity relied on the broader chart reads.',
        'Primary chart extraction failed, so the scanner fell back to the human-style review pass.',
        'Human-style review failed, so the scanner relied on the primary extraction pass.',
        'Final consensus review failed, so the result relied on the primary extraction passes.',
        'Sanity check failed â€” relying on exit verification result.',
      ]);
      const w: string[] = (Array.isArray(extracted.warnings) ? extracted.warnings : [])
        .filter((msg: string) => !INTERNAL_WARNINGS.has(msg));
      const fields = new Set<string>();
      const baseTrade = editTrade ?? prefillTrade ?? formData ?? null;
      const mapped: Partial<Trade> = {
        ...baseTrade,
        accountId: tradeAccountId || getDefaultTradeAccountId(),
        trade_date: currentDate || undefined,
        trade_time: currentTime || undefined,
        contract_size: Math.max(1, Number(formData?.contract_size ?? prefillTrade?.contract_size ?? editTrade?.contract_size ?? 1)),
      };
      const resolvedSymbol = normalizeResolvedSymbol(extracted.symbol) ?? inferSymbolFromFileName(file.name);
      if (resolvedSymbol) {
        mapped.symbol = resolvedSymbol;
        if (normalizeResolvedSymbol(extracted.symbol)) {
          fields.add('symbol');
        }
      }
      if (extracted.direction)  { mapped.direction = extracted.direction as 'Long'|'Short'; fields.add('direction'); }
      if (extracted.entry_price){ mapped.entry_price = Number(extracted.entry_price); fields.add('entry_price');
        const inst = lookupContract(mapped.symbol ?? '');
        if (inst) mapped.point_value = inst.point_value;
      }
      if (extracted.sl_price)   { mapped.sl_price = Number(extracted.sl_price); fields.add('sl_price'); }
      if (extracted.tp_price)   { mapped.tp_price = Number(extracted.tp_price); fields.add('tp_price'); }
      if (extracted.exit_reason){
        const r = extracted.exit_reason as 'TP'|'SL';
        mapped.exit_reason = r; fields.add('exit_reason');
        mapped.exit_price = r === 'TP' ? Number(extracted.tp_price ?? 0) : Number(extracted.sl_price ?? 0);
      }

      if (extracted.entry_time) {
        const timeValue = (extracted.entry_time as string).slice(0, 5);
        mapped.trade_time = timeValue;
        setCurrentTime(timeValue);
        fields.add('trade_time');
      }
      if (extracted.trade_length_seconds){ mapped.trade_length_seconds = Number(extracted.trade_length_seconds); fields.add('trade_length_seconds'); }
      if (extracted.candle_count)     mapped.candle_count = Number(extracted.candle_count);
      if (extracted.timeframe_minutes) mapped.timeframe_minutes = Number(extracted.timeframe_minutes);

      setAiFields(fields);
      setFormData(mapped);
      setWarnings(w);
      setScanEvidence(extracted.first_touch_evidence ?? '');
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: mapped }));
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan image');
    } finally {
      setScanning(false);
    }
  }, [currentDate, currentTime, editTrade?.contract_size, formData?.contract_size, getDefaultTradeAccountId, prefillTrade?.contract_size, tradeAccountId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleImageSelected(file);
  }, [handleImageSelected]);

  useEffect(() => {
    if (!isOpen) {
      autoImportedImageKeyRef.current = '';
      return;
    }

    if (!initialImageFile || editTrade) {
      return;
    }

    const imageKey = `${initialImageFile.name}:${initialImageFile.size}:${initialImageFile.lastModified}`;
    if (autoImportedImageKeyRef.current === imageKey) {
      return;
    }

    autoImportedImageKeyRef.current = imageKey;
    void handleImageSelected(initialImageFile);
  }, [editTrade, handleImageSelected, initialImageFile, isOpen]);

  const handleSave = async (data: Partial<Trade>) => {
    if (!tradeAccountId || !selectedTradeAccount) {
      alert('Select an account before saving this trade.');
      return;
    }

    if (!selectedTradeAccountIsAllocatable && tradeAccountId !== existingTradeAccountId) {
      alert(`${selectedTradeAccount.name} is marked as Blown and cannot be allocated to a trade.`);
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...data,
        accountId: tradeAccountId || getDefaultTradeAccountId(),
        screenshot_url: imagePreview ?? editTrade?.screenshot_url ?? undefined,
      });
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(DRAFT_IMAGE_KEY);
      handleClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save trade');
    } finally {
      setSaving(false);
    }
  };

  const topInputClass = 'input-field h-12 border border-amber-400/70 bg-slate-950/80 shadow-[0_0_0_1px_rgba(245,158,11,0.18),0_0_18px_rgba(245,158,11,0.14)]';
  const hasPreviewImage = Boolean(imagePreview);
  const reviewSectionTitle = editTrade ? 'Review screenshot' : 'Import screenshot';
  const reviewSectionCopy = editTrade
    ? 'View the journaled chart in fullscreen, or upload a replacement screenshot and rescan this trade.'
    : 'Scan a TradingView chart, then review the extracted trade details before saving.';
  const handleContractSizeChange = (value: string) => {
    setContractInputValue(value);

    if (value === '') {
      setFormData(current => ({
        ...(current ?? {}),
        contract_size: undefined,
      }));
      return;
    }

    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return;
    }

    setFormData(current => ({
      ...(current ?? {}),
      contract_size: parsedValue,
    }));
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (fullscreenPreview) {
        setFullscreenPreview(false);
        return;
      }

      handleClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenPreview, handleClose, isOpen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 p-4 md:p-6">
        <button
          type="button"
          aria-label="Close trade modal"
          onClick={handleClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        <div className="relative mx-auto h-full max-w-[1400px]">
          <div className="flex h-full flex-col overflow-hidden rounded-[30px] border border-slate-700/70 bg-slate-900/95 shadow-[0_32px_120px_rgba(2,6,23,0.58)]">
            <div className="flex items-center justify-between border-b border-slate-700/80 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">{editTrade ? 'Edit Trade' : 'Add Trade'}</h2>
              <div className="flex items-center gap-3">
                {scanning && (
                  <div
                    className="inline-flex items-center gap-2.5 rounded-full px-4 py-2"
                    style={{
                      border: '1px solid rgba(251,146,60,0.35)',
                      background: 'rgba(10,9,9,0.92)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: '0 0 0 1px rgba(251,146,60,0.1), 0 4px 20px rgba(0,0,0,0.4), 0 0 16px rgba(251,146,60,0.07)',
                      animation: 'analysing-pulse 2s ease-in-out infinite',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#f97316',
                        boxShadow: '0 0 6px rgba(249,115,22,0.9)',
                        flexShrink: 0,
                        display: 'block',
                        animation: 'analysing-pulse 1.2s ease-in-out infinite',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        letterSpacing: '0.01em',
                        background: 'linear-gradient(90deg, #e2e8f0 0%, #fbbf24 45%, #f97316 65%, #e2e8f0 100%)',
                        backgroundSize: '200% auto',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        animation: 'analysing-shimmer 3s linear infinite',
                      }}
                    >
                      Flyxa is analysing your trade
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 text-slate-400 transition hover:border-slate-500 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
              <div className="flex min-h-full flex-col gap-5">

        {/* Trade date/time + warnings */}
        <div className="rounded-2xl border border-slate-700/60 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))] px-4 py-4 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Trade Date/Time</p>
              <h3 className="text-lg font-semibold text-slate-100">Add the trade anchor anytime before you save</h3>
              <p className="text-sm text-slate-400">You can fill these before, during, or after the scan. Saving still requires both fields.</p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-xl">
              <label className="space-y-1.5">
                <span className="flex items-center gap-2 text-xs font-medium text-amber-300">
                  <CalendarDays size={14} />
                  Trade Date
                </span>
                <input
                  type="date"
                  className={topInputClass}
                  value={currentDate}
                  onChange={e => setCurrentDate(e.target.value)}
                  required
                />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-2 text-xs font-medium text-amber-300">
                  <Clock3 size={14} />
                  Trade Time
                </span>
                <input
                  type="time"
                  className={topInputClass}
                  value={currentTime}
                  onChange={e => setCurrentTime(e.target.value)}
                  required
                />
              </label>
            </div>
          </div>
        </div>

        {scanEvidence && (
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/80">AI Scan Note</p>
            <p className="mt-1 text-sm text-blue-200">{scanEvidence}</p>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 space-y-1.5">
            {warnings.map((w, i) => <p key={i} className="text-yellow-400 text-xs">âš  {w}</p>)}
          </div>
        )}

        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">

          {/* Left: image upload / preview */}
          <div className="min-w-0">
            <div className="flex flex-col gap-4 rounded-[28px] border border-slate-700/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.78))] p-4 shadow-[0_24px_60px_rgba(2,6,23,0.32)]">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && handleImageSelected(e.target.files[0])} />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Chart Scanner</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-100">{reviewSectionTitle}</h3>
                  <p className="mt-1 text-sm text-slate-400">{reviewSectionCopy}</p>
                </div>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-300">
                  <Wand2 size={18} />
                </div>
              </div>

              {hasPreviewImage ? (
                <div className="relative overflow-hidden rounded-[24px] border border-slate-700/60 bg-slate-950/90 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)]">
                  <div className="aspect-[4/3] w-full bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_48%)] p-3">
                    <button
                      type="button"
                      onClick={() => setFullscreenPreview(true)}
                      className="h-full w-full"
                    >
                      <img src={imagePreview!} alt="Chart" className="h-full w-full rounded-2xl object-contain" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFullscreenPreview(true)}
                    className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-slate-600/80 bg-slate-950/90 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
                  >
                    <Expand size={12} />
                    Fullscreen
                  </button>
                  {!editTrade && (
                    <button onClick={reset} className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-slate-600/80 bg-slate-950/90 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white">
                      <X size={12} />
                      Clear
                    </button>
                  )}
                  {scanning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/78 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3 rounded-2xl border border-blue-500/20 bg-slate-900/80 px-6 py-5">
                        <div className="h-9 w-9 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-blue-200">Analysing with Flyxa</p>
                          <p className="text-xs text-slate-400">Reading levels, entry anchor, and first-touch path</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {!scanning && (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full border border-slate-600/80 bg-slate-950/90 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-blue-400/50 hover:text-white">
                      <ImagePlus size={13} />
                      {editTrade ? 'Upload New Screenshot' : 'Replace Screenshot'}
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={`group relative overflow-hidden rounded-[24px] border border-dashed cursor-pointer transition-all flex flex-col items-center justify-center px-6 py-16 select-none ${
                    isDragging
                      ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.28),0_18px_45px_rgba(37,99,235,0.16)]'
                      : 'border-slate-600/80 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.1),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.78))] hover:border-blue-400/60 hover:bg-blue-500/8'
                  }`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={`mb-4 rounded-2xl border p-4 transition-all ${isDragging ? 'border-blue-400/50 bg-blue-500/20 text-blue-200' : 'border-slate-600/70 bg-slate-900/70 text-slate-300 group-hover:border-blue-400/40 group-hover:text-blue-200'}`}>
                    <Upload size={28} />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-100">{isDragging ? 'Drop chart to start scan' : 'Drop chart screenshot here'}</h4>
                  <p className="text-slate-500 text-xs">or click to browse Â· PNG Â· JPG Â· WebP</p>
                  <p className="text-slate-600 text-xs mt-3">
                    {editTrade ? 'Upload a screenshot to inspect or rescan this trade' : 'Or fill in the form manually â†’'}
                  </p>
                </div>
              )}

              {scanError && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{scanError}</div>
              )}

              <div className="rounded-[24px] border border-slate-700/60 bg-slate-950/70 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.04)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {editTrade ? 'Trade Details' : 'Entry Details'}
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="label">Account</label>
                    <select
                      className="input-field h-11"
                      value={tradeAccountId}
                      onChange={e => setTradeAccountId(e.target.value)}
                    >
                      {accounts.map(account => (
                        <option
                          key={account.id}
                          value={account.id}
                          disabled={account.status === 'Blown' && account.id !== tradeAccountId}
                        >
                          {account.name}{account.status === 'Blown' ? ' (Blown)' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedTradeAccount && selectedTradeAccountStatusClass && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${selectedTradeAccountStatusClass}`}>
                          {selectedTradeAccount.status}
                        </span>
                        {!selectedTradeAccountIsAllocatable && tradeAccountId !== existingTradeAccountId && (
                          <span className="text-xs text-red-300">
                            Blown accounts can&apos;t be allocated to new trades.
                          </span>
                        )}
                      </div>
                    )}
                    {!hasAllocatableAccount && (
                      <p className="mt-2 text-xs text-red-300">
                        Every account is marked as Blown right now. Change one account status before saving a trade.
                      </p>
                    )}
                  </div>
                  <label className="label">Contracts</label>
                  <input
                    type="number"
                    min={1}
                    className="input-field h-11"
                    value={contractInputValue}
                    onChange={e => handleContractSizeChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              {aiFields.size > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-400/8 px-4 py-3 text-sm text-blue-200">
                  <Sparkles size={14} />
                  {aiFields.size} fields auto-extracted â€” review and save
                </div>
              )}
            </div>
          </div>

          {/* Right: form */}
          <div className="min-w-0">
            <div className="rounded-[28px] border border-slate-700/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.72))] p-4 shadow-[0_24px_60px_rgba(2,6,23,0.32)] md:p-5">
              <TradeForm
                initialData={formData || undefined}
                aiFields={aiFields}
                tradeDate={currentDate}
                tradeTime={currentTime}
                showContractsField={false}
                onSubmit={handleSave}
                onDraftChange={handleFormDraftChange}
                onCancel={handleClose}
                isLoading={saving}
              />
            </div>
          </div>
        </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {fullscreenPreview && imagePreview && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close trade screenshot"
            onClick={() => setFullscreenPreview(false)}
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, rgba(15, 23, 42, 0.16) 0%, rgba(2, 6, 23, 0.78) 68%, rgba(2, 6, 23, 0.92) 100%)',
            }}
          />

          <button
            type="button"
            onClick={() => setFullscreenPreview(false)}
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/80 bg-slate-950/90 text-slate-300 shadow-[0_12px_28px_rgba(2,6,23,0.34)] transition hover:border-slate-500 hover:text-white"
          >
            <X size={18} />
          </button>

          <div className="absolute inset-[24px] flex items-center justify-center md:inset-[32px]">
            <img
              src={imagePreview}
              alt="Trade screenshot fullscreen"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
```


---
## FILE: frontend/src/components/scanner/TradeForm.tsx
```ts
import React, { useState, useEffect } from 'react';
import { Plus, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Trade } from '../../types/index.js';
import { formatCurrency } from '../../utils/calculations.js';
import { formatRiskRewardRatio } from '../../utils/riskReward.js';
import { lookupContract, FuturesContract } from '../../constants/futuresContracts.js';
import { useAppSettings } from '../../contexts/AppSettingsContext.js';

interface Props {
  initialData?: Partial<Trade>;
  aiFields?: Set<string>;
  tradeDate: string;
  tradeTime: string;
  showContractsField?: boolean;
  onSubmit: (data: Partial<Trade>) => void;
  onDraftChange?: (data: Partial<Trade>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const emotionalStates = ['Calm', 'Confident', 'Anxious', 'Revenge Trading', 'FOMO', 'Overconfident', 'Tired'];
const THESIS_BLOCK = 'FLYXA_THESIS';
const PROCESS_BLOCK = 'FLYXA_PROCESS_GRADE';
const REFLECTION_BLOCK = 'FLYXA_REFLECTION';

function normalizeConfluences(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const deduped = new Set<string>();
  const normalized: string[] = [];

  for (const entry of rawValues) {
    if (typeof entry !== 'string') continue;
    const cleaned = entry.trim().replace(/\s+/g, ' ');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (deduped.has(key)) continue;
    deduped.add(key);
    normalized.push(cleaned.slice(0, 64));
    if (normalized.length >= 12) break;
  }

  return normalized;
}

function encodeStructuredValue(value: string): string {
  return value.replace(/\n/g, '\\n').trim();
}

function decodeStructuredValue(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

function parseStructuredBlock(note: string | undefined, blockName: string): { fields: Record<string, string>; remaining: string } {
  if (!note?.trim()) {
    return { fields: {}, remaining: '' };
  }

  const pattern = new RegExp(`\\[${blockName}\\]\\n?([\\s\\S]*?)\\n?\\[\\/${blockName}\\]\\n?`, 'm');
  const match = note.match(pattern);
  if (!match) {
    return { fields: {}, remaining: note.trim() };
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) continue;
    fields[key] = decodeStructuredValue(value);
  }

  return {
    fields,
    remaining: note.replace(match[0], '').trim(),
  };
}

function buildStructuredBlock(blockName: string, fields: Record<string, string>): string {
  const lines = Object.entries(fields)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key}:${encodeStructuredValue(value)}`);

  if (lines.length === 0) {
    return '';
  }

  return `[${blockName}]\n${lines.join('\n')}\n[/${blockName}]`;
}

const defaultForm: Partial<Trade> = {
  symbol: '',
  direction: 'Long',
  entry_price: 0,
  exit_price: 0,
  sl_price: 0,
  tp_price: 0,
  contract_size: 1,
  point_value: 20,
  trade_date: new Date().toISOString().split('T')[0],
  trade_time: '09:30',
  trade_length_seconds: 0,
  candle_count: 0,
  timeframe_minutes: 1,
  emotional_state: 'Calm',
  confidence_level: 7,
  pre_trade_notes: '',
  post_trade_notes: '',
  confluences: [],
  followed_plan: true,
};

function buildFormState(initialData?: Partial<Trade>): Partial<Trade> {
  return {
    ...defaultForm,
    ...initialData,
    confluences: normalizeConfluences(initialData?.confluences),
  };
}

export default function TradeForm({
  initialData,
  aiFields = new Set(),
  tradeDate,
  tradeTime,
  showContractsField = true,
  onSubmit,
  onDraftChange,
  onCancel,
  isLoading,
}: Props) {
  const { confluenceOptions } = useAppSettings();
  const [form, setForm] = useState<Partial<Trade>>(() => buildFormState(initialData));
  const [thesisSetup, setThesisSetup] = useState('');
  const [thesisInvalidation, setThesisInvalidation] = useState('');
  const [thesisTrigger, setThesisTrigger] = useState('');
  const [processScore, setProcessScore] = useState(0);
  const [processReason, setProcessReason] = useState('');
  const [reflectionMarket, setReflectionMarket] = useState('');
  const [reflectionExecution, setReflectionExecution] = useState('');
  const [reflectionAdjustment, setReflectionAdjustment] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [selectedConfluence, setSelectedConfluence] = useState('');
  const [matchedContract, setMatchedContract] = useState<FuturesContract | undefined>(
    () => lookupContract(initialData?.symbol || '')
  );

  useEffect(() => {
    const nextForm = buildFormState(initialData);
    const preParsed = parseStructuredBlock(nextForm.pre_trade_notes, THESIS_BLOCK);
    const processParsed = parseStructuredBlock(nextForm.post_trade_notes, PROCESS_BLOCK);
    const reflectionParsed = parseStructuredBlock(processParsed.remaining, REFLECTION_BLOCK);

    const parsedScore = Number(processParsed.fields.score);

    setThesisSetup(preParsed.fields.setup || '');
    setThesisInvalidation(preParsed.fields.invalidation || '');
    setThesisTrigger(preParsed.fields.trigger || '');
    setProcessScore(Number.isFinite(parsedScore) && parsedScore >= 1 && parsedScore <= 5 ? parsedScore : 0);
    setProcessReason(processParsed.fields.reason || '');
    setReflectionMarket(reflectionParsed.fields.market_vs_thesis || '');
    setReflectionExecution(reflectionParsed.fields.execution_quality || '');
    setReflectionAdjustment(reflectionParsed.fields.next_adjustment || '');
    setForm({
      ...nextForm,
      pre_trade_notes: preParsed.remaining,
      post_trade_notes: reflectionParsed.remaining,
    });
    const contract = lookupContract(initialData?.symbol || '');
    setMatchedContract(contract);
    setSubmitError('');
    setSelectedConfluence('');
  }, [initialData]);

  const calcPnL = (): number => {
    const { direction, entry_price, exit_price, contract_size, point_value } = form;
    if (!entry_price || !exit_price || !contract_size || !point_value) return 0;
    return direction === 'Long'
      ? (exit_price - entry_price) * contract_size * point_value
      : (entry_price - exit_price) * contract_size * point_value;
  };

  const calcRR = (): string => {
    const { entry_price, sl_price, tp_price } = form;
    if (!entry_price || !sl_price || !tp_price) return 'N/A';
    const risk = Math.abs(entry_price - sl_price);
    const reward = Math.abs(tp_price - entry_price);
    if (risk === 0) return 'N/A';
    return (reward / risk).toFixed(2);
  };

  const set = (key: keyof Trade, value: unknown) => {
    setSubmitError('');
    setForm(f => {
      const next = { ...f, [key]: value };

      if (key === 'tp_price' && next.exit_reason === 'TP') {
        next.exit_price = Number(value);
      }

      if (key === 'sl_price' && next.exit_reason === 'SL') {
        next.exit_price = Number(value);
      }

      if (key === 'entry_price' && next.exit_reason === 'BE') {
        next.exit_price = Number(value);
      }

      return next;
    });
  };

  const handleSymbolChange = (value: string) => {
    const upper = value.toUpperCase();
    set('symbol', upper);
    const contract = lookupContract(upper);
    setMatchedContract(contract);
    if (contract) set('point_value', contract.point_value);
  };

  const hasTradeDateTime = Boolean(tradeDate && tradeTime);
  const hasDuration = typeof form.trade_length_seconds === 'number'
    && Number.isFinite(form.trade_length_seconds)
    && form.trade_length_seconds > 0;
  const requiredFieldsMessage = !hasTradeDateTime && !hasDuration
    ? 'Trade Date/Time and Duration are required before saving.'
    : !hasTradeDateTime
      ? 'Trade Date/Time required before saving.'
      : !hasDuration
        ? 'Duration is required before saving.'
        : '';
  const canSubmit = Boolean(hasTradeDateTime && hasDuration && !isLoading);

  const buildComposedNotes = () => {
    const thesisBlock = buildStructuredBlock(THESIS_BLOCK, {
      setup: thesisSetup,
      invalidation: thesisInvalidation,
      trigger: thesisTrigger,
    });
    const processBlock = buildStructuredBlock(PROCESS_BLOCK, {
      score: processScore > 0 ? String(processScore) : '',
      reason: processReason,
    });
    const reflectionBlock = buildStructuredBlock(REFLECTION_BLOCK, {
      market_vs_thesis: reflectionMarket,
      execution_quality: reflectionExecution,
      next_adjustment: reflectionAdjustment,
    });

    return {
      preTradeNotes: [thesisBlock, form.pre_trade_notes?.trim() || '']
        .filter(Boolean)
        .join('\n\n')
        .trim(),
      postTradeNotes: [processBlock, reflectionBlock, form.post_trade_notes?.trim() || '']
        .filter(Boolean)
        .join('\n\n')
        .trim(),
    };
  };

  useEffect(() => {
    if (!onDraftChange) {
      return;
    }

    const { preTradeNotes, postTradeNotes } = buildComposedNotes();
    onDraftChange({
      ...form,
      confluences: normalizeConfluences(form.confluences),
      trade_date: tradeDate || undefined,
      trade_time: tradeTime || undefined,
      pre_trade_notes: preTradeNotes,
      post_trade_notes: postTradeNotes,
    });
  }, [
    form,
    onDraftChange,
    processReason,
    processScore,
    reflectionAdjustment,
    reflectionExecution,
    reflectionMarket,
    thesisInvalidation,
    thesisSetup,
    thesisTrigger,
    tradeDate,
    tradeTime,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasTradeDateTime || !hasDuration) {
      setSubmitError(requiredFieldsMessage);
      return;
    }

    if (form.exit_reason !== 'TP' && form.exit_reason !== 'SL' && form.exit_reason !== 'BE') {
      setSubmitError('Select whether TP, SL, or Breakeven before saving this trade.');
      return;
    }

    const normalizedExitPrice =
      form.exit_reason === 'TP' ? form.tp_price :
      form.exit_reason === 'SL' ? form.sl_price :
      form.entry_price;
    if (!normalizedExitPrice) {
      setSubmitError('Add an entry price so the breakeven exit can be priced correctly.');
      return;
    }

    const { preTradeNotes, postTradeNotes } = buildComposedNotes();

    onSubmit({
      ...form,
      confluences: normalizeConfluences(form.confluences),
      trade_date: tradeDate,
      trade_time: tradeTime,
      exit_price: normalizedExitPrice,
      pre_trade_notes: preTradeNotes,
      post_trade_notes: postTradeNotes,
    });
  };

  const pnl = calcPnL();
  const rr = calcRR();
  const confluences = normalizeConfluences(form.confluences);
  const availableConfluenceOptions = confluenceOptions.filter(
    option => !confluences.some(confluence => confluence.toLowerCase() === option.toLowerCase())
  );

  const addConfluence = () => {
    if (!selectedConfluence) {
      return;
    }

    const nextConfluences = normalizeConfluences([...confluences, selectedConfluence]);
    set('confluences', nextConfluences);
    setSelectedConfluence('');
  };

  const removeConfluence = (indexToRemove: number) => {
    set('confluences', confluences.filter((_, index) => index !== indexToRemove));
  };

  const AIBadge = ({ field }: { field: string }) => aiFields.has(field) ? (
    <span className="inline-flex items-center gap-0.5 text-xs text-blue-400 ml-1 font-normal">
      <Sparkles size={9} /> AI
    </span>
  ) : null;

  const P = 'var(--app-panel)';
  const P2 = 'var(--app-panel-strong)';
  const BD = 'var(--app-border)';
  const T1 = 'var(--app-text)';
  const T2 = 'var(--app-text-muted)';
  const T3 = 'var(--app-text-subtle)';
  const AMBER = 'var(--accent)';
  const AMBER_DIM = 'var(--accent-dim)';
  const AMBER_BD = 'var(--accent-border)';

  const panel: React.CSSProperties = { background: P, border: `1px solid ${BD}`, borderRadius: 8, padding: '16px 18px', marginBottom: 0 };
  const sub: React.CSSProperties = { background: P2, border: `1px solid ${BD}`, borderRadius: 6, padding: '12px 14px' };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: T3, marginBottom: 12 }}>
      {children}
    </p>
  );

  const toggleBtn = (active: boolean, color: 'green' | 'red' | 'amber'): React.CSSProperties => {
    const colors = {
      green: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', text: '#34d399' },
      red:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#f87171' },
      amber: { bg: AMBER_DIM,               border: AMBER_BD,                text: AMBER },
    }[color];
    return active
      ? { flex: 1, height: 36, borderRadius: 6, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }
      : { flex: 1, height: 36, borderRadius: 6, border: `1px solid ${BD}`, background: 'transparent', color: T2, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 };
  };

  const durationInput: React.CSSProperties = { width: '100%', background: 'transparent', border: 'none', textAlign: 'center', fontSize: 13, color: T1, outline: 'none' };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* â”€â”€ Row 1: Instrument  +  Price Levels â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

        {/* Instrument */}
        <div style={panel}>
          <SectionLabel>Instrument</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label className="label">Symbol <AIBadge field="symbol" /></label>
              <input
                type="text"
                className="input-field h-9"
                value={form.symbol || ''}
                onChange={e => handleSymbolChange(e.target.value)}
                placeholder="e.g. MNQM26"
                required
              />
              {matchedContract && (
                <p style={{ fontSize: 10, color: '#34d399', marginTop: 3 }}>{matchedContract.name} Â· ${matchedContract.point_value}/pt</p>
              )}
            </div>
            <div>
              <label className="label">Direction <AIBadge field="direction" /></label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => set('direction', 'Long')} style={toggleBtn(form.direction === 'Long', 'green')}>
                  <TrendingUp size={12} /> Long
                </button>
                <button type="button" onClick={() => set('direction', 'Short')} style={toggleBtn(form.direction === 'Short', 'red')}>
                  <TrendingDown size={12} /> Short
                </button>
              </div>
            </div>
            {showContractsField && (
              <div>
                <label className="label">Contracts</label>
                <input
                  type="number"
                  className="input-field h-9"
                  value={form.contract_size || 1}
                  onChange={e => set('contract_size', parseInt(e.target.value))}
                  min={1}
                  required
                />
              </div>
            )}
          </div>
        </div>

        {/* Price Levels */}
        <div style={panel}>
          <SectionLabel>Price Levels</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label className="label">Entry <AIBadge field="entry_price" /></label>
              <input type="number" className="input-field h-9" value={form.entry_price || ''} onChange={e => set('entry_price', parseFloat(e.target.value))} step={0.25} required />
            </div>
            <div>
              <label className="label">Exit</label>
              <input type="number" className="input-field h-9" value={form.exit_price || ''} onChange={e => set('exit_price', parseFloat(e.target.value))} step={0.25} />
            </div>
            <div>
              <label className="label">Stop Loss <AIBadge field="sl_price" /></label>
              <input type="number" className="input-field h-9" value={form.sl_price || ''} onChange={e => set('sl_price', parseFloat(e.target.value))} step={0.25} required />
            </div>
            <div>
              <label className="label">Take Profit <AIBadge field="tp_price" /></label>
              <input type="number" className="input-field h-9" value={form.tp_price || ''} onChange={e => set('tp_price', parseFloat(e.target.value))} step={0.25} required />
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Row 2: Outcome  +  Psychology â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

        {/* Outcome */}
        <div style={panel}>
          <SectionLabel>Outcome</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label className="label">Exit Reason <AIBadge field="exit_reason" /></label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['TP', 'SL', 'BE'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      set('exit_reason', r);
                      if (r === 'TP' && form.tp_price) set('exit_price', form.tp_price);
                      if (r === 'SL' && form.sl_price) set('exit_price', form.sl_price);
                      if (r === 'BE' && form.entry_price) set('exit_price', form.entry_price);
                    }}
                    style={toggleBtn(form.exit_reason === r, r === 'TP' ? 'green' : r === 'SL' ? 'red' : 'amber')}
                  >
                    {r === 'TP' ? 'Take Profit' : r === 'SL' ? 'Stop Loss' : 'Breakeven'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Duration <AIBadge field="trade_length_seconds" /></label>
              <div style={{ display: 'flex', border: `1px solid ${BD}`, borderRadius: 6, background: P2, overflow: 'hidden', height: 36 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number" min={0} max={23}
                    value={Math.floor((form.trade_length_seconds || 0) / 3600)}
                    onChange={e => { const h = Math.max(0, parseInt(e.target.value) || 0); const m = Math.floor(((form.trade_length_seconds || 0) % 3600) / 60); set('trade_length_seconds', h * 3600 + m * 60); }}
                    style={durationInput}
                    placeholder="0"
                  />
                  <span style={{ paddingRight: 6, fontSize: 11, color: T3 }}>h</span>
                </div>
                <div style={{ width: 1, background: BD }} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number" min={0} max={59}
                    value={Math.floor(((form.trade_length_seconds || 0) % 3600) / 60)}
                    onChange={e => { const m = Math.max(0, parseInt(e.target.value) || 0); const h = Math.floor((form.trade_length_seconds || 0) / 3600); set('trade_length_seconds', h * 3600 + m * 60); }}
                    style={durationInput}
                    placeholder="0"
                  />
                  <span style={{ paddingRight: 6, fontSize: 11, color: T3 }}>m</span>
                </div>
              </div>
            </div>
            {/* P&L + R:R inline */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ ...sub, borderRadius: 8, borderColor: pnl === 0 ? AMBER_BD : pnl > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }}>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: T3, marginBottom: 6 }}>P&L</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: pnl === 0 ? AMBER : pnl > 0 ? '#34d399' : '#f87171' }}>{formatCurrency(pnl)}</p>
              </div>
              <div style={{ ...sub, borderRadius: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: T3, marginBottom: 6 }}>R:R</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: T1 }}>
                  {rr === 'N/A' ? 'N/A' : formatRiskRewardRatio(Number(rr))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Psychology */}
        <div style={panel}>
          <SectionLabel>Psychology</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <label className="label">Emotional State</label>
              <select className="input-field h-9" value={form.emotional_state || 'Calm'} onChange={e => set('emotional_state', e.target.value)}>
                {emotionalStates.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Confidence ({form.confidence_level}/10)</label>
              <input
                type="range" min={1} max={10}
                value={form.confidence_level || 7}
                onChange={e => set('confidence_level', parseInt(e.target.value))}
                style={{ width: '100%', marginTop: 6, accentColor: AMBER }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T3, marginTop: 2 }}>
                <span>Low</span><span>High</span>
              </div>
            </div>
            <div>
              <label className="label">Followed Trading Plan?</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[true, false].map(v => (
                  <button key={String(v)} type="button" onClick={() => set('followed_plan', v)} style={toggleBtn(form.followed_plan === v, v ? 'green' : 'red')}>
                    {v ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Row 3: Confluences (full width) â”€â”€ */}
      <div style={panel}>
        <SectionLabel>Confluences</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <select
            className="input-field h-9"
            style={{ flex: 1 }}
            value={selectedConfluence}
            onChange={e => setSelectedConfluence(e.target.value)}
          >
            <option value="">Select confluence</option>
            {availableConfluenceOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={addConfluence}
            disabled={!selectedConfluence}
            style={{ height: 36, paddingLeft: 12, paddingRight: 12, borderRadius: 6, border: `1px solid ${!selectedConfluence ? BD : AMBER_BD}`, background: !selectedConfluence ? 'transparent' : AMBER_DIM, color: !selectedConfluence ? T3 : AMBER, fontSize: 12, fontWeight: 600, cursor: !selectedConfluence ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={13} /> Add
          </button>
        </div>
        {confluences.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {confluences.map((c, i) => (
              <span key={`${c}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, border: `1px solid ${AMBER_BD}`, background: AMBER_DIM, fontSize: 11, color: AMBER }}>
                {c}
                <button type="button" onClick={() => removeConfluence(i)} aria-label={`Remove ${c}`} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: AMBER, display: 'flex', alignItems: 'center' }}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 11, color: T3 }}>Pick confirmations that were present when you entered this trade.</p>
        )}
      </div>

      {/* â”€â”€ Row 4: Notes (full width, 3-col internal) â”€â”€ */}
      <div style={panel}>
        <SectionLabel>Notes</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Pre-trade Thesis â€” 3 col */}
          <div style={sub}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#34d399' }}>Pre-trade Thesis</p>
              <p style={{ fontSize: 11, color: T3 }}>Capture setup logic before outcome bias creeps in.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label className="label">Setup Thesis</label>
                <textarea className="input-field resize-none" rows={2} value={thesisSetup} onChange={e => setThesisSetup(e.target.value)} placeholder="What edge did you see?" />
              </div>
              <div>
                <label className="label">Invalidation</label>
                <textarea className="input-field resize-none" rows={2} value={thesisInvalidation} onChange={e => setThesisInvalidation(e.target.value)} placeholder="What would prove this wrong?" />
              </div>
              <div>
                <label className="label">Execution Trigger</label>
                <textarea className="input-field resize-none" rows={2} value={thesisTrigger} onChange={e => setThesisTrigger(e.target.value)} placeholder="What had to happen before entry?" />
              </div>
            </div>
          </div>

          {/* Process Grade + Reflection side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={sub}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: T2 }}>Process Grade</p>
                <p style={{ fontSize: 11, color: T3 }}>Rate quality, not P&amp;L.</p>
              </div>
              <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                {[1, 2, 3, 4, 5].map(score => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setProcessScore(score)}
                    style={processScore === score
                      ? { flex: 1, height: 30, borderRadius: 5, border: `1px solid ${AMBER_BD}`, background: AMBER_DIM, color: AMBER, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
                      : { flex: 1, height: 30, borderRadius: 5, border: `1px solid ${BD}`, background: 'transparent', color: T2, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <textarea className="input-field resize-none" rows={2} value={processReason} onChange={e => setProcessReason(e.target.value)} placeholder="Why this score?" />
            </div>

            <div style={sub}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: AMBER }}>Additional Notes</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea className="input-field resize-none" rows={2} value={form.pre_trade_notes || ''} onChange={e => set('pre_trade_notes', e.target.value)} placeholder="Additional pre-trade observations." />
                <textarea className="input-field resize-none" rows={2} value={form.post_trade_notes || ''} onChange={e => set('post_trade_notes', e.target.value)} placeholder="Additional post-trade notes." />
              </div>
            </div>
          </div>

          {/* Reflection â€” 3 col */}
          <div style={sub}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: AMBER }}>Reflection</p>
              <p style={{ fontSize: 11, color: T3 }}>Force specific learning after the trade.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label className="label">Market vs Thesis</label>
                <textarea className="input-field resize-none" rows={2} value={reflectionMarket} onChange={e => setReflectionMarket(e.target.value)} placeholder="Did price confirm or reject your thesis?" />
              </div>
              <div>
                <label className="label">Execution Quality</label>
                <textarea className="input-field resize-none" rows={2} value={reflectionExecution} onChange={e => setReflectionExecution(e.target.value)} placeholder="What did you do well or poorly?" />
              </div>
              <div>
                <label className="label">One Next Adjustment</label>
                <textarea className="input-field resize-none" rows={2} value={reflectionAdjustment} onChange={e => setReflectionAdjustment(e.target.value)} placeholder="What single change will you test next?" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Actions â”€â”€ */}
      {(submitError || requiredFieldsMessage) && (
        <p style={{ fontSize: 12, color: requiredFieldsMessage && !submitError ? AMBER : '#f87171' }}>
          {submitError || requiredFieldsMessage}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${BD}`, paddingTop: 10 }}>
        <button
          type="submit"
          disabled={!canSubmit}
          title={requiredFieldsMessage || undefined}
          style={{
            flex: 1, height: 38, borderRadius: 6,
            border: `1px solid ${canSubmit ? 'transparent' : BD}`,
            background: canSubmit ? AMBER : P2,
            color: canSubmit ? '#000' : T3,
            fontSize: 13, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {isLoading ? 'Saving...' : 'Save Trade'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ height: 38, paddingLeft: 16, paddingRight: 16, borderRadius: 6, border: `1px solid ${BD}`, background: 'transparent', color: T2, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```


---
## FILE: frontend/src/pages/TradeScanner.tsx
```ts
import { type ChangeEvent, type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight, Expand, Image as ImageIcon, Search, Trash2, X } from 'lucide-react';
import TradeForm from '../components/scanner/TradeForm.js';
import { buildScannerAssets } from '../components/scanner/ScreenshotImportModal.js';
import { useTrades } from '../hooks/useTrades.js';
import { useAppSettings } from '../contexts/AppSettingsContext.js';
import { lookupContract } from '../constants/futuresContracts.js';
import { aiApi } from '../services/api.js';
import { Trade } from '../types/index.js';
import { formatRiskRewardRatio } from '../utils/riskReward.js';
import { withScannerColorContext } from '../utils/scannerColors.js';

export type FlyxaJournalDirection = 'LONG' | 'SHORT';
export type FlyxaJournalRuleState = 'ok' | 'fail' | 'unchecked';
export type FlyxaEmotionTone = 's-g' | 's-a' | 's-r';

export interface FlyxaJournalTrade {
  id: string;
  symbol: string;
  direction: FlyxaJournalDirection;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  cents: number;
  rr: number;
  pnl: number;
  status?: 'win' | 'loss' | 'open';
  screenshotUrl?: string;
}

export interface FlyxaJournalReflection {
  pre: string;
  post: string;
  lessons: string;
}

export interface FlyxaJournalRule {
  id: string;
  label: string;
  state: FlyxaJournalRuleState;
}

export interface FlyxaJournalPsychology {
  setupQuality: number;
  setupQualityNote: string;
  discipline: number;
  disciplineNote: string;
  execution: number;
  executionNote: string;
}

export interface FlyxaJournalEmotion {
  label: string;
  tone: FlyxaEmotionTone;
}

export interface FlyxaJournalEntry {
  date: string;
  pnl: number;
  grade: string;
  trades: FlyxaJournalTrade[];
  screenshots?: string[];
  reflection: FlyxaJournalReflection;
  rules: FlyxaJournalRule[];
  psychology: FlyxaJournalPsychology;
  emotions: FlyxaJournalEmotion[];
}

export interface FlyxaJournalAccount {
  name: string;
  type: 'live' | 'eval' | 'paper';
}

export interface FlyxaJournalPageProps {
  date?: string;
  entries?: FlyxaJournalEntry[];
  account?: FlyxaJournalAccount;
  tradesById?: Record<string, Trade>;
  initialTradeId?: string;
  forceImportPrompt?: boolean;
  onDeleteTrade?: (tradeId: string) => Promise<void> | void;
  onUpdateTrade?: (tradeId: string, data: Partial<Trade>) => Promise<void> | void;
  onImportFirstTradeImage?: (file: File) => void;
  isImportingFirstTrade?: boolean;
  firstTradeImportError?: string | null;
}

type ReflectionTab = 'pre' | 'post' | 'lessons';
type DayFilter = 'all' | 'win' | 'loss' | 'untagged';

const DEFAULT_ACCOUNT: FlyxaJournalAccount = {
  name: 'Apex Funded',
  type: 'live',
};

const STATE_OF_MIND_TAGS = [
  'Focused',
  'Calm',
  'Patient',
  'Slightly rushed',
  'Confident',
  'Hesitant',
  'Overconfident',
  'Revenge trading',
  'FOMO',
  'In the zone',
  'Distracted',
  'Anxious',
];

const DEFAULT_RULES: FlyxaJournalRule[] = [
  { id: 'r1', label: 'Followed daily loss limit', state: 'ok' },
  { id: 'r2', label: 'Only traded A/B setups', state: 'ok' },
  { id: 'r3', label: 'Respected position sizing rules', state: 'fail' },
  { id: 'r4', label: 'No trading during lunch window', state: 'ok' },
  { id: 'r5', label: 'Stopped after 3 consecutive losses', state: 'unchecked' },
];

const DEFAULT_ENTRIES: FlyxaJournalEntry[] = [
  {
    date: '2025-04-18',
    pnl: 620,
    grade: 'A',
    trades: [
      {
        id: 't-418-1',
        symbol: 'NQ',
        direction: 'LONG',
        entryTime: '09:37',
        exitTime: '09:52',
        entryPrice: 18244.25,
        exitPrice: 18258.75,
        cents: 1450,
        rr: 2.3,
        pnl: 430,
        status: 'win',
      },
      {
        id: 't-418-2',
        symbol: 'ES',
        direction: 'LONG',
        entryTime: '10:16',
        exitTime: '10:29',
        entryPrice: 5207.5,
        exitPrice: 5211.25,
        cents: 375,
        rr: 1.4,
        pnl: 190,
        status: 'win',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Waited for reclaim at VWAP and only took continuation setups. Felt composed and patient through chop.',
      lessons: 'Sizing stayed clean today. Continue avoiding second entries in weak ranges.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 4,
      setupQualityNote: 'good A/B setups',
      discipline: 3,
      disciplineNote: 'sized up on trade 2',
      execution: 2.5,
      executionNote: 'early entry on NQ',
    },
    emotions: [
      { label: 'Focused', tone: 's-g' },
      { label: 'Calm', tone: 's-g' },
      { label: 'Slightly rushed', tone: 's-a' },
    ],
  },
  {
    date: '2025-04-17',
    pnl: 240,
    grade: 'B',
    trades: [
      {
        id: 't-417-1',
        symbol: 'ES',
        direction: 'LONG',
        entryTime: '09:45',
        exitTime: '10:01',
        entryPrice: 5204.5,
        exitPrice: 5208,
        cents: 350,
        rr: 1.1,
        pnl: 140,
        status: 'win',
      },
      {
        id: 't-417-2',
        symbol: 'NQ',
        direction: 'SHORT',
        entryTime: '10:35',
        exitTime: '10:47',
        entryPrice: 18270,
        exitPrice: 18266,
        cents: 400,
        rr: 1.2,
        pnl: 100,
        status: 'win',
      },
      {
        id: 't-417-3',
        symbol: 'NQ',
        direction: 'LONG',
        entryTime: '11:12',
        exitTime: '11:24',
        entryPrice: 18280.5,
        exitPrice: 18277,
        cents: -350,
        rr: 0.6,
        pnl: -110,
        status: 'loss',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Decent process. Took one avoidable long after momentum faded.',
      lessons: 'Respect end-of-move context before pressing continuation.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 3.5,
      setupQualityNote: 'mostly clean setups',
      discipline: 3,
      disciplineNote: 'minor impulse re-entry',
      execution: 3,
      executionNote: 'entries were mostly on trigger',
    },
    emotions: [{ label: 'Patient', tone: 's-g' }],
  },
  {
    date: '2025-04-16',
    pnl: -310,
    grade: 'C',
    trades: [
      {
        id: 't-416-1',
        symbol: 'NQ',
        direction: 'LONG',
        entryTime: '09:33',
        exitTime: '09:39',
        entryPrice: 18230,
        exitPrice: 18224.75,
        cents: -525,
        rr: -1,
        pnl: -210,
        status: 'loss',
      },
      {
        id: 't-416-2',
        symbol: 'ES',
        direction: 'SHORT',
        entryTime: '10:03',
        exitTime: '10:15',
        entryPrice: 5198.5,
        exitPrice: 5200.5,
        cents: -200,
        rr: -0.7,
        pnl: -100,
        status: 'loss',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Forced early entries and ignored confirmation. Emotional urgency was high.',
      lessons: 'No first 5-minute breakout trades without retest confirmation.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 2.5,
      setupQualityNote: 'B setups skipped, weak setups chased',
      discipline: 2,
      disciplineNote: 'broke size limits twice',
      execution: 2,
      executionNote: 'entries were rushed',
    },
    emotions: [
      { label: 'Revenge trading', tone: 's-r' },
      { label: 'Anxious', tone: 's-r' },
      { label: 'FOMO', tone: 's-a' },
    ],
  },
  {
    date: '2025-04-14',
    pnl: 95,
    grade: 'B',
    trades: [
      {
        id: 't-414-1',
        symbol: 'ES',
        direction: 'LONG',
        entryTime: '09:51',
        exitTime: '10:07',
        entryPrice: 5189,
        exitPrice: 5191,
        cents: 200,
        rr: 1.15,
        pnl: 95,
        status: 'win',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Single clean trade and stopped. Felt controlled.',
      lessons: 'One-trade days are fine when edge is thin.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 4,
      setupQualityNote: 'one clean setup',
      discipline: 4,
      disciplineNote: 'stopped after target',
      execution: 3.5,
      executionNote: 'execution was stable',
    },
    emotions: [{ label: 'In the zone', tone: 's-g' }],
  },
  {
    date: '2025-04-11',
    pnl: -45,
    grade: 'C',
    trades: [
      {
        id: 't-411-1',
        symbol: 'NQ',
        direction: 'SHORT',
        entryTime: '09:39',
        exitTime: '09:44',
        entryPrice: 18195,
        exitPrice: 18196,
        cents: -100,
        rr: -0.4,
        pnl: -45,
        status: 'loss',
      },
      {
        id: 't-411-2',
        symbol: 'NQ',
        direction: 'SHORT',
        entryTime: '10:02',
        exitTime: '10:18',
        entryPrice: 18188.5,
        exitPrice: 18188.5,
        cents: 0,
        rr: 0,
        pnl: 0,
        status: 'open',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Low quality day. Took entries without clear structure.',
      lessons: 'Skip open when range context is unclear.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 2.5,
      setupQualityNote: 'mixed context quality',
      discipline: 2.5,
      disciplineNote: 'hesitant exits',
      execution: 2,
      executionNote: 'late and reactive entries',
    },
    emotions: [{ label: 'Distracted', tone: 's-a' }],
  },
  {
    date: '2025-04-08',
    pnl: 480,
    grade: 'A+',
    trades: [
      {
        id: 't-408-1',
        symbol: 'NQ',
        direction: 'LONG',
        entryTime: '09:48',
        exitTime: '10:06',
        entryPrice: 18145,
        exitPrice: 18156.5,
        cents: 1150,
        rr: 2.1,
        pnl: 480,
        status: 'win',
      },
    ],
    screenshots: ['', '', ''],
    reflection: {
      pre: 'Game plan, key levels, bias, setups you are watching...',
      post: 'Great execution and pacing. Followed trigger exactly.',
      lessons: 'Keep prioritizing confirmation over anticipation.',
    },
    rules: DEFAULT_RULES,
    psychology: {
      setupQuality: 4.5,
      setupQualityNote: 'A setup right after open pullback',
      discipline: 4,
      disciplineNote: 'sized correctly and stopped trading',
      execution: 4,
      executionNote: 'clean trigger and exit',
    },
    emotions: [
      { label: 'Focused', tone: 's-g' },
      { label: 'Confident', tone: 's-g' },
    ],
  },
];

function parseIsoDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function monthStart(value: string): Date {
  const parsed = parseIsoDate(value);
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
}

function toCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  });
}

function toPercent(value: number): string {
  if (!Number.isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
}

function toR(value: number): string {
  return formatRiskRewardRatio(value, {
    includeSign: true,
    placeholder: '0 RR',
  });
}

function formatDayTitle(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parseIsoDate(date));
}

function formatWeekdayShort(date: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parseIsoDate(date));
}

function formatMonthLabel(monthCursor: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(monthCursor);
}

function getTradeOutcome(trade: FlyxaJournalTrade): 'win' | 'loss' | 'open' {
  if (trade.status) return trade.status;
  if (trade.pnl > 0) return 'win';
  if (trade.pnl < 0) return 'loss';
  return 'open';
}

function getGradeTone(grade: string): 'g' | 'a' | 'r' {
  if (grade.startsWith('A')) return 'g';
  if (grade.startsWith('B')) return 'a';
  return 'r';
}

function isSameMonth(dateValue: string, monthCursor: Date): boolean {
  const parsed = parseIsoDate(dateValue);
  return (
    parsed.getFullYear() === monthCursor.getFullYear()
    && parsed.getMonth() === monthCursor.getMonth()
  );
}

function getAccountTypeLabel(type: FlyxaJournalAccount['type']): string {
  if (type === 'live') return 'Live';
  if (type === 'eval') return 'Eval';
  return 'Paper';
}

function getPnLColor(value: number): string {
  if (value > 0) return 'var(--green)';
  if (value < 0) return 'var(--red)';
  return 'var(--amber)';
}

const SCAN_SYMBOL_MAP: Record<string, string> = {
  NQM26: 'NQ', NQH26: 'NQ', NQU26: 'NQ', NQZ26: 'NQ',
  ESM26: 'ES', ESH26: 'ES', ESU26: 'ES', ESZ26: 'ES',
  MNQM26: 'MNQ', MNQH26: 'MNQ', MNQU26: 'MNQ', MNQZ26: 'MNQ',
  MESM26: 'MES', MESH26: 'MES', MESU26: 'MES', MESZ26: 'MES',
};

const INTERNAL_SCAN_WARNINGS = new Set([
  'Exact price-label review failed, so price levels relied on the broader chart reads.',
  'Exit verification failed â€” relying on manual chart read.',
  'Exit verification failed, so the final answer relied on the manual chart read.',
  'Stop/target sanity check failed, so the final answer relied on the broader exit review.',
  'Header symbol/timeframe read failed, so identity relied on the broader chart reads.',
  'Primary chart extraction failed, so the scanner fell back to the human-style review pass.',
  'Human-style review failed, so the scanner relied on the primary extraction pass.',
  'Final consensus review failed, so the result relied on the primary extraction passes.',
  'Sanity check failed â€” relying on exit verification result.',
]);

type ScannerExtraction = Awaited<ReturnType<typeof aiApi.scanChart>>;

function filterScanWarnings(warnings: string[] | undefined): string[] {
  if (!Array.isArray(warnings)) return [];
  return warnings.filter(msg => !INTERNAL_SCAN_WARNINGS.has(msg));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toScanTime(value: string | null | undefined): string {
  if (!value) return '';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function resolveScanSymbol(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (!upper || ['UNKNOWN', 'UNKWN', 'N/A', 'NA', 'NONE', 'NULL'].includes(upper)) return null;
  return SCAN_SYMBOL_MAP[upper] ?? upper;
}

function inferSymbolFromFileName(fileName: string): string | null {
  const upper = fileName.toUpperCase();
  const match = upper.match(/(?:^|[^A-Z0-9])(MNQ|MES|NQ|ES|MYM|YM|M2K|RTY|CL|MCL|GC|MGC|SI|SIL|6E)(?=[^A-Z0-9]|$)/);
  return match ? match[1] : null;
}

function resolveExitReason(extracted: {
  exit_reason?: 'TP' | 'SL' | null;
  pnl_result?: 'Win' | 'Loss' | null;
}): 'TP' | 'SL' | null {
  if (extracted.exit_reason === 'TP' || extracted.exit_reason === 'SL') return extracted.exit_reason;
  if (extracted.pnl_result === 'Win') return 'TP';
  if (extracted.pnl_result === 'Loss') return 'SL';
  return null;
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNowTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      if (typeof event.target?.result === 'string') {
        resolve(event.target.result);
        return;
      }
      reject(new Error('Failed to read image file'));
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function buildTradePatchFromScan(options: {
  extracted: ScannerExtraction;
  fileName: string;
  baseTrade?: Partial<Trade>;
  fallbackDate: string;
  fallbackTime: string;
  accountId?: string;
  screenshotDataUrl?: string;
}): {
  patch: Partial<Trade>;
  aiFields: Set<string>;
  warnings: string[];
  evidence: string;
} {
  const { extracted, fileName, baseTrade, fallbackDate, fallbackTime, accountId, screenshotDataUrl } = options;
  const aiFields = new Set<string>();
  const patch: Partial<Trade> = {
    ...(baseTrade ?? {}),
    accountId: accountId ?? baseTrade?.accountId ?? baseTrade?.account_id,
    trade_date: baseTrade?.trade_date || fallbackDate,
    trade_time: baseTrade?.trade_time || fallbackTime,
    contract_size: Math.max(1, Number(baseTrade?.contract_size ?? 1)),
  };

  if (screenshotDataUrl) {
    patch.screenshot_url = screenshotDataUrl;
  }

  const extractedSymbol = resolveScanSymbol(extracted.symbol);
  const symbol = extractedSymbol ?? inferSymbolFromFileName(fileName) ?? patch.symbol ?? null;
  if (symbol) {
    patch.symbol = symbol;
    if (extractedSymbol) {
      aiFields.add('symbol');
    }
    const contract = lookupContract(symbol);
    if (contract) {
      patch.point_value = contract.point_value;
    }
  }

  if (extracted.direction) {
    patch.direction = extracted.direction;
    aiFields.add('direction');
  }
  if (isFiniteNumber(extracted.entry_price)) {
    patch.entry_price = Number(extracted.entry_price);
    aiFields.add('entry_price');
  }
  if (isFiniteNumber(extracted.sl_price)) {
    patch.sl_price = Number(extracted.sl_price);
    aiFields.add('sl_price');
  }
  if (isFiniteNumber(extracted.tp_price)) {
    patch.tp_price = Number(extracted.tp_price);
    aiFields.add('tp_price');
  }

  const resolvedExitReason = resolveExitReason(extracted);
  if (resolvedExitReason) {
    patch.exit_reason = resolvedExitReason;
    patch.exit_price = resolvedExitReason === 'TP'
      ? Number(extracted.tp_price ?? patch.tp_price ?? 0)
      : Number(extracted.sl_price ?? patch.sl_price ?? 0);
    aiFields.add('exit_reason');
  }

  const extractedTime = toScanTime(extracted.entry_time);
  if (extractedTime) {
    patch.trade_time = extractedTime;
    aiFields.add('trade_time');
  }

  if (isFiniteNumber(extracted.trade_length_seconds)) {
    patch.trade_length_seconds = Number(extracted.trade_length_seconds);
    aiFields.add('trade_length_seconds');
  }
  if (isFiniteNumber(extracted.candle_count)) {
    patch.candle_count = Number(extracted.candle_count);
  }
  if (isFiniteNumber(extracted.timeframe_minutes)) {
    patch.timeframe_minutes = Number(extracted.timeframe_minutes);
  }

  return {
    patch,
    aiFields,
    warnings: filterScanWarnings(extracted.warnings),
    evidence: extracted.first_touch_evidence ?? '',
  };
}

function toJournalDirection(direction: Trade['direction']): FlyxaJournalDirection {
  return direction === 'Short' ? 'SHORT' : 'LONG';
}

function toClockTime(value: string | undefined): string {
  if (!value) return '00:00';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '00:00';
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function addSecondsToTime(time: string, seconds: number | undefined): string {
  const [hours, minutes] = toClockTime(time).split(':').map(Number);
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds as number)) : 0;
  const total = ((hours * 3600) + (minutes * 60) + safeSeconds) % 86400;
  const outHours = Math.floor(total / 3600);
  const outMinutes = Math.floor((total % 3600) / 60);
  return `${String(outHours).padStart(2, '0')}:${String(outMinutes).padStart(2, '0')}`;
}

function getTradeStatus(trade: Trade): FlyxaJournalTrade['status'] {
  if (trade.exit_reason === 'TP') return 'win';
  if (trade.exit_reason === 'SL') return 'loss';
  return 'open';
}

function getTradeR(trade: Trade): number {
  const risk = Math.abs(trade.entry_price - trade.sl_price);
  if (!Number.isFinite(risk) || risk <= 0) return 0;
  const reward = trade.direction === 'Long'
    ? trade.exit_price - trade.entry_price
    : trade.entry_price - trade.exit_price;
  return Number((reward / risk).toFixed(2));
}

function getDayGrade(totalPnl: number, winRate: number): string {
  if (totalPnl > 0 && winRate >= 70) return 'A';
  if (totalPnl > 0 && winRate >= 50) return 'B';
  if (totalPnl >= 0) return 'B-';
  if (winRate >= 50) return 'C';
  return 'D';
}

function getEmotionLabel(state: Trade['emotional_state'] | undefined): string {
  if (!state) return 'Focused';
  if (state === 'Revenge Trading') return 'Revenge trading';
  return state;
}

function getEmotionTone(state: Trade['emotional_state'] | undefined): FlyxaEmotionTone {
  if (state === 'Calm' || state === 'Confident') return 's-g';
  if (state === 'FOMO' || state === 'Overconfident') return 's-a';
  return 's-r';
}

function toJournalEntries(trades: Trade[]): FlyxaJournalEntry[] {
  if (trades.length === 0) return [];

  const byDate = new Map<string, Trade[]>();
  trades.forEach(trade => {
    const fallbackDate = typeof trade.created_at === 'string'
      ? trade.created_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(trade.trade_date) ? trade.trade_date : fallbackDate;
    const existing = byDate.get(dateKey);
    if (existing) {
      existing.push(trade);
    } else {
      byDate.set(dateKey, [trade]);
    }
  });

  const entries: FlyxaJournalEntry[] = [];
  byDate.forEach((dayTradesRaw, dateKey) => {
    const dayTrades = [...dayTradesRaw].sort((a, b) => toClockTime(a.trade_time).localeCompare(toClockTime(b.trade_time)));

    const mappedTrades: FlyxaJournalTrade[] = dayTrades.map(trade => {
      const entryTime = toClockTime(trade.trade_time);
      const exitTime = addSecondsToTime(entryTime, trade.trade_length_seconds);
      const signedMove = trade.direction === 'Long'
        ? trade.exit_price - trade.entry_price
        : trade.entry_price - trade.exit_price;

      return {
        id: trade.id,
        symbol: trade.symbol,
        direction: toJournalDirection(trade.direction),
        entryTime,
        exitTime,
        entryPrice: trade.entry_price,
        exitPrice: trade.exit_price,
        cents: Math.round(signedMove * 100),
        rr: getTradeR(trade),
        pnl: trade.pnl,
        status: getTradeStatus(trade),
        screenshotUrl: trade.screenshot_url,
      };
    });

    const dayPnl = mappedTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const wins = mappedTrades.filter(trade => trade.status === 'win').length;
    const winRate = mappedTrades.length > 0 ? (wins / mappedTrades.length) * 100 : 0;
    const grade = getDayGrade(dayPnl, winRate);

    const screenshots = dayTrades
      .map(trade => trade.screenshot_url?.trim() ?? '')
      .filter(url => url.length > 0)
      .slice(0, 3);

    const firstPre = dayTrades
      .map(trade => trade.pre_trade_notes?.trim() ?? '')
      .find(note => note.length > 0);
    const firstPost = dayTrades
      .map(trade => trade.post_trade_notes?.trim() ?? '')
      .find(note => note.length > 0);

    const confidenceValues = dayTrades
      .map(trade => trade.confidence_level)
      .filter((value): value is number => Number.isFinite(value));
    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 7;
    const avgScore5 = Number(Math.min(5, Math.max(1, avgConfidence / 2)).toFixed(1));
    const followedPlanCount = dayTrades.filter(trade => Boolean(trade.followed_plan)).length;
    const followedPlanRatio = dayTrades.length > 0 ? followedPlanCount / dayTrades.length : 0;
    const disciplineScore = Number((1 + (followedPlanRatio * 4)).toFixed(1));
    const executionScore = Number((1 + ((winRate / 100) * 4)).toFixed(1));

    const emotionByLabel = new Map<string, FlyxaEmotionTone>();
    dayTrades.forEach(trade => {
      const label = getEmotionLabel(trade.emotional_state);
      if (!emotionByLabel.has(label)) {
        emotionByLabel.set(label, getEmotionTone(trade.emotional_state));
      }
    });

    entries.push({
      date: dateKey,
      pnl: dayPnl,
      grade,
      trades: mappedTrades,
      screenshots,
      reflection: {
        pre: firstPre ?? 'Game plan, key levels, bias, setups you are watching...',
        post: firstPost ?? 'Session complete. Log your process review and execution quality.',
        lessons: dayPnl >= 0
          ? 'Execution held up. Keep repeating your highest-quality setups.'
          : 'Protect capital first. Tighten selection and avoid low-quality entries.',
      },
      rules: [
        {
          id: `plan-${dateKey}`,
          label: 'Followed daily game plan',
          state: followedPlanRatio >= 0.8 ? 'ok' : followedPlanRatio <= 0.3 ? 'fail' : 'unchecked',
        },
        { id: `setups-${dateKey}`, label: 'Only traded A/B setups', state: 'unchecked' },
        { id: `risk-${dateKey}`, label: 'Respected position sizing rules', state: 'unchecked' },
      ],
      psychology: {
        setupQuality: avgScore5,
        setupQualityNote: `${dayTrades.length} trade${dayTrades.length === 1 ? '' : 's'} reviewed`,
        discipline: disciplineScore,
        disciplineNote: `${followedPlanCount}/${dayTrades.length} followed plan`,
        execution: executionScore,
        executionNote: `${wins}/${dayTrades.length} reached target`,
      },
      emotions: Array.from(emotionByLabel.entries()).map(([label, tone]) => ({ label, tone })),
    });
  });

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

const JOURNAL_THEME = {
  '--bg': 'var(--app-bg)',
  '--surface-1': 'var(--app-panel)',
  '--surface-2': 'var(--app-panel-strong)',
  '--surface-3': 'rgba(255,255,255,0.08)',
  '--border': 'var(--app-border)',
  '--border-sub': 'rgba(255,255,255,0.05)',
  '--txt': 'var(--app-text)',
  '--txt-2': 'var(--app-text-muted)',
  '--txt-3': 'var(--app-text-subtle)',
  '--cobalt': '#6EA8FE',
  '--cobalt-dim': 'rgba(110,168,254,0.14)',
  '--green': '#34D399',
  '--green-dim': 'rgba(52,211,153,0.14)',
  '--amber': '#FBBF24',
  '--amber-dim': 'rgba(251,191,36,0.14)',
  '--red': '#F87171',
  '--red-dim': 'rgba(248,113,113,0.14)',
} as React.CSSProperties;

export function FlyxaJournalPage({
  date,
  entries = DEFAULT_ENTRIES,
  account = DEFAULT_ACCOUNT,
  tradesById = {},
  initialTradeId,
  forceImportPrompt = false,
  onDeleteTrade,
  onUpdateTrade,
  onImportFirstTradeImage,
  isImportingFirstTrade = false,
  firstTradeImportError = null,
}: FlyxaJournalPageProps) {
  const [entriesState, setEntriesState] = useState<FlyxaJournalEntry[]>(entries);
  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);
  const [firstTradeDropActive, setFirstTradeDropActive] = useState(false);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<Partial<Trade> | null>(null);
  const [editorInitialData, setEditorInitialData] = useState<Partial<Trade> | null>(null);
  const [editorImagePreview, setEditorImagePreview] = useState<string | null>(null);
  const [editorAiFields, setEditorAiFields] = useState<Set<string>>(new Set());
  const [editorWarnings, setEditorWarnings] = useState<string[]>([]);
  const [editorScanEvidence, setEditorScanEvidence] = useState('');
  const [editorScanError, setEditorScanError] = useState('');
  const [editorScanning, setEditorScanning] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorDropActive, setEditorDropActive] = useState(false);
  const [showImportPrompt, setShowImportPrompt] = useState(forceImportPrompt);
  const [fullscreenTradeImage, setFullscreenTradeImage] = useState<{ src: string; title: string } | null>(null);
  const firstTradeFileInputRef = useRef<HTMLInputElement>(null);
  const editorFileInputRef = useRef<HTMLInputElement>(null);

  const openFullscreenTradeImage = (imageUrl: string | null | undefined, title: string) => {
    const normalized = imageUrl?.trim() ?? '';
    if (!normalized) return;
    setFullscreenTradeImage({ src: normalized, title });
  };

  useEffect(() => {
    setEntriesState(entries);
  }, [entries]);

  useEffect(() => {
    setShowImportPrompt(forceImportPrompt);
  }, [forceImportPrompt]);

  const sortedEntries = useMemo(
    () => [...entriesState].sort((a, b) => b.date.localeCompare(a.date)),
    [entriesState]
  );

  const preferredDate = useMemo(() => {
    if (date && sortedEntries.some(entry => entry.date === date)) return date;
    return sortedEntries[0]?.date ?? new Date().toISOString().slice(0, 10);
  }, [date, sortedEntries]);

  const [monthCursor, setMonthCursor] = useState<Date>(() => monthStart(preferredDate));
  const [activeDate, setActiveDate] = useState<string>(preferredDate);
  const [searchTerm, setSearchTerm] = useState('');
  const [dayFilter, setDayFilter] = useState<DayFilter>('all');
  const [activeTab, setActiveTab] = useState<ReflectionTab>('pre');
  const [reflectionByDate, setReflectionByDate] = useState<Record<string, FlyxaJournalReflection>>(() =>
    sortedEntries.reduce<Record<string, FlyxaJournalReflection>>((acc, entry) => {
      acc[entry.date] = entry.reflection;
      return acc;
    }, {})
  );

  useEffect(() => {
    setReflectionByDate(current => {
      const next = { ...current };
      sortedEntries.forEach(entry => {
        if (!next[entry.date]) next[entry.date] = entry.reflection;
      });
      return next;
    });
  }, [sortedEntries]);

  useEffect(() => {
    if (!sortedEntries.some(entry => entry.date === activeDate)) {
      setActiveDate(preferredDate);
    }
  }, [sortedEntries, activeDate, preferredDate]);

  useEffect(() => {
    if (date && sortedEntries.some(entry => entry.date === date)) {
      setActiveDate(date);
      setMonthCursor(monthStart(date));
    }
  }, [date, sortedEntries]);

  const monthEntries = useMemo(
    () => sortedEntries.filter(entry => isSameMonth(entry.date, monthCursor)),
    [sortedEntries, monthCursor]
  );

  const dayListEntries = useMemo(() => {
    const loweredSearch = searchTerm.trim().toLowerCase();

    return monthEntries.filter(entry => {
      const tagged = entry.emotions.length > 0;
      if (dayFilter === 'win' && entry.pnl <= 0) return false;
      if (dayFilter === 'loss' && entry.pnl >= 0) return false;
      if (dayFilter === 'untagged' && tagged) return false;

      if (!loweredSearch) return true;

      const searchable = [
        formatDayTitle(entry.date),
        entry.grade,
        ...entry.trades.map(trade => trade.symbol),
      ].join(' ').toLowerCase();

      return searchable.includes(loweredSearch);
    });
  }, [monthEntries, searchTerm, dayFilter]);

  useEffect(() => {
    if (dayListEntries.length === 0) return;
    if (!dayListEntries.some(entry => entry.date === activeDate)) {
      setActiveDate(dayListEntries[0].date);
    }
  }, [dayListEntries, activeDate]);

  const activeEntry = useMemo(
    () => sortedEntries.find(entry => entry.date === activeDate) ?? sortedEntries[0] ?? null,
    [sortedEntries, activeDate]
  );

  const activeReflection = activeEntry
    ? (reflectionByDate[activeEntry.date] ?? activeEntry.reflection)
    : null;
  const shouldShowImportPrompt = showImportPrompt || !activeEntry;

  useEffect(() => {
    if (!activeEntry || activeEntry.trades.length === 0) {
      setSelectedTradeId(null);
      return;
    }

    if (initialTradeId && activeEntry.trades.some(trade => trade.id === initialTradeId)) {
      setSelectedTradeId(initialTradeId);
      return;
    }

    if (!selectedTradeId || !activeEntry.trades.some(trade => trade.id === selectedTradeId)) {
      setSelectedTradeId(activeEntry.trades[0].id);
    }
  }, [activeEntry, initialTradeId, selectedTradeId]);

  useEffect(() => {
    if (!fullscreenTradeImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullscreenTradeImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenTradeImage]);

  const selectedTrade = useMemo(() => {
    if (!selectedTradeId) return null;
    return tradesById[selectedTradeId] ?? null;
  }, [selectedTradeId, tradesById]);

  useEffect(() => {
    if (!selectedTrade) {
      setEditorDraft(null);
      setEditorImagePreview(null);
      setEditorAiFields(new Set());
      setEditorWarnings([]);
      setEditorScanEvidence('');
      setEditorScanError('');
      return;
    }

    setEditorDraft(selectedTrade);
    setEditorInitialData(selectedTrade);
    setEditorImagePreview(selectedTrade.screenshot_url ?? null);
    setEditorAiFields(new Set());
    setEditorWarnings([]);
    setEditorScanEvidence('');
    setEditorScanError('');
  }, [selectedTrade]);

  const monthSummary = useMemo(() => {
    const monthPnl = monthEntries.reduce((sum, entry) => sum + entry.pnl, 0);
    const monthTrades = monthEntries.flatMap(entry => entry.trades);
    const wins = monthTrades.filter(trade => getTradeOutcome(trade) === 'win').length;
    const winRate = monthTrades.length > 0 ? (wins / monthTrades.length) * 100 : 0;
    const daysTraded = monthEntries.length;
    const bestDay = monthEntries.reduce((best, entry) => Math.max(best, entry.pnl), 0);

    return {
      monthPnl,
      winRate,
      daysTraded,
      bestDay,
    };
  }, [monthEntries]);

  const summaryStats = useMemo(() => {
    if (!activeEntry) {
      return [
        { label: 'P&L', value: '$0', tone: 'var(--txt)' },
        { label: 'Win Rate', value: '0.0%', tone: 'var(--txt)' },
        { label: 'Trades', value: '0', tone: 'var(--txt)' },
        { label: 'Best R:R', value: '0 RR', tone: 'var(--txt)' },
      ];
    }

    const outcomes = activeEntry.trades.map(getTradeOutcome);
    const wins = outcomes.filter(outcome => outcome === 'win').length;
    const winRate = activeEntry.trades.length > 0 ? (wins / activeEntry.trades.length) * 100 : 0;
    const bestR = activeEntry.trades.reduce((best, trade) => Math.max(best, trade.rr), 0);

    return [
      { label: 'P&L', value: toCurrency(activeEntry.pnl), tone: getPnLColor(activeEntry.pnl) },
      { label: 'Win Rate', value: toPercent(winRate), tone: 'var(--txt)' },
      { label: 'Trades', value: String(activeEntry.trades.length), tone: 'var(--txt)' },
      { label: 'Best R:R', value: toR(bestR), tone: 'var(--txt)' },
    ];
  }, [activeEntry]);

  const selectedEmotionTone = useMemo(() => {
    if (!activeEntry) return new Map<string, FlyxaEmotionTone>();
    return new Map(activeEntry.emotions.map(emotion => [emotion.label.toLowerCase(), emotion.tone]));
  }, [activeEntry]);

  const shiftMonth = (direction: -1 | 1) => {
    setMonthCursor(current => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  const handleReflectionChange = (tab: ReflectionTab, value: string) => {
    if (!activeEntry) return;

    setReflectionByDate(current => ({
      ...current,
      [activeEntry.date]: {
        ...(current[activeEntry.date] ?? activeEntry.reflection),
        [tab]: value,
      },
    }));
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!activeEntry || deletingTradeId) return;

    setDeletingTradeId(tradeId);
    try {
      await onDeleteTrade?.(tradeId);
      setEntriesState(current => current
        .map(entry => {
          if (entry.date !== activeEntry.date) return entry;
          const nextTrades = entry.trades.filter(trade => trade.id !== tradeId);
          const nextPnl = nextTrades.reduce((sum, trade) => sum + trade.pnl, 0);
          return {
            ...entry,
            trades: nextTrades,
            pnl: nextPnl,
          };
        })
        .filter(entry => entry.trades.length > 0));
    } finally {
      setDeletingTradeId(null);
    }
  };

  const handleFirstTradeDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setFirstTradeDropActive(false);
    if (isImportingFirstTrade) {
      return;
    }
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onImportFirstTradeImage?.(file);
    }
  };

  const handleFirstTradeInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (isImportingFirstTrade) {
      event.currentTarget.value = '';
      return;
    }
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    onImportFirstTradeImage?.(file);
  };

  const openFirstTradeFilePicker = () => {
    firstTradeFileInputRef.current?.click();
  };

  const openEditorFilePicker = () => {
    editorFileInputRef.current?.click();
  };

  const resetEditorState = () => {
    if (!selectedTrade) return;
    setEditorDraft(selectedTrade);
    setEditorInitialData(selectedTrade);
    setEditorImagePreview(selectedTrade.screenshot_url ?? null);
    setEditorAiFields(new Set());
    setEditorWarnings([]);
    setEditorScanEvidence('');
    setEditorScanError('');
  };

  const handleEditorScan = async (file: File) => {
    if (!selectedTradeId || editorScanning) {
      return;
    }

    setEditorDropActive(false);
    setEditorScanError('');
    setEditorWarnings([]);
    setEditorScanning(true);
    try {
      const screenshotDataUrl = await toDataUrl(file);
      const baseTrade = editorDraft ?? selectedTrade ?? {};
      const scanDate = baseTrade.trade_date || getTodayDate();
      const scanTime = toScanTime(baseTrade.trade_time) || getNowTime();
      const { focusImages, scannerContext, uploadImage } = await buildScannerAssets(file);
      const extracted = await aiApi.scanChart(
        uploadImage,
        scanDate,
        scanTime,
        focusImages,
        withScannerColorContext(scannerContext ?? undefined)
      );
      const mapped = buildTradePatchFromScan({
        extracted,
        fileName: file.name,
        baseTrade,
        fallbackDate: scanDate,
        fallbackTime: scanTime,
        screenshotDataUrl,
      });

      setEditorImagePreview(screenshotDataUrl);
      setEditorDraft(mapped.patch);
      setEditorInitialData(mapped.patch);
      setEditorAiFields(mapped.aiFields);
      setEditorWarnings(mapped.warnings);
      setEditorScanEvidence(mapped.evidence);
    } catch (error) {
      setEditorScanError(error instanceof Error ? error.message : 'Failed to analyse trade screenshot.');
    } finally {
      setEditorScanning(false);
    }
  };

  const handleEditorDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setEditorDropActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void handleEditorScan(file);
    }
  };

  const handleEditorInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file || !file.type.startsWith('image/')) {
      return;
    }
    void handleEditorScan(file);
  };

  const handleSaveTradeEditor = async (data: Partial<Trade>) => {
    if (!selectedTradeId) {
      return;
    }

    setEditorScanError('');
    setEditorSaving(true);
    try {
      await onUpdateTrade?.(selectedTradeId, {
        ...data,
        screenshot_url: editorImagePreview ?? data.screenshot_url,
      });
      setEditorAiFields(new Set());
    } catch (error) {
      setEditorScanError(error instanceof Error ? error.message : 'Failed to save trade.');
    } finally {
      setEditorSaving(false);
    }
  };

  const monthLabel = formatMonthLabel(monthCursor);
  const showGlobalAnalysisPill = isImportingFirstTrade || editorScanning;

  return (
    <div style={{ ...JOURNAL_THEME, height: '100vh', display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>
      <style>{`
        .flyxa-day-scroll::-webkit-scrollbar { width: 3px; }
        .flyxa-day-scroll::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 3px; }
        .flyxa-entry-scroll::-webkit-scrollbar { width: 4px; }
        .flyxa-entry-scroll::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 4px; }
        .flyxa-search::placeholder,
        .flyxa-reflect::placeholder {
          color: var(--txt-3);
          opacity: 1;
        }
        .flyxa-day-row:hover { background: rgba(255,255,255,0.02); }
        .flyxa-chip:hover { color: var(--txt); border-color: var(--txt-3); }
        .flyxa-trade-card:hover { background: var(--surface-2); }
        .flyxa-shot-slot:hover { border-color: var(--cobalt); color: var(--cobalt); }
        .flyxa-rule-row:hover { background: rgba(255,255,255,0.02); }
        .flyxa-state-tag:hover { border-color: var(--txt-3); color: var(--txt); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .flyxa-btn-log-trade {
          height: 36px;
          border: 1px solid #d89000;
          border-radius: 6px;
          padding: 0 12px;
          background: #f8b318;
          color: #111111;
          font-size: 18px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .flyxa-btn-log-trade:hover { background: #ffbf2f; border-color: #e09a03; }
        .flyxa-btn-primary {
          height: 30px;
          border: 1px solid rgba(110,168,254,0.45);
          border-radius: 6px;
          padding: 0 12px;
          background: rgba(110,168,254,0.18);
          color: #dbeafe;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .flyxa-btn-primary:hover { background: rgba(110,168,254,0.28); }
        .flyxa-btn-delete {
          width: 24px;
          height: 24px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: transparent;
          color: var(--txt-3);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .flyxa-btn-delete:hover {
          color: var(--red);
          border-color: rgba(248,113,113,0.45);
          background: var(--red-dim);
        }
        .flyxa-btn-delete:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        @keyframes analysing-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes analysing-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .flyxa-analysing-pill {
          position: fixed;
          top: 14px;
          right: 18px;
          z-index: 120;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 9px 18px 9px 14px;
          border-radius: 999px;
          border: 1px solid rgba(251,146,60,0.35);
          background: rgba(10,9,9,0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          box-shadow: 0 0 0 1px rgba(251,146,60,0.1), 0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(251,146,60,0.08);
          pointer-events: none;
          animation: analysing-pulse 2s ease-in-out infinite;
        }
        .flyxa-analysing-pill__text {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.01em;
          background: linear-gradient(90deg, #e2e8f0 0%, #fbbf24 45%, #f97316 65%, #e2e8f0 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: analysing-shimmer 3s linear infinite;
        }
        .flyxa-analysing-pill__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f97316;
          box-shadow: 0 0 6px rgba(249,115,22,0.9);
          flex-shrink: 0;
          animation: analysing-pulse 1.2s ease-in-out infinite;
        }
      `}</style>

      {showGlobalAnalysisPill && (
        <div className="flyxa-analysing-pill">
          <span className="flyxa-analysing-pill__dot" />
          <span className="flyxa-analysing-pill__text">Flyxa is analysing your trade</span>
        </div>
      )}

      <aside
        style={{
          width: 256,
          minWidth: 256,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface-1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-sub)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{monthLabel}</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                style={{
                  width: 22,
                  height: 22,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--txt-3)',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onMouseEnter={event => { event.currentTarget.style.color = 'var(--txt)'; }}
                onMouseLeave={event => { event.currentTarget.style.color = 'var(--txt-3)'; }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                style={{
                  width: 22,
                  height: 22,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--txt-3)',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                onMouseEnter={event => { event.currentTarget.style.color = 'var(--txt)'; }}
                onMouseLeave={event => { event.currentTarget.style.color = 'var(--txt-3)'; }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {[
              {
                label: 'Month P&L',
                value: toCurrency(monthSummary.monthPnl),
                tone: monthSummary.monthPnl >= 0 ? 'var(--green)' : 'var(--red)',
              },
              { label: 'Win Rate', value: toPercent(monthSummary.winRate), tone: 'var(--txt)' },
              { label: 'Days Traded', value: String(monthSummary.daysTraded), tone: 'var(--txt)' },
              {
                label: 'Best Day',
                value: toCurrency(monthSummary.bestDay),
                tone: 'var(--green)',
              },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 5,
                  padding: '8px 10px',
                  border: '1px solid var(--border-sub)',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'var(--txt-3)',
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: stat.tone,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderBottom: '1px solid var(--border-sub)', padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={13} color="var(--txt-3)" />
            <input
              className="flyxa-search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search entries..."
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: 'var(--txt)',
                fontSize: 12,
                outline: 'none',
                padding: 0,
              }}
            />
          </div>
        </div>

        <div style={{ borderBottom: '1px solid var(--border-sub)', padding: '8px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'win', label: 'Win days' },
            { key: 'loss', label: 'Loss days' },
            { key: 'untagged', label: 'Untagged' },
          ].map(chip => {
            const selected = dayFilter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                className="flyxa-chip"
                onClick={() => setDayFilter(chip.key as DayFilter)}
                style={{
                  border: `1px solid ${selected ? 'var(--txt-3)' : 'var(--border)'}`,
                  background: selected ? 'var(--surface-3)' : 'transparent',
                  color: selected ? 'var(--txt)' : 'var(--txt-3)',
                  fontSize: 10,
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="flyxa-day-scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {dayListEntries.length === 0 && (
            <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--txt-3)' }}>
              No entries in this view.
            </div>
          )}

          {dayListEntries.map(entry => {
            const active = activeEntry?.date === entry.date;
            const wins = entry.trades.filter(trade => getTradeOutcome(trade) === 'win').length;
            const losses = entry.trades.filter(trade => getTradeOutcome(trade) === 'loss').length;
            const dots = entry.trades.slice(0, 3).map(getTradeOutcome);
            const gradeTone = getGradeTone(entry.grade);
            const gradeBg = gradeTone === 'g'
              ? 'var(--green-dim)'
              : gradeTone === 'a'
                ? 'var(--amber-dim)'
                : 'var(--red-dim)';
            const gradeColor = gradeTone === 'g'
              ? 'var(--green)'
              : gradeTone === 'a'
                ? 'var(--amber)'
                : 'var(--red)';

            return (
              <button
                key={entry.date}
                type="button"
                className="flyxa-day-row"
                onClick={() => setActiveDate(entry.date)}
                style={{
                  width: '100%',
                  border: 'none',
                  borderLeft: `2px solid ${active ? 'var(--cobalt)' : 'transparent'}`,
                  background: active ? 'var(--cobalt-dim)' : 'transparent',
                  color: 'inherit',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '11px 14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 36, textAlign: 'center', flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 19,
                      fontWeight: 600,
                      lineHeight: 1,
                      color: active ? 'var(--cobalt)' : 'var(--txt)',
                    }}
                  >
                    {new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(parseIsoDate(entry.date))}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 9,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: active ? 'rgba(110,168,254,0.55)' : 'var(--txt-3)',
                    }}
                  >
                    {formatWeekdayShort(entry.date)}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      fontWeight: 500,
                      color: getPnLColor(entry.pnl),
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {toCurrency(entry.pnl)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>
                    {`${wins}W Â· ${losses}L Â· ${entry.trades.length} trades`}
                  </div>
                </div>

                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 2,
                      background: gradeBg,
                      color: gradeColor,
                    }}
                  >
                    {entry.grade}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {dots.map((dot, index) => (
                      <span
                        key={`${entry.date}-${index}`}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 999,
                          background:
                            dot === 'win'
                              ? 'var(--green)'
                              : dot === 'loss'
                                ? 'var(--red)'
                                : 'var(--amber)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section style={{ flex: 1, minWidth: 0, overflowY: 'auto' }} className="flyxa-entry-scroll">
        <input
          ref={firstTradeFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFirstTradeInputChange}
        />
        <input
          ref={editorFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleEditorInputChange}
        />
        {activeEntry && activeReflection && !shouldShowImportPrompt && (
          <>
            <header
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                borderBottom: '1px solid var(--border-sub)',
                background: 'var(--bg)',
                padding: '14px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--txt)' }}>{formatDayTitle(activeEntry.date)}</div>
                <div style={{ marginTop: 2, fontSize: 12, color: 'var(--txt-2)' }}>
                  {account.name}
                  <span style={{ margin: '0 6px' }}>Â·</span>
                  {getAccountTypeLabel(account.type)}
                  <span style={{ margin: '0 6px' }}>Â·</span>
                  <span style={{ color: 'var(--amber)', fontWeight: 500 }}>{toCurrency(activeEntry.pnl)}</span>
                  <span style={{ margin: '0 6px' }}>Â·</span>
                  {`Grade ${activeEntry.grade}`}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  className="flyxa-btn-log-trade"
                  onClick={() => setShowImportPrompt(true)}
                  disabled={!onImportFirstTradeImage || isImportingFirstTrade}
                  style={{
                    opacity: onImportFirstTradeImage && !isImportingFirstTrade ? 1 : 0.5,
                    cursor: onImportFirstTradeImage && !isImportingFirstTrade ? 'pointer' : 'not-allowed',
                  }}
                >
                  <ArrowUpRight size={14} strokeWidth={2.5} />
                  Log Trade
                </button>
                <button
                  type="button"
                  className="flyxa-btn-primary"
                  onClick={() => {
                    if (!selectedTradeId || !editorDraft || editorSaving) {
                      return;
                    }
                    void handleSaveTradeEditor(editorDraft);
                  }}
                  disabled={!selectedTradeId || !editorDraft || editorSaving}
                  style={{
                    opacity: !selectedTradeId || !editorDraft || editorSaving ? 0.6 : 1,
                    cursor: !selectedTradeId || !editorDraft || editorSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {editorSaving ? 'Savingâ€¦' : 'Save entry'}
                </button>
              </div>
            </header>

            <div style={{ padding: '20px 24px 40px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 24 }}>
                {summaryStats.map(stat => (
                  <div
                    key={stat.label}
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--txt-3)' }}>
                      {stat.label}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 18,
                        fontWeight: 500,
                        color: stat.tone,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)' }}>
                    Trades
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeEntry.trades.length === 0 ? (
                    <div
                      style={{
                        position: 'relative',
                        background: 'var(--surface-1)',
                        border: firstTradeDropActive
                          ? '1px dashed rgba(59,130,246,0.6)'
                          : '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '24px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'border-color 0.16s, background 0.16s',
                        backgroundColor: firstTradeDropActive ? 'rgba(59,130,246,0.08)' : 'var(--surface-1)',
                      }}
                      onDragOver={event => {
                        if (isImportingFirstTrade) return;
                        event.preventDefault();
                        setFirstTradeDropActive(true);
                      }}
                      onDragLeave={() => setFirstTradeDropActive(false)}
                      onDrop={handleFirstTradeDrop}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          border: firstTradeDropActive
                            ? '1px solid rgba(59,130,246,0.6)'
                            : '1px solid rgba(245,158,11,0.35)',
                          background: firstTradeDropActive
                            ? 'rgba(59,130,246,0.16)'
                            : 'rgba(245,158,11,0.12)',
                          display: 'grid',
                          placeItems: 'center',
                          color: firstTradeDropActive ? '#60a5fa' : 'var(--amber)',
                        }}
                      >
                        <ArrowUpRight size={16} strokeWidth={2.3} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>
                        {firstTradeDropActive ? 'Drop your trade screenshot to analyse' : 'No trades logged for this day'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--txt-3)', textAlign: 'center', maxWidth: 460 }}>
                        {firstTradeDropActive
                          ? 'Flyxa will analyse your chart and save this trade in the background.'
                          : 'Drag and drop your trade image here, or select a file to analyse and add it to your journal.'}
                      </div>
                      {firstTradeImportError && (
                        <div
                          style={{
                            fontSize: 12,
                            color: '#fca5a5',
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(248,113,113,0.35)',
                            borderRadius: 6,
                            padding: '8px 10px',
                            maxWidth: 540,
                          }}
                        >
                          {firstTradeImportError}
                        </div>
                      )}
                      <button
                        type="button"
                        className="flyxa-btn-primary"
                        onClick={openFirstTradeFilePicker}
                        disabled={!onImportFirstTradeImage || isImportingFirstTrade}
                        style={{
                          opacity: onImportFirstTradeImage && !isImportingFirstTrade ? 1 : 0.5,
                          cursor: onImportFirstTradeImage && !isImportingFirstTrade ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Select File
                      </button>
                    </div>
                  ) : activeEntry.trades.map(trade => {
                    const outcome = getTradeOutcome(trade);
                    const selected = trade.id === selectedTradeId;
                    const leftBorderColor =
                      outcome === 'win' ? 'var(--green)' : outcome === 'loss' ? 'var(--red)' : 'var(--amber)';
                    const directionBg = trade.direction === 'LONG' ? 'var(--cobalt-dim)' : 'var(--red-dim)';
                    const directionColor = trade.direction === 'LONG' ? 'var(--cobalt)' : '#FCA5A5';
                    const priceLine = `${trade.entryPrice} -> ${trade.exitPrice} Â· ${trade.cents} cts`;

                    return (
                      <div
                        key={trade.id}
                        className="flyxa-trade-card"
                        onClick={() => setSelectedTradeId(trade.id)}
                        style={{
                          background: 'var(--surface-1)',
                          border: selected
                            ? '1px solid rgba(110,168,254,0.55)'
                            : '1px solid var(--border)',
                          borderRadius: 6,
                          borderLeft: `2px solid ${leftBorderColor}`,
                          padding: '11px 14px',
                          cursor: 'pointer',
                          boxShadow: selected ? '0 0 0 1px rgba(110,168,254,0.2)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              minWidth: 28,
                              fontFamily: 'var(--font-mono)',
                              fontSize: 14,
                              fontWeight: 500,
                              color: 'var(--txt)',
                            }}
                          >
                            {trade.symbol}
                          </div>

                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 3,
                              background: directionBg,
                              color: directionColor,
                            }}
                          >
                            {trade.direction}
                          </span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                color: 'var(--txt-2)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {`${trade.entryTime} -> ${trade.exitTime}`}
                            </div>
                            <div
                              style={{
                                marginTop: 2,
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                color: 'var(--txt-3)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {priceLine}
                            </div>
                          </div>

                          <div
                            style={{
                              minWidth: 48,
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 12,
                              color: 'var(--txt-3)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {toR(trade.rr)}
                          </div>

                          <button
                            type="button"
                            className="flyxa-shot-slot"
                            onClick={event => {
                              event.stopPropagation();
                              const tradeScreenshot = trade.screenshotUrl?.trim() ?? '';
                              if (!tradeScreenshot) return;
                              setSelectedTradeId(trade.id);
                              openFullscreenTradeImage(tradeScreenshot, `${trade.symbol} ${trade.entryTime} screenshot`);
                            }}
                            style={{
                              width: 48,
                              height: 32,
                              borderRadius: 3,
                              border: '1px solid var(--border)',
                              background: 'var(--surface-2)',
                              color: 'var(--txt-3)',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: trade.screenshotUrl?.trim() ? 'pointer' : 'not-allowed',
                              opacity: trade.screenshotUrl?.trim() ? 1 : 0.45,
                            }}
                            title={trade.screenshotUrl?.trim() ? 'View screenshot fullscreen' : 'No screenshot available'}
                            disabled={!trade.screenshotUrl?.trim()}
                          >
                            <ImageIcon size={13} />
                          </button>

                          <div
                            style={{
                              minWidth: 68,
                              textAlign: 'right',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 14,
                              fontWeight: 500,
                              fontVariantNumeric: 'tabular-nums',
                              color: getPnLColor(trade.pnl),
                            }}
                          >
                            {toCurrency(trade.pnl)}
                          </div>

                          <button
                            type="button"
                            className="flyxa-btn-delete"
                            aria-label={`Delete ${trade.symbol} trade`}
                            onClick={event => {
                              event.stopPropagation();
                              void handleDeleteTrade(trade.id);
                            }}
                            disabled={deletingTradeId === trade.id}
                            title="Delete trade"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, alignItems: 'start', marginBottom: 24 }}>

                {/* LEFT: Chart Scanner + day-level reflection sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {selectedTrade && editorDraft && (
                    <div
                      style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--txt-3)' }}>
                            Chart Scanner
                          </div>
                          <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>
                            Import screenshot
                          </div>
                          <div style={{ marginTop: 3, fontSize: 11, color: 'var(--txt-3)' }}>
                            Analyze this chart and auto-fill entry, exit, SL, TP, and duration.
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          border: editorDropActive
                            ? '1px dashed rgba(59,130,246,0.6)'
                            : '1px dashed var(--border)',
                          borderRadius: 6,
                          overflow: 'hidden',
                          background: 'var(--surface-2)',
                          minHeight: 210,
                          display: 'grid',
                          placeItems: 'center',
                          position: 'relative',
                          cursor: 'pointer',
                        }}
                        onClick={openEditorFilePicker}
                        onDragOver={event => {
                          event.preventDefault();
                          if (!editorScanning) {
                            setEditorDropActive(true);
                          }
                        }}
                        onDragLeave={() => setEditorDropActive(false)}
                        onDrop={handleEditorDrop}
                      >
                        {editorImagePreview ? (
                          <>
                            <img
                              src={editorImagePreview}
                              alt="Trade screenshot preview"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                openFullscreenTradeImage(
                                  editorImagePreview,
                                  `${selectedTrade?.symbol ?? 'Trade'} screenshot`
                                );
                              }}
                              style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                height: 28,
                                borderRadius: 999,
                                border: '1px solid rgba(255,255,255,0.24)',
                                background: 'rgba(2,6,23,0.82)',
                                color: '#e2e8f0',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '0 10px',
                                cursor: 'pointer',
                              }}
                              title="Open screenshot fullscreen"
                            >
                              <Expand size={12} />
                              Fullscreen
                            </button>
                          </>
                        ) : (
                          <span style={{ display: 'grid', placeItems: 'center', gap: 5, color: 'var(--txt-3)' }}>
                            <ImageIcon size={18} />
                            <span style={{ fontSize: 11 }}>Drop chart or click to upload</span>
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="flyxa-btn-primary"
                          onClick={openEditorFilePicker}
                          disabled={editorScanning}
                          style={{ height: 34 }}
                        >
                          Import File
                        </button>
                        <button
                          type="button"
                          className="flyxa-btn-primary"
                          onClick={resetEditorState}
                          disabled={editorScanning}
                          style={{ height: 34 }}
                        >
                          Reset Draft
                        </button>
                      </div>

                      {editorScanEvidence && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#bfdbfe',
                            background: 'rgba(59,130,246,0.12)',
                            border: '1px solid rgba(59,130,246,0.3)',
                            borderRadius: 6,
                            padding: '8px 10px',
                          }}
                        >
                          {editorScanEvidence}
                        </div>
                      )}

                      {editorWarnings.length > 0 && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#fcd34d',
                            background: 'rgba(250,204,21,0.1)',
                            border: '1px solid rgba(250,204,21,0.3)',
                            borderRadius: 6,
                            padding: '8px 10px',
                            display: 'grid',
                            gap: 4,
                          }}
                        >
                          {editorWarnings.map(warning => (
                            <span key={warning}>{warning}</span>
                          ))}
                        </div>
                      )}

                      {editorScanError && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#fca5a5',
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(248,113,113,0.35)',
                            borderRadius: 6,
                            padding: '8px 10px',
                          }}
                        >
                          {editorScanError}
                        </div>
                      )}
                    </div>

                  )}

                  {/* Reflection */}
                  <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 8 }}>
                    Reflection
                  </div>

                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-sub)' }}>
                    {[
                      { key: 'pre', label: 'Pre-market' },
                      { key: 'post', label: 'Post-session' },
                      { key: 'lessons', label: 'Lessons' },
                    ].map(tab => {
                      const selected = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveTab(tab.key as ReflectionTab)}
                          style={{
                            padding: '10px 16px',
                            fontSize: 12,
                            color: selected ? 'var(--cobalt)' : 'var(--txt-2)',
                            border: 'none',
                            borderBottom: selected ? '2px solid var(--cobalt)' : '2px solid transparent',
                            marginBottom: -1,
                            background: 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: activeTab === 'pre' ? 'block' : 'none' }}>
                    <textarea
                      className="flyxa-reflect"
                      value={activeReflection.pre}
                      onChange={event => handleReflectionChange('pre', event.target.value)}
                      placeholder="Game plan, key levels, bias, setups you're watching..."
                      style={{
                        width: '100%',
                        minHeight: 108,
                        padding: '14px 16px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 13,
                        lineHeight: 1.75,
                        color: 'var(--txt)',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div style={{ display: activeTab === 'post' ? 'block' : 'none' }}>
                    <textarea
                      className="flyxa-reflect"
                      value={activeReflection.post}
                      onChange={event => handleReflectionChange('post', event.target.value)}
                      placeholder="How did the session go? What happened vs your plan?"
                      style={{
                        width: '100%',
                        minHeight: 108,
                        padding: '14px 16px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 13,
                        lineHeight: 1.75,
                        color: 'var(--txt)',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div style={{ display: activeTab === 'lessons' ? 'block' : 'none' }}>
                    <textarea
                      className="flyxa-reflect"
                      value={activeReflection.lessons}
                      onChange={event => handleReflectionChange('lessons', event.target.value)}
                      placeholder="What did you learn? What would you do differently?"
                      style={{
                        width: '100%',
                        minHeight: 108,
                        padding: '14px 16px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 13,
                        lineHeight: 1.75,
                        color: 'var(--txt)',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                  </div>
                  </div>

                  {/* Rule Checklist */}
                  <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 8 }}>
                    Rule Checklist
                  </div>

                <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {activeEntry.rules.map((rule, index) => {
                    const isLast = index === activeEntry.rules.length - 1;
                    const isOk = rule.state === 'ok';
                    const isFail = rule.state === 'fail';

                    return (
                      <div
                        key={rule.id}
                        className="flyxa-rule-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderBottom: isLast ? 'none' : '1px solid var(--border-sub)',
                        }}
                      >
                        <span
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 3,
                            border: `1px solid ${
                              isOk ? 'var(--green)' : isFail ? 'var(--red)' : 'var(--border)'
                            }`,
                            background: isOk ? 'var(--green-dim)' : isFail ? 'var(--red-dim)' : 'transparent',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isOk && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                              <path d="M2 5.2L4.1 7.2L8 2.8" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {isFail && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                              <path d="M2.2 2.2L7.8 7.8M7.8 2.2L2.2 7.8" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          )}
                        </span>

                        <span
                          style={{
                            fontSize: 12,
                            color: isOk ? 'var(--txt)' : isFail ? 'var(--red)' : 'var(--txt-2)',
                            textDecoration: isFail ? 'line-through' : 'none',
                            textDecorationColor: isFail ? 'rgba(248,113,113,0.4)' : 'transparent',
                          }}
                        >
                          {rule.label}
                        </span>
                      </div>
                    );
                  })}
                  </div>
                  </div>

                  {/* Psychology */}
                  <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 8 }}>
                    Psychology
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  {[
                    {
                      label: 'Setup Quality',
                      score: activeEntry.psychology.setupQuality,
                      note: activeEntry.psychology.setupQualityNote,
                      tone: 'g',
                    },
                    {
                      label: 'Discipline',
                      score: activeEntry.psychology.discipline,
                      note: activeEntry.psychology.disciplineNote,
                      tone: 'a',
                    },
                    {
                      label: 'Execution',
                      score: activeEntry.psychology.execution,
                      note: activeEntry.psychology.executionNote,
                      tone: 'r',
                    },
                  ].map(card => (
                    <div
                      key={card.label}
                      style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '12px 14px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color: 'var(--txt-3)',
                          marginBottom: 10,
                        }}
                      >
                        {card.label}
                      </div>

                      <div style={{ display: 'flex', gap: 3 }}>
                        {[1, 2, 3, 4, 5].map(pip => {
                          const base = 'var(--surface-3)';
                          const fullColor = card.tone === 'g'
                            ? 'var(--green)'
                            : card.tone === 'a'
                              ? 'var(--amber)'
                              : 'var(--red)';

                          let background = base;
                          if (card.score >= pip) {
                            background = fullColor;
                          } else if (card.score >= pip - 0.5) {
                            background = `linear-gradient(90deg, ${fullColor} 50%, ${base} 50%)`;
                          }

                          return (
                            <span
                              key={`${card.label}-${pip}`}
                              style={{
                                flex: 1,
                                height: 3,
                                borderRadius: 2,
                                background,
                              }}
                            />
                          );
                        })}
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 17,
                          fontWeight: 500,
                          color: 'var(--txt)',
                        }}
                      >
                        {`${card.score}/5`}
                      </div>

                      <div style={{ marginTop: 2, fontSize: 11, color: 'var(--txt-3)' }}>{card.note}</div>
                    </div>
                  ))}
                </div>
              </div>

                  {/* State of Mind */}
                  <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', marginBottom: 10 }}>
                      State of Mind
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {STATE_OF_MIND_TAGS.map(tag => {
                        const tone = selectedEmotionTone.get(tag.toLowerCase());
                        const selected = Boolean(tone);

                        let border = 'var(--border)';
                        let color = 'var(--txt-2)';
                        let background = 'transparent';

                        if (selected && tone === 's-g') {
                          border = 'rgba(52,211,153,0.3)';
                          color = 'var(--green)';
                          background = 'var(--green-dim)';
                        }
                        if (selected && tone === 's-a') {
                          border = 'rgba(251,191,36,0.3)';
                          color = 'var(--amber)';
                          background = 'var(--amber-dim)';
                        }
                        if (selected && tone === 's-r') {
                          border = 'rgba(248,113,113,0.3)';
                          color = 'var(--red)';
                          background = 'var(--red-dim)';
                        }

                        return (
                          <button
                            key={tag}
                            type="button"
                            className="flyxa-state-tag"
                            style={{
                              fontSize: 11,
                              padding: '4px 10px',
                              borderRadius: 3,
                              border: `1px solid ${border}`,
                              color,
                              background,
                              cursor: 'pointer',
                            }}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* RIGHT: TradeForm */}
                {selectedTrade && editorDraft && (
                  <div
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: 12,
                    }}
                  >
                    <TradeForm
                      initialData={editorInitialData ?? undefined}
                      aiFields={editorAiFields}
                      tradeDate={editorDraft.trade_date ?? ''}
                      tradeTime={editorDraft.trade_time ?? ''}
                      onSubmit={data => { void handleSaveTradeEditor(data); }}
                      onDraftChange={setEditorDraft}
                      onCancel={resetEditorState}
                      isLoading={editorSaving}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {shouldShowImportPrompt && (
          <div
            style={{
              minHeight: '100%',
              padding: '32px 24px',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 760,
                minHeight: 320,
                borderRadius: 10,
                border: firstTradeDropActive
                  ? '1px dashed rgba(59,130,246,0.65)'
                  : '1px dashed rgba(245,158,11,0.35)',
                background: firstTradeDropActive
                  ? 'linear-gradient(180deg, rgba(59,130,246,0.18), rgba(59,130,246,0.08))'
                  : 'linear-gradient(180deg, rgba(245,158,11,0.1), rgba(245,158,11,0.04))',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                padding: '28px 24px',
                textAlign: 'center',
                transition: 'border-color 0.16s, background 0.16s',
              }}
              onDragOver={event => {
                if (isImportingFirstTrade) return;
                event.preventDefault();
                setFirstTradeDropActive(true);
              }}
              onDragLeave={() => setFirstTradeDropActive(false)}
              onDrop={handleFirstTradeDrop}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  border: firstTradeDropActive
                    ? '1px solid rgba(59,130,246,0.55)'
                    : '1px solid rgba(245,158,11,0.4)',
                  background: firstTradeDropActive
                    ? 'rgba(59,130,246,0.2)'
                    : 'rgba(245,158,11,0.15)',
                  display: 'grid',
                  placeItems: 'center',
                  color: firstTradeDropActive ? '#60a5fa' : 'var(--amber)',
                }}
              >
                <ArrowUpRight size={20} strokeWidth={2.4} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--txt)' }}>
                {firstTradeDropActive ? 'Drop your trade screenshot to analyse' : 'Drag and drop to analyse a trade'}
              </div>
              <div style={{ maxWidth: 520, fontSize: 13, color: 'var(--txt-3)', lineHeight: 1.65 }}>
                {firstTradeDropActive
                  ? 'We will analyse this in the background and populate your first journal trade.'
                  : 'Your trade journal is empty. Drag and drop a trade screenshot here, or select a file to analyse.'}
              </div>
              {firstTradeImportError && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#fca5a5',
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(248,113,113,0.35)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    maxWidth: 540,
                  }}
                >
                  {firstTradeImportError}
                </div>
              )}
              <button
                type="button"
                className="flyxa-btn-primary"
                onClick={openFirstTradeFilePicker}
                disabled={!onImportFirstTradeImage || isImportingFirstTrade}
                style={{
                  opacity: onImportFirstTradeImage && !isImportingFirstTrade ? 1 : 0.5,
                  cursor: onImportFirstTradeImage && !isImportingFirstTrade ? 'pointer' : 'not-allowed',
                }}
              >
                Select File
              </button>
            </div>
          </div>
        )}
      </section>

      {fullscreenTradeImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
          }}
        >
          <button
            type="button"
            aria-label="Close fullscreen screenshot"
            onClick={() => setFullscreenTradeImage(null)}
            style={{
              position: 'absolute',
              inset: 0,
              border: 'none',
              background:
                'radial-gradient(circle at center, rgba(15,23,42,0.22) 0%, rgba(2,6,23,0.86) 70%, rgba(2,6,23,0.95) 100%)',
              cursor: 'pointer',
            }}
          />
          <button
            type="button"
            onClick={() => setFullscreenTradeImage(null)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: '1px solid rgba(148,163,184,0.45)',
              background: 'rgba(2,6,23,0.82)',
              color: '#e2e8f0',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              zIndex: 3,
            }}
          >
            <X size={18} />
          </button>
          <div
            style={{
              position: 'absolute',
              left: 20,
              top: 20,
              color: '#cbd5e1',
              fontSize: 12,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {fullscreenTradeImage.title}
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 30,
              display: 'grid',
              placeItems: 'center',
              zIndex: 1,
            }}
          >
            <img
              src={fullscreenTradeImage.src}
              alt={fullscreenTradeImage.title}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function TradeScanner() {
  const { trades, createTrade, updateTrade, deleteTrade } = useTrades();
  const { getDefaultTradeAccountId } = useAppSettings();
  const navigate = useNavigate();
  const [isImportingFirstTrade, setIsImportingFirstTrade] = useState(false);
  const [firstTradeImportError, setFirstTradeImportError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get('date') ?? undefined;
  const requestedTradeId = searchParams.get('tradeId') ?? undefined;
  const importMode = searchParams.get('import') === '1';
  const journalEntries = useMemo(() => toJournalEntries(trades), [trades]);
  const tradesById = useMemo(
    () => Object.fromEntries(trades.map(trade => [trade.id, trade])),
    [trades]
  );

  const handleDeleteTrade = async (tradeId: string) => {
    await deleteTrade(tradeId);
  };

  const handleUpdateTrade = async (tradeId: string, data: Partial<Trade>) => {
    await updateTrade(tradeId, data);
  };

  const handleImportFirstTradeImage = async (file: File) => {
    if (isImportingFirstTrade) {
      return;
    }

    setFirstTradeImportError(null);
    setIsImportingFirstTrade(true);
    try {
      const scanDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? '') ? (requestedDate as string) : getTodayDate();
      const scanTime = getNowTime();
      const screenshotDataUrl = await toDataUrl(file);
      const { focusImages, scannerContext, uploadImage } = await buildScannerAssets(file);
      const extracted = await aiApi.scanChart(
        uploadImage,
        scanDate,
        scanTime,
        focusImages,
        withScannerColorContext(scannerContext ?? undefined)
      );

      const mapped = buildTradePatchFromScan({
        extracted,
        fileName: file.name,
        fallbackDate: scanDate,
        fallbackTime: scanTime,
        accountId: getDefaultTradeAccountId(),
        screenshotDataUrl,
      });

      const symbol = mapped.patch.symbol;
      const direction = mapped.patch.direction;
      const entryPrice = mapped.patch.entry_price;
      const slPrice = mapped.patch.sl_price;
      const tpPrice = mapped.patch.tp_price;
      const exitReason = mapped.patch.exit_reason;

      if (!symbol || !direction || !isFiniteNumber(entryPrice) || !isFiniteNumber(slPrice) || !isFiniteNumber(tpPrice) || !exitReason || (exitReason !== 'TP' && exitReason !== 'SL')) {
        throw new Error('Could not extract enough trade details from this screenshot. Try a clearer chart image.');
      }

      const pointValue = lookupContract(symbol)?.point_value ?? 1;
      const tradeTime = toScanTime(mapped.patch.trade_time) || scanTime;
      const mappedTrade: Partial<Trade> = {
        ...mapped.patch,
        accountId: getDefaultTradeAccountId(),
        symbol,
        direction,
        entry_price: Number(entryPrice),
        sl_price: Number(slPrice),
        tp_price: Number(tpPrice),
        exit_reason: exitReason as 'TP' | 'SL',
        exit_price: exitReason === 'TP' ? Number(tpPrice) : Number(slPrice),
        contract_size: 1,
        point_value: pointValue,
        trade_date: scanDate,
        trade_time: tradeTime,
        trade_length_seconds: isFiniteNumber(mapped.patch.trade_length_seconds) ? Number(mapped.patch.trade_length_seconds) : 0,
        candle_count: isFiniteNumber(mapped.patch.candle_count) ? Number(mapped.patch.candle_count) : 0,
        timeframe_minutes: isFiniteNumber(mapped.patch.timeframe_minutes) ? Number(mapped.patch.timeframe_minutes) : 1,
        emotional_state: 'Calm',
        confidence_level: 7,
        pre_trade_notes: '',
        post_trade_notes: '',
        confluences: [],
        followed_plan: true,
        screenshot_url: mapped.patch.screenshot_url ?? screenshotDataUrl,
      };

      const createdTrade = await createTrade(mappedTrade);
      if (importMode) {
        navigate(`/scanner?date=${encodeURIComponent(scanDate)}&tradeId=${encodeURIComponent(createdTrade.id)}`, { replace: true });
      }
    } catch (error) {
      setFirstTradeImportError(error instanceof Error ? error.message : 'Failed to analyse trade screenshot.');
    } finally {
      setIsImportingFirstTrade(false);
    }
  };

  return (
    <FlyxaJournalPage
      date={requestedDate}
      entries={journalEntries}
      account={DEFAULT_ACCOUNT}
      tradesById={tradesById}
      initialTradeId={requestedTradeId}
      forceImportPrompt={importMode}
      onImportFirstTradeImage={handleImportFirstTradeImage}
      isImportingFirstTrade={isImportingFirstTrade}
      firstTradeImportError={firstTradeImportError}
      onDeleteTrade={handleDeleteTrade}
      onUpdateTrade={handleUpdateTrade}
    />
  );
}
```


---
## FILE: frontend/src/types/index.ts
```ts
export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  screenshot_url?: string;
  accountId?: string;
  account_id?: string;
  direction: 'Long' | 'Short';
  entry_price: number;
  exit_price: number;
  sl_price: number;
  tp_price: number;
  exit_reason: 'TP' | 'SL' | 'BE';
  pnl: number;
  contract_size: number;
  point_value: number;
  trade_date: string;
  trade_time: string;
  trade_length_seconds: number;
  candle_count: number;
  timeframe_minutes: number;
  emotional_state: 'Calm' | 'Confident' | 'Anxious' | 'Revenge Trading' | 'FOMO' | 'Overconfident' | 'Tired';
  confidence_level: number;
  pre_trade_notes: string;
  post_trade_notes: string;
  confluences?: string[];
  followed_plan: boolean;
  session: 'Asia' | 'London' | 'Pre Market' | 'New York' | 'Other';
  created_at: string;
}

export interface PsychologyLog {
  id: string;
  user_id: string;
  date: string;
  mood: string;
  pre_session_notes: string;
  post_session_notes: string;
  mindset_score: number;
  created_at: string;
}

export interface PlaybookEntry {
  id: string;
  user_id: string;
  setup_name: string;
  description: string;
  rules: string;
  ideal_conditions: string;
  screenshot_url: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  content: string;
  screenshots: string[];
  created_at: string;
}

export interface RiskSettings {
  id: string;
  user_id: string;
  daily_loss_limit: number;
  max_trades_per_day: number;
  max_contracts_per_trade: number;
  account_size: number;
  risk_percentage: number;
  updated_at: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface AnalyticsSummary {
  netPnL: number;
  winRate: number;
  profitFactor: number;
  avgRR: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

export interface DailyPnLPoint {
  date: string;
  pnl: number;
}

export interface EquityCurvePoint {
  date: string;
  pnl: number;
  cumulative: number;
}

export interface SessionData {
  session: string;
  trades: number;
  winRate: number;
  netPnL: number;
  profitFactor: number;
}

export interface InstrumentData {
  symbol: string;
  trades: number;
  winRate: number;
  netPnL: number;
  profitFactor: number;
}

export interface DayOfWeekData {
  day: string;
  trades: number;
  winRate: number;
  avgPnL: number;
  netPnL: number;
}

export interface DailyStatus {
  date: string;
  todayPnL: number;
  tradesCount: number;
  maxTradesPerDay: number;
  dailyLossLimit: number;
  lossUsedPercent: number;
  isLocked: boolean;
  todayTrades: Trade[];
  settings: RiskSettings;
}

export interface ExtractedTradeData {
  symbol: string | null;
  direction: 'Long' | 'Short' | null;
  entry_price: number | null;
  entry_time: string | null;
  entry_time_confidence: 'high' | 'medium' | 'low' | null;
  sl_price: number | null;
  tp_price: number | null;
  trade_length_seconds: number | null;
  candle_count: number | null;
  timeframe_minutes: number | null;
  exit_reason: 'TP' | 'SL' | null;
  pnl_result: 'Win' | 'Loss' | null;
  exit_confidence: 'high' | 'medium' | 'low' | null;
  first_touch_candle_index: number | null;
  first_touch_evidence: string | null;
  warnings?: string[];
}

export type TradingAccountType = 'Futures' | 'Forex' | 'Stocks';
export type TradingAccountStatus = 'Eval' | 'Funded' | 'Live' | 'Blown';

export interface TradingAccount {
  id: string;
  name: string;
  broker?: string;
  credentials?: string;
  type: TradingAccountType;
  status: TradingAccountStatus;
  color: string;
  createdAt: string;
}

export interface AppPreferences {
  dateFormat: 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd';
  currencySymbol: '$' | 'Ã¢â€šÂ¬' | 'Ã‚Â£' | 'A$';
  timezone: string;
  defaultTimeframe: '1m' | '5m' | '15m' | '1h';
  defaultChartType: 'Candles' | 'Line' | 'Area';
  sessionTimes: {
    asia: {
      start: string;
      end: string;
    };
    london: {
      start: string;
      end: string;
    };
    preMarket: {
      start: string;
      end: string;
    };
    newYork: {
      start: string;
      end: string;
    };
  };
}

```

