"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const ALLOWED_INTERVALS = new Set(['1m', '5m', '15m', '1h', '1d']);
const ALLOWED_RANGES = new Set(['1d', '5d', '1mo', '3mo', '1y']);
function normalizeYahooResponse(payload) {
    if (payload.chart?.error?.description) {
        throw new Error(payload.chart.error.description);
    }
    const result = payload.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    if (!result?.timestamp || !quote) {
        throw new Error('No candle data returned for this symbol/timeframe/range.');
    }
    const candles = result.timestamp.reduce((acc, timestamp, index) => {
        const open = quote.open?.[index];
        const high = quote.high?.[index];
        const low = quote.low?.[index];
        const close = quote.close?.[index];
        const volume = quote.volume?.[index] ?? 0;
        if (typeof timestamp !== 'number' ||
            typeof open !== 'number' ||
            typeof high !== 'number' ||
            typeof low !== 'number' ||
            typeof close !== 'number') {
            return acc;
        }
        acc.push({
            time: timestamp,
            open,
            high,
            low,
            close,
            volume: typeof volume === 'number' ? volume : 0,
        });
        return acc;
    }, []);
    if (candles.length === 0) {
        throw new Error('Not enough candle data returned for replay.');
    }
    return candles;
}
router.get('/chart', auth_1.authMiddleware, async (req, res, next) => {
    try {
        const symbol = String(req.query.symbol ?? '').trim();
        const interval = String(req.query.interval ?? '').trim();
        const range = String(req.query.range ?? '').trim();
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required.' });
        }
        if (!ALLOWED_INTERVALS.has(interval)) {
            return res.status(400).json({ error: 'Unsupported interval.' });
        }
        if (!ALLOWED_RANGES.has(range)) {
            return res.status(400).json({ error: 'Unsupported range.' });
        }
        const query = new URLSearchParams({
            interval,
            range,
            includePrePost: 'false',
            events: 'div,splits',
        });
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query.toString()}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Yahoo Finance request failed with status ${response.status}.`);
        }
        const payload = await response.json();
        const candles = normalizeYahooResponse(payload);
        return res.json(candles);
    }
    catch (error) {
        return next(error);
    }
});
exports.default = router;
//# sourceMappingURL=marketData.js.map