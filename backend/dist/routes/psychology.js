"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../services/supabase");
const router = (0, express_1.Router)();
// GET /
router.get('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('psychology_logs')
            .select('*')
            .eq('user_id', req.userId)
            .order('date', { ascending: false });
        if (error)
            throw error;
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
// POST /
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { date, mood, pre_session_notes, post_session_notes, mindset_score } = req.body;
        const { data, error } = await supabase_1.supabase
            .from('psychology_logs')
            .insert({
            user_id: req.userId,
            date,
            mood,
            pre_session_notes: pre_session_notes || '',
            post_session_notes: post_session_notes || '',
            mindset_score,
        })
            .select()
            .single();
        if (error)
            throw error;
        res.status(201).json(data);
    }
    catch (err) {
        next(err);
    }
});
// PUT /:id
router.put('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { data: existing, error: fetchError } = await supabase_1.supabase
            .from('psychology_logs')
            .select('user_id')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Log not found' });
            return;
        }
        if (existing.user_id !== req.userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { data, error } = await supabase_1.supabase
            .from('psychology_logs')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
// DELETE /:id
router.delete('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { data: existing, error: fetchError } = await supabase_1.supabase
            .from('psychology_logs')
            .select('user_id')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Log not found' });
            return;
        }
        if (existing.user_id !== req.userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { error } = await supabase_1.supabase
            .from('psychology_logs')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
// GET /mindset-chart
router.get('/mindset-chart', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const [logsResult, tradesResult] = await Promise.all([
            supabase_1.supabase
                .from('psychology_logs')
                .select('date, mindset_score, mood')
                .eq('user_id', req.userId)
                .order('date', { ascending: true }),
            supabase_1.supabase
                .from('trades')
                .select('trade_date, pnl')
                .eq('user_id', req.userId)
                .order('trade_date', { ascending: true }),
        ]);
        if (logsResult.error)
            throw logsResult.error;
        if (tradesResult.error)
            throw tradesResult.error;
        // Group trades by date
        const tradePnLByDate = {};
        for (const t of (tradesResult.data || [])) {
            tradePnLByDate[t.trade_date] = (tradePnLByDate[t.trade_date] || 0) + t.pnl;
        }
        const result = (logsResult.data || []).map(log => ({
            date: log.date,
            mindsetScore: log.mindset_score,
            mood: log.mood,
            dailyPnL: tradePnLByDate[log.date] || 0,
        }));
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=psychology.js.map