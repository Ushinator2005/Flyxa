import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ExtractedTradeData } from '../types/index';

const GEMINI_MODEL_FALLBACK_CHAIN = ['gemini-2.5-pro', 'gemini-2.5-flash'];
const GEMINI_MAX_RETRIES_PER_MODEL = 2;
const GEMINI_BASE_RETRY_DELAY_MS = 900;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes('503') ||
    text.includes('service unavailable') ||
    text.includes('high demand') ||
    text.includes('overloaded') ||
    text.includes('deadline exceeded') ||
    text.includes('timed out') ||
    text.includes('timeout')
  );
}

async function generateWithFallback(
  genAI: GoogleGenerativeAI,
  systemPrompt: string,
  mimeType: string,
  base64Image: string
): Promise<{ text: string; model: string }> {
  const errors: string[] = [];

  for (const modelName of GEMINI_MODEL_FALLBACK_CHAIN) {
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES_PER_MODEL; attempt += 1) {
      try {
        const result = await model.generateContent([
          systemPrompt,
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
        ]);
        const text = result.response.text().trim();
        return { text, model: modelName };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`[${modelName}] ${message}`);
        const retryable = isRetryableGeminiError(message);
        const hasMoreAttempts = attempt < GEMINI_MAX_RETRIES_PER_MODEL;

        if (!retryable || !hasMoreAttempts) {
          break;
        }

        const delayMs = GEMINI_BASE_RETRY_DELAY_MS * (attempt + 1);
        await sleep(delayMs);
      }
    }
  }

  throw new Error(errors[errors.length - 1] ?? 'Gemini API error');
}

function parseNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseDirection(value: unknown): 'Long' | 'Short' | null {
  if (value === 'Long' || value === 'Short') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'long') return 'Long';
  if (normalized === 'short') return 'Short';
  return null;
}

function parseExitReason(value: unknown): 'TP' | 'SL' | null {
  if (value === 'TP' || value === 'SL') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'TP' || normalized === 'SL') return normalized;
  return null;
}

function parseTimeToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  const hhmm = normalized.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!hhmm) return null;
  const hour = Number(hhmm[1]);
  const minute = Number(hhmm[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export async function readTradeChart(
  base64Image: string,
  mimeType: string,
  userColors?: {
    stopLoss: string;
    takeProfit: string;
    entry: string;
  },
  boxBounds?: {
    leftRatio: number;
    rightRatio: number;
  }
): Promise<{
  symbol: string | null;
  direction: 'Long' | 'Short' | null;
  entry_price: number | null;
  sl_price: number | null;
  tp_price: number | null;
  exit_reason: 'TP' | 'SL' | null;
  trade_length_seconds: number | null;
  timeframe_minutes: number | null;
  entry_time: string | null;
  close_time: string | null;
  confidence: 'high' | 'medium' | 'low';
  evidence: string | null;
  warnings: string[];
}> {
  const colorSection = userColors
    ? `
USER COLOR SETTINGS (these are the exact colors the user has configured):
- Entry zone color: ${userColors.entry}
- Stop Loss zone color: ${userColors.stopLoss}
- Take Profit zone color: ${userColors.takeProfit}

CRITICAL COLOR MATCHING RULES:
1. On the right-hand price axis there are colored pill/box labels
2. Match each pill label color to the closest user color above
3. The pill matching entry color = entry_price
4. The pill matching stop loss color = sl_price
5. The pill matching take profit color = tp_price
6. IGNORE every other number, label, or price on the chart that does not match one of these three colors
7. Do NOT use position (top/bottom) to guess which is SL or TP — use COLOR ONLY to identify each level
`
    : `
DEFAULT COLOR RULES (user has not configured custom colors):
- GREY pill label at boundary between two zones = entry_price
- RED/PINK pill label at far edge of the risk zone = sl_price
- TEAL/GREEN pill label at far edge of the profit zone = tp_price
`;

  const systemPrompt = `You are a TradingView futures chart reader. Your ONLY job is to extract exact trade data from a P&L card screenshot.

STEP 1 — READ THE TICKER:
Look at the top-left corner of the chart for the instrument header.
Read the ticker symbol. Examples:
- 'NQM26 · 1 · CME' → symbol is NQ, timeframe_minutes is 1
- 'MNQM26 · 1' → symbol is MNQ, timeframe_minutes is 1
- 'ESM26 · 5' → symbol is ES, timeframe_minutes is 5
Always return the ROOT ticker only (NQ not NQM26, MNQ not MNQM26).
Valid roots: NQ, MNQ, ES, MES, YM, MYM, RTY, M2K, CL, MCL, GC, MGC, SI, 6E, 6B, BTC, MBT

STEP 2 — IDENTIFY PRICE LEVELS FROM COLORED LABELS:
${colorSection}

STEP 3 — DETERMINE DIRECTION:
- If take profit price > entry price → LONG
- If take profit price < entry price → SHORT
Use the prices you found in Step 2 to determine this. Never guess direction from box position alone.

STEP 4 — FIND THE EXIT (FIRST TOUCH ONLY, WITHIN THE P&L BOX ONLY):
${boxBounds
  ? `CRITICAL BOUNDARY: The colored P&L overlay spans from approximately ${Math.round(boxBounds.leftRatio * 100)}% to ${Math.round(boxBounds.rightRatio * 100)}% of the image width from the left edge.
YOU MUST STOP SCANNING AT THE RIGHT EDGE OF THE COLORED BOX (${Math.round(boxBounds.rightRatio * 100)}% from the left).
Any candle positioned to the RIGHT of this boundary is outside the trade — completely ignore it even if price reaches SL or TP there.
If neither SL nor TP is touched within the P&L box boundary, set exit_reason to null.`
  : `Only scan candles that fall within the colored P&L overlay region. Do not read price action outside the box.`}

Starting from the entry candle (left edge of the P&L box), scan candles strictly left to right one by one.

IMPORTANT — HOW TO CHECK IF A LEVEL WAS HIT:
You must compare the actual pixel height of each candle wick against the pixel height of the SL/TP price line.
A level is only hit if a candle wick visually reaches or crosses that exact price line on the chart.
The colored price labels on the right axis are reference markers only — their presence does NOT mean price touched that level.
Do NOT assume a level was hit just because the label is visible. Only count it if a candle wick inside the box clearly touches or crosses the price line.
When in doubt, set exit_reason to null rather than guessing.

For LONG trades:
- SL hit: a candle LOW wick visibly touches or goes below the sl_price line
- TP hit: a candle HIGH wick visibly touches or exceeds the tp_price line

For SHORT trades:
- SL hit: a candle HIGH wick visibly touches or exceeds the sl_price line
- TP hit: a candle LOW wick visibly touches or goes below the tp_price line

THE MOMENT either level is clearly touched within the box boundary, stop scanning immediately.
Record exit_reason as 'TP' or 'SL'.
IGNORE everything that happens after the first touch or after the right edge of the P&L box.
NEVER use the live floating price label (the highlighted current price box on the right axis that shows where price is right now) as any trade level.

STEP 5 — ESTIMATE DURATION:
entry_time: Read the x-axis time label at the LEFT EDGE of the colored P&L box (where the box starts). This is when the trade was entered.
close_time: Read the x-axis time label at the candle where price first crossed SL or TP (from Step 4). If exit_reason is null, use the right edge of the P&L box.
trade_length_seconds: Count candles from the left edge of the box to the exit candle, then multiply by timeframe_minutes × 60.

Return ONLY this raw JSON with no markdown, no explanation, no code fences:
{
  "symbol": string or null,
  "direction": "Long" or "Short" or null,
  "entry_price": number or null,
  "sl_price": number or null,
  "tp_price": number or null,
  "exit_reason": "TP" or "SL" or null,
  "trade_length_seconds": number or null,
  "timeframe_minutes": number or null,
  "entry_time": string or null,
  "close_time": string or null,
  "confidence": "high" or "medium" or "low",
  "evidence": string describing exactly what you saw for the exit decision,
  "warnings": array of strings for anything you were uncertain about
}`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
    const { text, model } = await generateWithFallback(genAI, systemPrompt, mimeType, base64Image);
    console.log(`[Gemini model] ${model}`);
    console.log('[Gemini raw]', text.slice(0, 500));
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      console.log('[Gemini parsed]', JSON.stringify(parsed).slice(0, 300));
      const entryTime = parseTimeToken(parsed.entry_time);
      const explicitCloseTime = parseTimeToken(parsed.close_time);
      const durationSecondsRaw = parseNullableNumber(parsed.trade_length_seconds);
      const durationSeconds = durationSecondsRaw !== null ? Math.max(0, Math.round(durationSecondsRaw)) : null;
      const timeframeMinutesRaw = parseNullableNumber(parsed.timeframe_minutes);
      const timeframeMinutes = timeframeMinutesRaw !== null ? Math.max(0, Math.round(timeframeMinutesRaw)) : null;
      return {
        symbol: typeof parsed.symbol === 'string' ? parsed.symbol : null,
        direction: parseDirection(parsed.direction),
        entry_price: parseNullableNumber(parsed.entry_price),
        sl_price: parseNullableNumber(parsed.sl_price),
        tp_price: parseNullableNumber(parsed.tp_price),
        exit_reason: parseExitReason(parsed.exit_reason),
        trade_length_seconds: durationSeconds,
        timeframe_minutes: timeframeMinutes,
        entry_time: entryTime,
        close_time: explicitCloseTime ?? addSecondsToHHMM(entryTime, durationSeconds),
        confidence: parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low',
        evidence: typeof parsed.evidence === 'string' ? parsed.evidence : null,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.filter((w: unknown) => typeof w === 'string') : [],
      };
    } catch {
      return nullResult(['Failed to parse Gemini response']);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini API error';
    return nullResult([msg]);
  }
}

function nullResult(warnings: string[]) {
  return {
    symbol: null,
    direction: null as null,
    entry_price: null,
    sl_price: null,
    tp_price: null,
    exit_reason: null as null,
    trade_length_seconds: null,
    timeframe_minutes: null,
    entry_time: null,
    close_time: null,
    confidence: 'low' as const,
    evidence: null,
    warnings,
  };
}

function addSecondsToHHMM(time: string | null, seconds: number | null): string | null {
  if (!time || !Number.isFinite(seconds ?? NaN) || (seconds ?? 0) < 0) return null;
  const [hText, mText] = time.split(':');
  const hours = Number(hText);
  const minutes = Number(mText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const totalMinutes = (hours * 60) + minutes + Math.round((seconds ?? 0) / 60);
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const outHours = Math.floor(normalized / 60).toString().padStart(2, '0');
  const outMinutes = (normalized % 60).toString().padStart(2, '0');
  return `${outHours}:${outMinutes}`;
}

export async function analyzeChartImage(
  base64Image: string,
  mimeType: string,
  entryDate: string,
  entryTime: string,
  focusImages: Array<{ base64Image: string; mimeType: string; label: string }> = [],
  scannerContext?: Record<string, unknown>
): Promise<ExtractedTradeData> {
  void focusImages;

  const colors = scannerContext?.scanner_colors as {
    supplyStopZone?: { hex: string };
    targetDemandZone?: { hex: string };
    entryZone?: { hex: string };
  } | undefined;

  const userColors = colors ? {
    stopLoss: colors.supplyStopZone?.hex ?? '#C0392B',
    takeProfit: colors.targetDemandZone?.hex ?? '#1A6B5A',
    entry: colors.entryZone?.hex ?? '#E67E22',
  } : undefined;

  const boxLeftRatio = typeof scannerContext?.box_left_ratio === 'number' ? scannerContext.box_left_ratio : null;
  const boxRightRatio = typeof scannerContext?.box_right_ratio === 'number' ? scannerContext.box_right_ratio : null;
  const boxBounds = boxLeftRatio !== null && boxRightRatio !== null
    ? { leftRatio: boxLeftRatio, rightRatio: boxRightRatio }
    : undefined;

  const result = await readTradeChart(base64Image, mimeType, userColors, boxBounds);

  return {
    symbol: result.symbol,
    direction: result.direction,
    entry_price: result.entry_price,
    entry_time: result.entry_time ?? entryTime ?? null,
    close_time: result.close_time,
    entry_time_confidence: result.confidence,
    sl_price: result.sl_price,
    tp_price: result.tp_price,
    trade_length_seconds: result.trade_length_seconds,
    candle_count: null,
    timeframe_minutes: result.timeframe_minutes,
    exit_reason: result.exit_reason,
    pnl_result: result.exit_reason === 'TP' ? 'Win' : result.exit_reason === 'SL' ? 'Loss' : null,
    exit_confidence: result.confidence,
    first_touch_candle_index: null,
    first_touch_evidence: result.evidence,
    warnings: result.warnings ?? [],
  };
}
