"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../services/supabase");
const claude_1 = require("../services/claude");
const gemini_1 = require("../services/gemini");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
// POST /scan
router.post('/scan', auth_1.authMiddleware, upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'focusImages', maxCount: 10 },
]), async (req, res, next) => {
    try {
        const files = req.files;
        const imageFile = files?.['image']?.[0];
        if (!imageFile) {
            res.status(400).json({ error: 'image is required' });
            return;
        }
        const entryDate = typeof req.body.entryDate === 'string' ? req.body.entryDate : new Date().toISOString().slice(0, 10);
        const entryTime = typeof req.body.entryTime === 'string' ? req.body.entryTime : '09:30';
        let scannerContext;
        if (typeof req.body.scannerContext === 'string') {
            try {
                scannerContext = JSON.parse(req.body.scannerContext);
            }
            catch { /* ignore */ }
        }
        const focusFileList = files?.['focusImages'] ?? [];
        const focusImages = focusFileList.map(f => ({
            base64Image: f.buffer.toString('base64'),
            mimeType: f.mimetype,
            label: f.originalname,
        }));
        const base64Image = imageFile.buffer.toString('base64');
        const mimeType = imageFile.mimetype;
        const result = await (0, gemini_1.analyzeChartImage)(base64Image, mimeType, entryDate, entryTime, focusImages, scannerContext);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
// POST /flyxa-chat
router.post('/flyxa-chat', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const question = typeof req.body.question === 'string' ? req.body.question : '';
        const history = Array.isArray(req.body.history)
            ? req.body.history
                .filter((message) => (!!message &&
                typeof message === 'object' &&
                ('role' in message) &&
                ('content' in message) &&
                (message.role === 'user' || message.role === 'assistant') &&
                typeof message.content === 'string'))
            : [];
        if (!question.trim()) {
            res.status(400).json({ error: 'question is required' });
            return;
        }
        const reply = await (0, claude_1.answerFlyxaQuestion)(question, history);
        res.json({ reply });
    }
    catch (err) {
        next(err);
    }
});
// POST /trade-analysis/:tradeId
router.post('/trade-analysis/:tradeId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { tradeId } = req.params;
        const { data: trade, error } = await supabase_1.supabase
            .from('trades')
            .select('*')
            .eq('id', tradeId)
            .eq('user_id', req.userId)
            .single();
        if (error || !trade) {
            res.status(404).json({ error: 'Trade not found' });
            return;
        }
        const analysis = await (0, claude_1.analyzeIndividualTrade)(trade);
        res.json({ analysis });
    }
    catch (err) {
        next(err);
    }
});
// POST /patterns
router.post('/patterns', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;
        let query = supabase_1.supabase
            .from('trades')
            .select('*')
            .eq('user_id', req.userId)
            .order('trade_date', { ascending: true });
        if (startDate)
            query = query.gte('trade_date', startDate);
        if (endDate)
            query = query.lte('trade_date', endDate);
        const { data: trades, error } = await query;
        if (error)
            throw error;
        if (!trades || trades.length === 0) {
            res.json({ analysis: 'No trades found for the selected period.' });
            return;
        }
        const analysis = await (0, claude_1.analyzePatterns)(trades);
        res.json({ analysis });
    }
    catch (err) {
        next(err);
    }
});
// POST /weekly-report
router.post('/weekly-report', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { weekStart, weekEnd } = req.body;
        if (!weekStart || !weekEnd) {
            res.status(400).json({ error: 'weekStart and weekEnd are required' });
            return;
        }
        const { data: trades, error } = await supabase_1.supabase
            .from('trades')
            .select('*')
            .eq('user_id', req.userId)
            .gte('trade_date', weekStart)
            .lte('trade_date', weekEnd)
            .order('trade_date', { ascending: true });
        if (error)
            throw error;
        const report = await (0, claude_1.generateWeeklyReport)((trades || []), weekStart, weekEnd);
        res.json({ report });
    }
    catch (err) {
        next(err);
    }
});
// POST /psychology-report
router.post('/psychology-report', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const [tradesResult, psychResult] = await Promise.all([
            supabase_1.supabase
                .from('trades')
                .select('*')
                .eq('user_id', req.userId)
                .order('trade_date', { ascending: true }),
            supabase_1.supabase
                .from('psychology_logs')
                .select('*')
                .eq('user_id', req.userId)
                .order('date', { ascending: true }),
        ]);
        if (tradesResult.error)
            throw tradesResult.error;
        if (psychResult.error)
            throw psychResult.error;
        const report = await (0, claude_1.generatePsychologyReport)((tradesResult.data || []), psychResult.data || []);
        res.json({ report });
    }
    catch (err) {
        next(err);
    }
});
// POST /playbook-check/:tradeId
router.post('/playbook-check/:tradeId', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { tradeId } = req.params;
        const [tradeResult, playbookResult] = await Promise.all([
            supabase_1.supabase
                .from('trades')
                .select('*')
                .eq('id', tradeId)
                .eq('user_id', req.userId)
                .single(),
            supabase_1.supabase
                .from('playbook_entries')
                .select('*')
                .eq('user_id', req.userId),
        ]);
        if (tradeResult.error || !tradeResult.data) {
            res.status(404).json({ error: 'Trade not found' });
            return;
        }
        if (playbookResult.error)
            throw playbookResult.error;
        const analysis = await (0, claude_1.compareTradeToPlaybook)(tradeResult.data, playbookResult.data || []);
        res.json({ analysis });
    }
    catch (err) {
        next(err);
    }
});
// POST /filter-news
router.post('/filter-news', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { headlines } = req.body;
        if (!Array.isArray(headlines)) {
            res.status(400).json({ error: 'headlines array required' });
            return;
        }
        const items = await (0, claude_1.filterNewsItems)(headlines.slice(0, 40));
        res.json({ items });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=ai.js.map