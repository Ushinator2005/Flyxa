"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../services/supabase");
const router = (0, express_1.Router)();
const MAX_BACKUP_ENTRIES = 2000;
function normalizeBackupDate(value) {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
}
function normalizeScreenshots(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((item) => typeof item === 'string' && item.trim().length > 0)
        .slice(0, 40);
}
function normalizeBackupEntries(value) {
    if (!Array.isArray(value))
        return [];
    const normalized = [];
    for (const item of value) {
        if (!item || typeof item !== 'object')
            continue;
        const record = item;
        const date = normalizeBackupDate(record.date);
        if (!date)
            continue;
        normalized.push({
            date,
            content: typeof record.content === 'string' ? record.content : '',
            screenshots: normalizeScreenshots(record.screenshots),
        });
    }
    return normalized;
}
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
// GET /backup
router.get('/backup', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('journal_entries')
            .select('*')
            .eq('user_id', req.userId)
            .order('date', { ascending: false });
        if (error)
            throw error;
        res.json({
            version: 1,
            exported_at: new Date().toISOString(),
            entries: data ?? [],
        });
    }
    catch (err) {
        next(err);
    }
});
// POST /backup/restore
router.post('/backup/restore', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const entries = normalizeBackupEntries(req.body.entries);
        if (entries.length === 0) {
            res.status(400).json({ error: 'No valid backup entries found' });
            return;
        }
        if (entries.length > MAX_BACKUP_ENTRIES) {
            res.status(400).json({ error: `Backup too large. Max ${MAX_BACKUP_ENTRIES} entries.` });
            return;
        }
        const { data: existing, error: existingError } = await supabase_1.supabase
            .from('journal_entries')
            .select('id,date')
            .eq('user_id', req.userId)
            .order('created_at', { ascending: true });
        if (existingError)
            throw existingError;
        const existingByDate = new Map();
        for (const row of existing ?? []) {
            if (typeof row.date === 'string' && typeof row.id === 'string' && !existingByDate.has(row.date)) {
                existingByDate.set(row.date, row.id);
            }
        }
        let created = 0;
        let updated = 0;
        let failed = 0;
        for (const entry of entries) {
            const existingId = existingByDate.get(entry.date);
            if (existingId) {
                const { error } = await supabase_1.supabase
                    .from('journal_entries')
                    .update({
                    content: entry.content,
                    screenshots: entry.screenshots,
                })
                    .eq('id', existingId)
                    .eq('user_id', req.userId);
                if (error) {
                    failed += 1;
                }
                else {
                    updated += 1;
                }
                continue;
            }
            const { data, error } = await supabase_1.supabase
                .from('journal_entries')
                .insert({
                user_id: req.userId,
                date: entry.date,
                content: entry.content,
                screenshots: entry.screenshots,
            })
                .select('id,date')
                .single();
            if (error || !data) {
                failed += 1;
                continue;
            }
            existingByDate.set(data.date, data.id);
            created += 1;
        }
        const skipped = entries.length - created - updated - failed;
        res.json({
            requested: entries.length,
            created,
            updated,
            skipped,
            failed,
        });
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