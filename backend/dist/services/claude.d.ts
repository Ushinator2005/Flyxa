import { Trade } from '../types/index';
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
export interface NewsFilterItem {
    headline: string;
    summary: string;
    impact: 'high' | 'medium' | 'low';
    category: string;
    marketImpact: {
        es: string;
        nq: string;
        note?: string;
    };
    isBreaking: boolean;
    source: string;
    timestamp: string;
    url?: string;
}
export declare function filterNewsItems(headlines: Array<{
    headline: string;
    source: string;
    timestamp: string;
    summary?: string;
    url?: string;
}>): Promise<NewsFilterItem[]>;
export interface JournalInsightPattern {
    id: string;
    type: 'Risk' | 'Edge' | 'Psychology' | 'Behaviour';
    status: 'Active' | 'Improving' | 'Confirmed' | 'Resolved';
    title: string;
    description: string;
    confidence: number;
    tradeDates: string[];
    tags: Array<{
        label: string;
        sentiment: 'positive' | 'negative' | 'neutral';
    }>;
    instrument: string;
    session: 'RTH open' | 'Overlap' | 'Midday';
}
export declare function analyzeJournalInsights(entries: Array<{
    date: string;
    trades: Array<{
        symbol: string;
        direction: string;
        result: string;
        pnl: number;
        rr: number;
        entryTime?: string;
        followedPlan?: boolean | null;
        processGrade?: number;
        thesis?: string;
        execution?: string;
        adjustment?: string;
    }>;
    pre?: string;
    post?: string;
    lessons?: string;
}>): Promise<JournalInsightPattern[]>;
//# sourceMappingURL=claude.d.ts.map