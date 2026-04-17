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
dotenv_1.default.config({ override: true });
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Security middleware
app.use((0, helmet_1.default)());
// CORS
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: { error: 'Too many requests, please try again later.' },
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
// Error handler
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`TradeWise backend running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map