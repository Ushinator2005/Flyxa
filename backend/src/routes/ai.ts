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

// POST /scan — analyze chart image
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
