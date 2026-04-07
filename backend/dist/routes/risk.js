"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../services/supabase");
const router = (0, express_1.Router)();
// GET /settings
router.get('/settings', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('risk_settings')
            .select('*')
            .eq('user_id', req.userId)
            .single();
        if (error && error.code !== 'PGRST116')
            throw error;
        if (!data) {
            // Return defaults
            res.json({
                user_id: req.userId,
                daily_loss_limit: 500,
                max_trades_per_day: 10,
                max_contracts_per_trade: 5,
                account_size: 10000,
                risk_percentage: 1,
            });
            return;
        }
        res.json(data);
    }
    catch (err) {
        next(err);
    }
});
// PUT /settings
router.put('/settings', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const { daily_loss_limit, max_trades_per_day, max_contracts_per_trade, account_size, risk_percentage, } = req.body;
        const { data, error } = await supabase_1.supabase
            .from('risk_settings')
            .upsert({
            user_id: req.userId,
            daily_loss_limit,
            max_trades_per_day,
            max_contracts_per_trade,
            account_size,
            risk_percentage,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
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
// GET /daily-status
router.get('/daily-status', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const [tradesResult, settingsResult] = await Promise.all([
            supabase_1.supabase
                .from('trades')
                .select('*')
                .eq('user_id', req.userId)
                .eq('trade_date', today)
                .order('trade_time', { ascending: true }),
            supabase_1.supabase
                .from('risk_settings')
                .select('*')
                .eq('user_id', req.userId)
                .single(),
        ]);
        if (tradesResult.error)
            throw tradesResult.error;
        const todayTrades = tradesResult.data || [];
        const todayPnL = todayTrades.reduce((s, t) => s + t.pnl, 0);
        const settings = settingsResult.data || {
            daily_loss_limit: 500,
            max_trades_per_day: 10,
            max_contracts_per_trade: 5,
            account_size: 10000,
            risk_percentage: 1,
        };
        const lossUsedPercent = settings.daily_loss_limit > 0
            ? (Math.abs(Math.min(0, todayPnL)) / settings.daily_loss_limit) * 100
            : 0;
        res.json({
            date: today,
            todayPnL,
            tradesCount: todayTrades.length,
            maxTradesPerDay: settings.max_trades_per_day,
            dailyLossLimit: settings.daily_loss_limit,
            lossUsedPercent,
            isLocked: lossUsedPercent >= 100,
            todayTrades,
            settings,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=risk.js.map