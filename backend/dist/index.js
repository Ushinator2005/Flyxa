"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const errorHandler_1 = require("./middleware/errorHandler");
const trades_1 = __importDefault(require("./routes/trades"));
const ai_1 = __importDefault(require("./routes/ai"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const risk_1 = __importDefault(require("./routes/risk"));
const psychology_1 = __importDefault(require("./routes/psychology"));
const playbook_1 = __importDefault(require("./routes/playbook"));
const journal_1 = __importDefault(require("./routes/journal"));
const marketData_1 = __importDefault(require("./routes/marketData"));
const billing_1 = __importDefault(require("./routes/billing"));
dotenv_1.default.config({ override: true });
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
function isPrivateIpv4(hostname) {
    const parts = hostname.split('.').map((part) => Number.parseInt(part, 10));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
        return false;
    }
    const [a, b] = parts;
    if (a === 10)
        return true;
    if (a === 172 && b >= 16 && b <= 31)
        return true;
    if (a === 192 && b === 168)
        return true;
    return false;
}
function isAllowedDevOrigin(origin) {
    try {
        const parsed = new URL(origin);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
            return false;
        const hostname = parsed.hostname.toLowerCase();
        if (hostname === 'localhost' || hostname === '127.0.0.1')
            return true;
        return isPrivateIpv4(hostname);
    }
    catch {
        return false;
    }
}
// Security middleware
app.use((0, helmet_1.default)());
// CORS
const defaultAllowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const configuredAllowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredAllowedOrigins]);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow same-origin / non-browser calls (no Origin header)
        if (!origin) {
            callback(null, true);
            return;
        }
        if (allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }
        if (isLocalDev && isAllowedDevOrigin(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
}));
// Rate limiting
const isLocalDev = process.env.NODE_ENV !== 'production';
const localhostHosts = new Set(['localhost', '127.0.0.1', '::1']);
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isLocalDev ? 5000 : 200,
    message: { error: 'Too many requests, please try again later.' },
    skip: (req) => {
        if (!isLocalDev)
            return false;
        const rawHost = (req.hostname || '').toLowerCase();
        const host = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;
        if (localhostHosts.has(host))
            return true;
        const ip = (req.ip || '').replace('::ffff:', '').toLowerCase();
        return localhostHosts.has(ip);
    },
});
app.use(limiter);
// Body parser - 50mb for images
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Routes
app.use('/api/trades', trades_1.default);
app.use('/api/ai', ai_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/risk', risk_1.default);
app.use('/api/psychology', psychology_1.default);
app.use('/api/playbook', playbook_1.default);
app.use('/api/journal', journal_1.default);
app.use('/api/market-data', marketData_1.default);
app.use('/api/billing', billing_1.default);
// Error handler
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`TradeWise backend running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map