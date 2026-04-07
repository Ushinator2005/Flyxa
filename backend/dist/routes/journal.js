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
            .from('journal_entries')
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
// GET /:id
router.get('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase_1.supabase
            .from('journal_entries')
            .select('*')
            .eq('id', id)
            .eq('user_id', req.userId)
            .single();
        if (error || !data) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
// POST /
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { date, content, screenshots } = req.body;
        const { data, error } = await supabase_1.supabase
            .from('journal_entries')
            .insert({
            user_id: req.userId,
            date,
            content: content || '',
            screenshots: screenshots || [],
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
            .from('journal_entries')
            .select('user_id')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }
        if (existing.user_id !== req.userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { data, error } = await supabase_1.supabase
            .from('journal_entries')
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
            .from('journal_entries')
            .select('user_id')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }
        if (existing.user_id !== req.userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { error } = await supabase_1.supabase
            .from('journal_entries')
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
exports.default = router;
//# sourceMappingURL=journal.js.map