"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../services/supabase");
const router = (0, express_1.Router)();
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function isTradeDirection(value) {
    return value === 'Long' || value === 'Short';
}
function isExitReason(value) {
    return value === 'TP' || value === 'SL';
}
function hasValidPriceStructure(direction, entry, stop, target) {
    return direction === 'Long'
        ? stop < entry && entry < target
        : target < entry && entry < stop;
}
function getNormalizedExitPrice(exitReason, stop, target) {
    return exitReason === 'TP' ? target : stop;
}
function getSession(time) {
    const [h] = time.split(':').map(Number);
    if (h >= 0 && h < 8)
        return 'Asia';
    if (h >= 8 && h < 13)
        return 'London';
    if (h >= 13 && h < 21)
        return 'New York';
    return 'Other';
}
// GET all trades for user
router.get('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('trades')
            .select('*')
            .eq('user_id', req.userId)
            .order('trade_date', { ascending: false })
            .order('trade_time', { ascending: false });
        if (error)
            throw error;
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
// POST create trade
router.post('/', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { symbol, screenshot_url, direction, entry_price, sl_price, tp_price, exit_reason, contract_size, point_value, trade_date, trade_time, trade_length_seconds, candle_count, timeframe_minutes, emotional_state, confidence_level, pre_trade_notes, post_trade_notes, followed_plan, } = req.body;
        if (typeof symbol !== 'string' ||
            !symbol.trim() ||
            !isTradeDirection(direction) ||
            !isFiniteNumber(entry_price) ||
            !isFiniteNumber(sl_price) ||
            !isFiniteNumber(tp_price) ||
            !isExitReason(exit_reason) ||
            typeof trade_date !== 'string' ||
            typeof trade_time !== 'string') {
            res.status(400).json({ error: 'Missing or invalid required trade fields' });
            return;
        }
        if (!hasValidPriceStructure(direction, entry_price, sl_price, tp_price)) {
            res.status(400).json({ error: 'Entry, stop, and target levels do not match the selected trade direction' });
            return;
        }
        const normalizedContractSize = isFiniteNumber(contract_size) ? contract_size : 1;
        const normalizedPointValue = isFiniteNumber(point_value) ? point_value : 1;
        const normalizedExitPrice = getNormalizedExitPrice(exit_reason, sl_price, tp_price);
        // Calculate P&L
        const pnl = direction === 'Long'
            ? (normalizedExitPrice - entry_price) * normalizedContractSize * normalizedPointValue
            : (entry_price - normalizedExitPrice) * normalizedContractSize * normalizedPointValue;
        // Determine session
        const session = getSession(trade_time);
        const { data, error } = await supabase_1.supabase
            .from('trades')
            .insert({
            user_id: req.userId,
            symbol,
            screenshot_url: typeof screenshot_url === 'string' ? screenshot_url : '',
            direction,
            entry_price,
            exit_price: normalizedExitPrice,
            sl_price,
            tp_price,
            exit_reason,
            pnl,
            contract_size: normalizedContractSize,
            point_value: normalizedPointValue,
            trade_date,
            trade_time,
            trade_length_seconds,
            candle_count,
            timeframe_minutes,
            emotional_state,
            confidence_level,
            pre_trade_notes: pre_trade_notes || '',
            post_trade_notes: post_trade_notes || '',
            followed_plan: followed_plan !== undefined ? followed_plan : true,
            session,
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
// PUT update trade
router.put('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const { data: existing, error: fetchError } = await supabase_1.supabase
            .from('trades')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Trade not found' });
            return;
        }
        if (existing.user_id !== req.userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { id: _ignoredId, user_id: _ignoredUserId, created_at: _ignoredCreatedAt, pnl: _ignoredPnl, session: _ignoredSession, ...updateData } = req.body;
        const merged = { ...existing, ...updateData };
        if (typeof merged.symbol !== 'string' ||
            !merged.symbol.trim() ||
            !isTradeDirection(merged.direction) ||
            !isFiniteNumber(merged.entry_price) ||
            !isFiniteNumber(merged.sl_price) ||
            !isFiniteNumber(merged.tp_price) ||
            !isExitReason(merged.exit_reason) ||
            typeof merged.trade_time !== 'string') {
            res.status(400).json({ error: 'Updated trade is missing required fields' });
            return;
        }
        if (!hasValidPriceStructure(merged.direction, merged.entry_price, merged.sl_price, merged.tp_price)) {
            res.status(400).json({ error: 'Entry, stop, and target levels do not match the selected trade direction' });
            return;
        }
        const normalizedExitPrice = getNormalizedExitPrice(merged.exit_reason, merged.sl_price, merged.tp_price);
        const normalizedContractSize = isFiniteNumber(merged.contract_size) ? merged.contract_size : 1;
        const normalizedPointValue = isFiniteNumber(merged.point_value) ? merged.point_value : 1;
        updateData.exit_price = normalizedExitPrice;
        updateData.pnl = merged.direction === 'Long'
            ? (normalizedExitPrice - merged.entry_price) * normalizedContractSize * normalizedPointValue
            : (merged.entry_price - normalizedExitPrice) * normalizedContractSize * normalizedPointValue;
        updateData.session = getSession(merged.trade_time);
        const { data, error } = await supabase_1.supabase
            .from('trades')
            .update(updateData)
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
// DELETE trade
router.delete('/:id', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const { data: existing, error: fetchError } = await supabase_1.supabase
            .from('trades')
            .select('user_id')
            .eq('id', id)
            .single();
        if (fetchError || !existing) {
            res.status(404).json({ error: 'Trade not found' });
            return;
        }
        if (existing.user_id !== req.userId) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { error } = await supabase_1.supabase
            .from('trades')
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
//# sourceMappingURL=trades.js.map