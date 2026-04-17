import { Trade, ExtractedTradeData } from '../types/index';
export declare function analyzeChartImage(base64Image: string, mimeType: string, entryDate: string, entryTime: string, focusImages?: Array<{
    base64Image: string;
    mimeType: string;
    label: string;
}>, scannerContext?: Record<string, unknown>): Promise<ExtractedTradeData>;
export declare function analyzeIndividualTrade(trade: Trade): Promise<string>;
export declare function analyzePatterns(trades: Trade[]): Promise<string>;
export declare function generateWeeklyReport(trades: Trade[], weekStart: string, weekEnd: string): Promise<string>;
export declare function generatePsychologyReport(trades: Trade[], psychLogs: Array<{
    date: string;
    mood: string;
    mindset_score: number;
    pre_session_notes: string;
    post_session_notes: string;
}>): Promise<string>;
export declare function compareTradeToPlaybook(trade: Trade, playbookEntries: Array<{
    setup_name: string;
    description: string;
    rules: string;
    ideal_conditions: string;
}>): Promise<string>;
export declare function answerFlyxaQuestion(question: string, history?: Array<{
    role: 'user' | 'assistant';
    content: string;
}>): Promise<string>;
export declare function analyzeChartAnalyzerImage(base64Image: string, mimeType: string, contractSize: number): Promise<Array<{
    symbol?: string;
    direction?: 'Long' | 'Short' | null;
    entry_price: number | null;
    stop_loss: number | null;
    take_profit: number | null;
    rr_ratio: string | null;
    outcome: 'WIN' | 'LOSS' | null;
    trade_duration: string | null;
    net_pnl: number | null;
}>>;
//# sourceMappingURL=claude.d.ts.map