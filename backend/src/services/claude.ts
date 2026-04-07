import Anthropic from '@anthropic-ai/sdk';
import { Trade, ExtractedTradeData } from '../types/index';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';
const MODEL_TEMPERATURE = 0;
const EXIT_CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;
const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
const MANUAL_READING_PROCESS = `Read the chart in this exact order:

0. If the screenshot contains more than one chart or comparison pane, ONLY analyse the chart that contains the colored risk/reward box. Ignore every other chart, even if it shows correlated price action.

1. Read the symbol and timeframe from the top-left label of the chart that contains the risk/reward box.

2. Identify the P&L box: the semi-transparent overlay of TWO colored zones on the chart.
   - TEAL (mint/cyan green) zone = profit target area
   - PINK (light red/rose) zone = stop loss risk area

3. CRITICAL — Identify the three price levels attached to the P&L box boundaries:
   - GREY pill/box label on the right-side price axis = entry price. On the right axis you will see several colored pill-shaped labels: a GREEN one (live price — ignore it), a RED one (stop loss), and a GREY one (entry). The GREY pill label is at the boundary between the pink and teal zones. Read the number printed inside that grey pill exactly — it is the entry price. Do not read axis gridline text, do not interpolate between gridlines. The grey pill label is the same style as the red and green pills, just grey colored.
   - RED label on the right-side price axis = stop loss (the far edge of the pink zone)
   - The TAKE PROFIT is the far edge of the teal zone.

   HOW TO FIND THE TAKE PROFIT:
   a. Locate the teal box on the chart. Its far edge (top for Long, bottom for Short) is the TP level.
   b. Trace that far edge horizontally to the right-axis price scale to read the price.
   c. The TP is often where the teal box aligns with a horizontal line drawn on the chart.
   d. There may be a small teal/green label AT THAT EXACT EDGE — use it if visible.
   e. NEVER use the live/current-price label as the TP. The live price label is the topmost or bottom-most floating green label that shows the most recent market price — it is NOT attached to the P&L box and will be at a very different price from the teal box edge. If a green label is far outside the P&L box range, it is the live price — ignore it.
   f. If target-label-focus is attached, that crop is centered on the TP level. If you see a green label aligned with the teal box edge in that crop, use it as tp_price even if it resembles the live/current-price label.

4. Confirm direction from box layout:
   - Long: teal zone ABOVE entry, pink zone BELOW entry → tp_price > entry_price
   - Short: pink zone ABOVE entry, teal zone BELOW entry → tp_price < entry_price
   If your identified tp_price is outside the visible teal box, you have the wrong label — re-read step 3.

5. Read the entry time from the x-axis using the left edge of the P&L box.
6. Starting at the entry candle, move candle by candle to decide whether stop loss or take profit is touched first.
7. Count candles to the exit candle and calculate trade_length_seconds from the timeframe.

Do not invent labels that are not visible. Prefer the single most likely journal-ready answer.
Never use a second chart pane to decide exit order for the primary trade.`;
const FIRST_TOUCH_RULE = `The first touch decides the outcome.
- Stop scanning as soon as either stop loss or take profit is hit.
- Ignore any later move after the first touch.
- If price hits stop first and later reaches target, the correct result is still SL.
- If price hits target first and later reaches stop, the correct result is still TP.
- Sanity check: the exit candle must actually reach the exact TP or SL price level within its high/low. If no candle within the trade window has a wick that reaches the TP level, the outcome is SL (or inconclusive) — do not claim TP was hit unless a candle clearly reaches that price.`;

type ExitConfidence = typeof EXIT_CONFIDENCE_VALUES[number];
type ImageMimeType = typeof VALID_MIME_TYPES[number];

interface ChartImageInput {
  base64Image: string;
  mimeType: ImageMimeType;
  label: string;
}

interface ExitVerificationResult {
  exit_reason: 'TP' | 'SL' | null;
  trade_length_seconds: number | null;
  candle_count: number | null;
  timeframe_minutes: number | null;
  exit_confidence: ExitConfidence | null;
  first_touch_candle_index: number | null;
  first_touch_evidence: string | null;
}

interface LevelTouchSanityResult {
  stop_touched: boolean | null;
  target_touched: boolean | null;
  first_touch: 'TP' | 'SL' | null;
  evidence: string | null;
}

interface ExactPriceRead {
  direction: 'Long' | 'Short' | null;
  entry_price: number | null;
  sl_price: number | null;
  tp_price: number | null;
}

interface ScannerContext {
  direction_hint?: 'Long' | 'Short';
  chart_left_ratio?: number;
  chart_right_ratio?: number;
  box_left_ratio?: number;
  box_right_ratio?: number;
  entry_line_ratio?: number;
  stop_line_ratio?: number;
  target_line_ratio?: number;
  red_box?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  green_box?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
}

function parseJsonObject(rawText: string): Record<string, unknown> {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
}

function parseNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizeScannedSymbol(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value
    .toUpperCase()
    .replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, '');
}

function parseNullableTime(value: unknown): string | null {
  const normalized = parseNullableString(value);
  return normalized && /^\d{2}:\d{2}$/.test(normalized) ? normalized : null;
}

function parseNullableDirection(value: unknown): 'Long' | 'Short' | null {
  return value === 'Long' || value === 'Short' ? value : null;
}

function parseNullableExitReason(value: unknown): 'TP' | 'SL' | null {
  return value === 'TP' || value === 'SL' ? value : null;
}

function parseNullablePnLResult(value: unknown): 'Win' | 'Loss' | null {
  return value === 'Win' || value === 'Loss' ? value : null;
}

function parseNullableExitConfidence(value: unknown): ExitConfidence | null {
  return typeof value === 'string' && EXIT_CONFIDENCE_VALUES.includes(value as ExitConfidence)
    ? (value as ExitConfidence)
    : null;
}

function parseNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function pickFirstNonNull<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}

function appendWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function buildEntryTimeHint(extractedEntryTime: string | null): string {
  return extractedEntryTime
    ? `Use the screenshot's entry time of ${extractedEntryTime} only if it matches the x-axis.`
    : 'Do not use any fallback clock time to decide the outcome. Read the entry candle from the left edge of the risk/reward box on the screenshot.';
}

function formatScannerContext(scannerContext?: ScannerContext): string {
  if (!scannerContext) {
    return 'No geometric trade-box detection metadata was available.';
  }

  return `Detected trade-box geometry from image processing:
- direction_hint: ${scannerContext.direction_hint ?? 'unknown'}
- chart_left_ratio: ${scannerContext.chart_left_ratio ?? 'unknown'}
- chart_right_ratio: ${scannerContext.chart_right_ratio ?? 'unknown'}
- box_left_ratio: ${scannerContext.box_left_ratio ?? 'unknown'}
- box_right_ratio: ${scannerContext.box_right_ratio ?? 'unknown'}
- entry_line_ratio: ${scannerContext.entry_line_ratio ?? 'unknown'}
- stop_line_ratio: ${scannerContext.stop_line_ratio ?? 'unknown'}
- target_line_ratio: ${scannerContext.target_line_ratio ?? 'unknown'}
- red_box: ${scannerContext.red_box ? JSON.stringify(scannerContext.red_box) : 'unknown'}
- green_box: ${scannerContext.green_box ? JSON.stringify(scannerContext.green_box) : 'unknown'}

Use this geometry as a strong anchor for which chart pane contains the trade, where the risk/reward box starts, and whether the setup is long or short.`;
}

function describeImageLabel(label: string): string {
  switch (label) {
    case 'full_chart':
      return 'the full chart for overall candle sequence, x-axis timing, and confirmation';
    case 'header-focus':
      return 'a zoomed crop of the top-left chart header for symbol and timeframe';
    case 'trade-box-focus':
      return 'a zoomed crop around the trade box for direction, entry edge, and price movement';
    case 'entry-window-focus':
      return 'a tight crop around the left edge of the trade box and the first candles after entry; use this as the primary first-touch view';
    case 'exit-path-focus':
      return 'a focused crop covering the immediate candles after entry and the full path to the first likely exit touch';
    case 'price-label-focus':
      return 'a zoomed crop of the right-side price labels; use this for the exact entry, stop, and target numbers';
    case 'entry-label-focus':
      return 'a tight crop centered on the entry price label; use this as the primary source for entry_price';
    case 'stop-label-focus':
      return 'a tight crop centered on the stop-loss label; use this as the primary source for sl_price';
    case 'target-label-focus':
      return 'a tight crop centered on the take-profit label; use this as the primary source for tp_price';
    default:
      return 'an additional focused crop of the chart';
  }
}

function selectImagesByLabels(images: ChartImageInput[], labels: string[]): ChartImageInput[] {
  const allowedLabels = new Set(labels);
  const selected = images.filter(image => allowedLabels.has(image.label));

  if (selected.length > 0) {
    return selected;
  }

  return images.filter(image => image.label === 'full_chart');
}

function hasValidLevelStructure(direction: 'Long' | 'Short' | null, entry: number | null, stop: number | null, target: number | null): boolean {
  if (!direction || entry === null || stop === null || target === null) {
    return false;
  }

  return direction === 'Long'
    ? stop < entry && entry < target
    : target < entry && entry < stop;
}

function normalizeExitConfidence(...values: Array<ExitConfidence | null>): ExitConfidence | null {
  if (values.includes('high')) return 'high';
  if (values.includes('medium')) return 'medium';
  if (values.includes('low')) return 'low';
  return null;
}

function pickMostCommonString<T extends string>(...values: Array<T | null | undefined>): T | null {
  const counts = new Map<T, number>();

  values.forEach(value => {
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  });

  let bestValue: T | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  });

  return bestValue;
}

function countVotes(...values: Array<'TP' | 'SL' | null>): { TP: number; SL: number } {
  return values.reduce((acc, value) => {
    if (value === 'TP' || value === 'SL') {
      acc[value] += 1;
    }
    return acc;
  }, { TP: 0, SL: 0 });
}

function pickMostCommonNumber(...values: Array<number | null>): number | null {
  const counts = new Map<number, number>();

  values.forEach(value => {
    if (value !== null) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  });

  let bestValue: number | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  });

  return bestValue;
}

function chooseConsensusNumber(...values: Array<number | null | undefined>): number | null {
  const normalized = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (normalized.length === 0) {
    return null;
  }

  const mostCommon = pickMostCommonNumber(...normalized);
  if (mostCommon !== null) {
    return mostCommon;
  }

  const sorted = [...normalized].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function inferDirectionFromLevels(entry: number | null, stop: number | null, target: number | null): 'Long' | 'Short' | null {
  if (entry === null || stop === null || target === null) {
    return null;
  }

  if (stop < entry && entry < target) {
    return 'Long';
  }

  if (target < entry && entry < stop) {
    return 'Short';
  }

  return null;
}

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
  return Array.from(
    new Set(
      values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    )
  );
}

function repairTradeStructure(
  direction: 'Long' | 'Short' | null,
  entry: number | null,
  stop: number | null,
  target: number | null,
  labeledCandidates: {
    entries: Array<number | null | undefined>;
    stops: Array<number | null | undefined>;
    targets: Array<number | null | undefined>;
  }
): {
  direction: 'Long' | 'Short' | null;
  entry_price: number | null;
  sl_price: number | null;
  tp_price: number | null;
} {
  const resolvedDirection = direction ?? inferDirectionFromLevels(entry, stop, target);

  if (hasValidLevelStructure(resolvedDirection, entry, stop, target)) {
    return {
      direction: resolvedDirection,
      entry_price: entry,
      sl_price: stop,
      tp_price: target,
    };
  }

  const entryCandidates = uniqueNumbers(labeledCandidates.entries);
  const stopCandidates = uniqueNumbers(labeledCandidates.stops);
  const targetCandidates = uniqueNumbers(labeledCandidates.targets);
  const allCandidates = uniqueNumbers([...entryCandidates, ...stopCandidates, ...targetCandidates]);

  if (!resolvedDirection || allCandidates.length < 3) {
    return {
      direction: resolvedDirection,
      entry_price: entry,
      sl_price: stop,
      tp_price: target,
    };
  }

  const sortedAll = [...allCandidates].sort((a, b) => a - b);
  const minCandidate = sortedAll[0];
  const maxCandidate = sortedAll[sortedAll.length - 1];
  const interiorCandidates = sortedAll.filter(value => value > minCandidate && value < maxCandidate);

  const preferredEntry = chooseConsensusNumber(entry, ...entryCandidates);
  const preferredStop = chooseConsensusNumber(stop, ...stopCandidates);
  const preferredTarget = chooseConsensusNumber(target, ...targetCandidates);

  if (resolvedDirection === 'Long') {
    const repairedStop = stopCandidates.find(value => value < (preferredEntry ?? Number.POSITIVE_INFINITY)) ?? preferredStop ?? minCandidate;
    const repairedTarget = [...targetCandidates].reverse().find(value => value > (preferredEntry ?? Number.NEGATIVE_INFINITY)) ?? preferredTarget ?? maxCandidate;
    const repairedEntry = entryCandidates.find(value => value > repairedStop && value < repairedTarget)
      ?? preferredEntry
      ?? interiorCandidates[0]
      ?? sortedAll[Math.floor(sortedAll.length / 2)];

    return {
      direction: 'Long',
      entry_price: repairedEntry,
      sl_price: repairedStop,
      tp_price: repairedTarget,
    };
  }

  const repairedStop = [...stopCandidates].reverse().find(value => value > (preferredEntry ?? Number.NEGATIVE_INFINITY)) ?? preferredStop ?? maxCandidate;
  const repairedTarget = targetCandidates.find(value => value < (preferredEntry ?? Number.POSITIVE_INFINITY)) ?? preferredTarget ?? minCandidate;
  const repairedEntry = entryCandidates.find(value => value > repairedTarget && value < repairedStop)
    ?? preferredEntry
    ?? interiorCandidates[interiorCandidates.length - 1]
    ?? sortedAll[Math.floor(sortedAll.length / 2)];

  return {
    direction: 'Short',
    entry_price: repairedEntry,
    sl_price: repairedStop,
    tp_price: repairedTarget,
  };
}

function clearExitOutcome(data: ExtractedTradeData): void {
  data.exit_reason = null;
  data.pnl_result = null;
  data.trade_length_seconds = null;
  data.candle_count = null;
  data.exit_confidence = null;
  data.first_touch_candle_index = null;
  data.first_touch_evidence = null;
}

function sanitizeExtractedTradeData(raw: Record<string, unknown>): ExtractedTradeData {
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    : [];

  const data: ExtractedTradeData = {
    symbol: parseNullableString(raw.symbol),
    direction: parseNullableDirection(raw.direction),
    entry_price: parseNullableNumber(raw.entry_price),
    entry_time: parseNullableTime(raw.entry_time),
    entry_time_confidence: parseNullableExitConfidence(raw.entry_time_confidence),
    sl_price: parseNullableNumber(raw.sl_price),
    tp_price: parseNullableNumber(raw.tp_price),
    trade_length_seconds: parseNullableNumber(raw.trade_length_seconds),
    candle_count: parseNullableNumber(raw.candle_count),
    timeframe_minutes: parseNullableNumber(raw.timeframe_minutes),
    exit_reason: parseNullableExitReason(raw.exit_reason),
    pnl_result: parseNullablePnLResult(raw.pnl_result),
    exit_confidence: parseNullableExitConfidence(raw.exit_confidence),
    first_touch_candle_index: parseNullableNumber(raw.first_touch_candle_index),
    first_touch_evidence: parseNullableString(raw.first_touch_evidence),
    warnings,
  };

  if (data.symbol) {
    data.symbol = normalizeScannedSymbol(data.symbol);
  }

  if (data.exit_reason !== null) {
    data.pnl_result = data.exit_reason === 'TP' ? 'Win' : 'Loss';
  }

  return data;
}

function sanitizeExactPriceRead(raw: Record<string, unknown>): ExactPriceRead {
  return {
    direction: parseNullableDirection(raw.direction),
    entry_price: parseNullableNumber(raw.entry_price),
    sl_price: parseNullableNumber(raw.sl_price),
    tp_price: parseNullableNumber(raw.tp_price),
  };
}

async function extractExactPriceLevels(
  images: ChartImageInput[],
  scannerContext?: ScannerContext
): Promise<ExactPriceRead> {
  const systemPrompt = `You are reading ONLY the exact three price labels from TradingView risk/reward screenshots.
${MANUAL_READING_PROCESS}

Focus on price labels only:
- entry-label-focus is the primary source for entry_price
- stop-label-focus is the primary source for sl_price
- target-label-focus is the primary source for tp_price
- price-label-focus is the secondary source if one tight crop is slightly unclear
- trade-box-focus and full_chart are only for confirming long vs short and which label belongs to the box
- If a second chart exists in the screenshot, ignore it completely unless it is the one containing the colored risk/reward box

Critical rules:
- Read the numbers printed inside the pill labels exactly
- Do not round
- Do not use nearby gridline text
- Do not use unrelated horizontal drawing lines
- The grey entry label can be lower-contrast than the red and green labels; still use the printed grey pill value
- If the green target label is centered in target-label-focus and aligns with the teal box edge, treat it as tp_price even if it resembles a current-price label

Return ONLY a raw JSON object with these exact keys:
direction, entry_price, sl_price, tp_price`;

  return sanitizeExactPriceRead(await callClaudeJson(
    systemPrompt,
    images,
    `${formatScannerContext(scannerContext)} Read only the exact entry, stop-loss, and take-profit prices from these focused chart crops.`,
    500
  ));
}

function applyExactPriceRead(base: ExtractedTradeData, exactPriceRead: ExactPriceRead | null): ExtractedTradeData {
  if (!exactPriceRead) {
    return base;
  }

  const exactValueCount = [
    exactPriceRead.entry_price,
    exactPriceRead.sl_price,
    exactPriceRead.tp_price,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).length;

  if (exactValueCount < 2) {
    return base;
  }

  const repairedStructure = repairTradeStructure(
    pickMostCommonString(exactPriceRead.direction, base.direction),
    chooseConsensusNumber(exactPriceRead.entry_price, base.entry_price),
    chooseConsensusNumber(exactPriceRead.sl_price, base.sl_price),
    chooseConsensusNumber(exactPriceRead.tp_price, base.tp_price),
    {
      entries: [exactPriceRead.entry_price, base.entry_price],
      stops: [exactPriceRead.sl_price, base.sl_price],
      targets: [exactPriceRead.tp_price, base.tp_price],
    }
  );

  return {
    ...base,
    direction: repairedStructure.direction ?? base.direction,
    entry_price: repairedStructure.entry_price ?? base.entry_price,
    sl_price: repairedStructure.sl_price ?? base.sl_price,
    tp_price: repairedStructure.tp_price ?? base.tp_price,
  };
}

async function callClaudeJson(
  system: string,
  images: ChartImageInput[],
  userText: string,
  maxTokens = 1024
): Promise<Record<string, unknown>> {
  const imageContent = images.map(image => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: image.mimeType,
      data: image.base64Image,
    },
  }));

  const imageGuide = images
    .map((image, index) => `Image ${index + 1} (${image.label}): ${describeImageLabel(image.label)}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: maxTokens,
    system,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `${userText}\n\nAttached views:\n${imageGuide}`,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return parseJsonObject(content.text.trim());
}

async function extractTradeFacts(
  images: ChartImageInput[],
  entryDate: string,
  fallbackEntryTime: string,
  scannerContext?: ScannerContext
): Promise<ExtractedTradeData> {
  const systemPrompt = `You are a futures trade data extractor analysing TradingView screenshots with a risk/reward box.
${MANUAL_READING_PROCESS}

Read these facts directly from the screenshot:
- symbol
- direction
- entry_price
- entry_time
- sl_price
- tp_price
- timeframe_minutes

Never estimate price labels. Read the exact numbers shown on the right axis labels.
If entry-label-focus, stop-label-focus, or target-label-focus are attached, use those as the primary source for the exact prices.
If entry time is not clearly readable, return null for entry_time and low or null confidence.

Return ONLY a raw JSON object with these exact keys:
symbol, direction, entry_price, entry_time, entry_time_confidence, sl_price, tp_price, timeframe_minutes, exit_reason, pnl_result, trade_length_seconds, candle_count

Rules for these extra fields:
- You may include exit_reason, pnl_result, trade_length_seconds, candle_count if the chart is clear.
- If unclear, return null for them.
- exit_reason must be TP or SL only if you can visibly determine which was touched first.`;

  return sanitizeExtractedTradeData(await callClaudeJson(
    systemPrompt,
    images,
    `Trade date: ${entryDate}. Fallback entry time hint if the x-axis is unclear: ${fallbackEntryTime}. ${formatScannerContext(scannerContext)} Extract the trade facts from this screenshot.`,
    1100
  ));
}

async function verifyExitOrder(
  images: ChartImageInput[],
  entryDate: string,
  extraction: ExtractedTradeData,
  scannerContext?: ScannerContext
): Promise<ExitVerificationResult> {
  const verificationPrompt = `You are verifying which fixed level is hit first in a futures trade screenshot.
${MANUAL_READING_PROCESS}
${FIRST_TOUCH_RULE}

Use these fixed trade details as ground truth:
- Direction: ${extraction.direction}
- Entry price: ${extraction.entry_price}
- Entry time from screenshot if visible: ${extraction.entry_time ?? 'unknown'}
- Stop loss: ${extraction.sl_price}
- Take profit: ${extraction.tp_price}

Use only the screenshot itself.
Use the candle aligned with the left edge of the risk/reward box as the entry candle.
Scan forward candle by candle from the entry candle.
If multiple charts are visible in any crop, ONLY use the chart containing the colored risk/reward box and ignore the comparison chart.
Before deciding exit_reason, explicitly identify:
- which candle is the entry candle
- which candle is the first candle to touch either stop or target
- which exact level that first-touch candle reaches first

Rules:
- For LONG: if any candle low touches or breaks the stop before any candle high touches or breaks the target, exit_reason = SL.
- For LONG: if any candle high touches or breaks the target before any candle low touches or breaks the stop, exit_reason = TP.
- For SHORT: if any candle high touches or breaks the stop before any candle low touches or breaks the target, exit_reason = SL.
- For SHORT: if any candle low touches or breaks the target before any candle high touches or breaks the stop, exit_reason = TP.
- If both levels are touched in the same candle, return the level that is more visually likely to have been hit first.
- Only use null if the chart is too unclear to make a reasonable decision.
- candle_count must include the exit candle.
- trade_length_seconds = candle_count x timeframe_minutes x 60.
- first_touch_evidence must mention the first move that ends the trade, not the later continuation.

Return ONLY a raw JSON object with these exact keys:
exit_reason, trade_length_seconds, candle_count, timeframe_minutes, exit_confidence, first_touch_candle_index, first_touch_evidence

Valid values:
- exit_reason: "TP", "SL", or null
- exit_confidence: "high", "medium", "low", or null
- first_touch_evidence: one short sentence or null

The evidence sentence must mention the entry anchor and the first candle that ends the trade.`;

  const parsed = await callClaudeJson(
    verificationPrompt,
    images,
    `Trade date: ${entryDate}. ${buildEntryTimeHint(extraction.entry_time)} Verify which level hits first from the screenshot.`,
    800
  );

  return {
    exit_reason: parseNullableExitReason(parsed.exit_reason),
    trade_length_seconds: parseNullableNumber(parsed.trade_length_seconds),
    candle_count: parseNullableNumber(parsed.candle_count),
    timeframe_minutes: parseNullableNumber(parsed.timeframe_minutes),
    exit_confidence: parseNullableExitConfidence(parsed.exit_confidence),
    first_touch_candle_index: parseNullableNumber(parsed.first_touch_candle_index),
    first_touch_evidence: parseNullableString(parsed.first_touch_evidence),
  };
}

async function sanityCheckLevelTouches(
  images: ChartImageInput[],
  entryDate: string,
  extraction: ExtractedTradeData
): Promise<LevelTouchSanityResult> {
  const sanityPrompt = `You are performing a strict sanity check on a futures trade screenshot.
${MANUAL_READING_PROCESS}
${FIRST_TOUCH_RULE}

Your only job is to answer these three questions from the chart with the colored risk/reward box:
1. Is the stop-loss level touched at any point after the entry candle?
2. Is the take-profit level touched at any point after the entry candle?
3. Which one is touched first?

Trade details to verify:
- Direction: ${extraction.direction}
- Entry price: ${extraction.entry_price}
- Entry time from chart if visible: ${extraction.entry_time ?? 'unknown'}
- Stop loss: ${extraction.sl_price}
- Take profit: ${extraction.tp_price}

Rules:
- Use only the chart containing the risk/reward box.
- Start from the entry candle aligned with the left edge of the box.
- A level counts as touched only if a candle wick or body clearly reaches that exact level.
- If target is never visibly reached, target_touched must be false.
- If stop is visibly reached before target, first_touch must be SL.
- If target is visibly reached before stop, first_touch must be TP.
- If neither is clearly touched, return null for first_touch.

Return ONLY a raw JSON object with these exact keys:
stop_touched, target_touched, first_touch, evidence`;

  const parsed = await callClaudeJson(
    sanityPrompt,
    images,
    `Trade date: ${entryDate}. Perform only the stop/target touch sanity check for this screenshot.`,
    500
  );

  return {
    stop_touched: parseNullableBoolean(parsed.stop_touched),
    target_touched: parseNullableBoolean(parsed.target_touched),
    first_touch: parseNullableExitReason(parsed.first_touch),
    evidence: parseNullableString(parsed.evidence),
  };
}

async function humanStyleReview(
  images: ChartImageInput[],
  entryDate: string,
  fallbackEntryTime: string,
  scannerContext?: ScannerContext
): Promise<ExtractedTradeData> {
  const reviewPrompt = `Review this chart exactly like a skilled human trader filling out a trade journal by eye.
${MANUAL_READING_PROCESS}
${FIRST_TOUCH_RULE}

Use only the screenshot itself and read it in this exact order:
1. Read the symbol and timeframe from the top-left label.
2. Read entry, stop loss, and take profit from the exact right-axis labels.
3. Infer long or short from the box layout.
4. Read the entry time from the x-axis using the left edge of the risk/reward box.
5. Follow candles from the entry candle until the first touch of stop or target.
6. Count candles to the exit and compute trade_length_seconds.

You should make the most likely decision even when the chart is slightly messy, but do not invent price labels.

Return ONLY a raw JSON object with these exact keys:
symbol, direction, entry_price, entry_time, entry_time_confidence, sl_price, tp_price, timeframe_minutes, exit_reason, pnl_result, trade_length_seconds, candle_count, exit_confidence, first_touch_evidence`;

  return sanitizeExtractedTradeData(await callClaudeJson(
    reviewPrompt,
    images,
    `Trade date: ${entryDate}. ${buildEntryTimeHint(null)} Fallback time for the form is ${fallbackEntryTime}, but do not let that override the chart itself. Read this chart the same way a human would fill a journal entry.`,
    1200
  ));
}

async function decisiveFinalReview(
  images: ChartImageInput[],
  entryDate: string,
  fallbackEntryTime: string,
  extraction: ExtractedTradeData,
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  scannerContext?: ScannerContext
): Promise<ExtractedTradeData> {
  const decisivePrompt = `You are the final decision-maker for a futures trade journal scanner.

Your job is to read the TradingView screenshot exactly the way an experienced trader would manually journal it.
You must return one single best final answer, not an abstention.

${MANUAL_READING_PROCESS}
${FIRST_TOUCH_RULE}

Use header-focus for symbol/timeframe, the three label-focus crops for exact levels, entry-window-focus for the exact entry anchor, and exit-path-focus for the first-touch path after entry.
If a comparison chart is visible anywhere, ignore it unless it is the chart with the colored risk/reward box.

If the earlier passes disagree, use them only as hints. The screenshot itself is the source of truth.
Do not return manual review text. Choose the single most likely final interpretation.
Never invent price levels that are not visible on the screenshot. If one field is slightly unclear, use the best supported value from the hints below.

Hint pass 1:
${JSON.stringify({
  symbol: extraction.symbol,
  direction: extraction.direction,
  entry_price: extraction.entry_price,
  entry_time: extraction.entry_time,
  sl_price: extraction.sl_price,
  tp_price: extraction.tp_price,
  timeframe_minutes: extraction.timeframe_minutes,
  exit_reason: extraction.exit_reason,
  trade_length_seconds: extraction.trade_length_seconds,
  candle_count: extraction.candle_count,
}, null, 2)}

Hint pass 2:
${JSON.stringify(verification, null, 2)}

Hint pass 3:
${JSON.stringify({
  symbol: humanReview.symbol,
  direction: humanReview.direction,
  entry_price: humanReview.entry_price,
  entry_time: humanReview.entry_time,
  sl_price: humanReview.sl_price,
  tp_price: humanReview.tp_price,
  timeframe_minutes: humanReview.timeframe_minutes,
  exit_reason: humanReview.exit_reason,
  trade_length_seconds: humanReview.trade_length_seconds,
  candle_count: humanReview.candle_count,
  first_touch_evidence: humanReview.first_touch_evidence,
}, null, 2)}

Return ONLY a raw JSON object with these exact keys:
symbol, direction, entry_price, entry_time, entry_time_confidence, sl_price, tp_price, timeframe_minutes, exit_reason, pnl_result, trade_length_seconds, candle_count, exit_confidence, first_touch_evidence`;

  return sanitizeExtractedTradeData(await callClaudeJson(
    decisivePrompt,
    images,
    `Trade date: ${entryDate}. ${buildEntryTimeHint(extraction.entry_time ?? humanReview.entry_time)} ${formatScannerContext(scannerContext)} Fallback time for the form is ${fallbackEntryTime}, but do not let that override the chart itself. Produce the single best final journal-ready trade analysis from this screenshot.`,
    1400
  ));
}

function resolveExitReason(
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  decisiveReview: ExtractedTradeData,
  extraction: ExtractedTradeData
): 'TP' | 'SL' | null {
  if (verification.exit_reason && humanReview.exit_reason === verification.exit_reason) {
    return verification.exit_reason;
  }

  if (verification.exit_reason && decisiveReview.exit_reason === verification.exit_reason) {
    return verification.exit_reason;
  }

  if (humanReview.exit_reason && decisiveReview.exit_reason === humanReview.exit_reason) {
    return humanReview.exit_reason;
  }

  return verification.exit_reason
    ?? humanReview.exit_reason
    ?? decisiveReview.exit_reason
    ?? extraction.exit_reason;
}

function buildManualReaderBase(
  extraction: ExtractedTradeData,
  humanReview: ExtractedTradeData,
  fallbackEntryTime: string
): ExtractedTradeData {
  const warnings = [
    ...(extraction.warnings ?? []),
    ...(humanReview.warnings ?? []),
  ];

  const humanStructureValid = hasValidLevelStructure(
    humanReview.direction,
    humanReview.entry_price,
    humanReview.sl_price,
    humanReview.tp_price
  );
  const extractionStructureValid = hasValidLevelStructure(
    extraction.direction,
    extraction.entry_price,
    extraction.sl_price,
    extraction.tp_price
  );

  const repairedStructure = repairTradeStructure(
    humanReview.direction ?? extraction.direction,
    chooseConsensusNumber(humanReview.entry_price, extraction.entry_price),
    chooseConsensusNumber(humanReview.sl_price, extraction.sl_price),
    chooseConsensusNumber(humanReview.tp_price, extraction.tp_price),
    {
      entries: [humanReview.entry_price, extraction.entry_price],
      stops: [humanReview.sl_price, extraction.sl_price],
      targets: [humanReview.tp_price, extraction.tp_price],
    }
  );

  const direction = humanStructureValid
    ? humanReview.direction
    : extractionStructureValid
      ? extraction.direction
      : repairedStructure.direction;
  const entryPrice = humanStructureValid
    ? humanReview.entry_price
    : extractionStructureValid
      ? extraction.entry_price
      : repairedStructure.entry_price;
  const stopPrice = humanStructureValid
    ? humanReview.sl_price
    : extractionStructureValid
      ? extraction.sl_price
      : repairedStructure.sl_price;
  const targetPrice = humanStructureValid
    ? humanReview.tp_price
    : extractionStructureValid
      ? extraction.tp_price
      : repairedStructure.tp_price;

  return {
    symbol: humanReview.symbol ?? extraction.symbol,
    direction,
    entry_price: entryPrice,
    entry_time: humanReview.entry_time ?? extraction.entry_time ?? parseNullableTime(fallbackEntryTime),
    entry_time_confidence: normalizeExitConfidence(humanReview.entry_time_confidence, extraction.entry_time_confidence, 'low'),
    sl_price: stopPrice,
    tp_price: targetPrice,
    trade_length_seconds: null,
    candle_count: null,
    timeframe_minutes: humanReview.timeframe_minutes ?? extraction.timeframe_minutes ?? 1,
    exit_reason: null,
    pnl_result: null,
    exit_confidence: null,
    first_touch_candle_index: null,
    first_touch_evidence: null,
    warnings,
  };
}

function finalizeManualReaderResult(
  baseRead: ExtractedTradeData,
  verification: ExitVerificationResult,
  extraction: ExtractedTradeData,
  humanReview: ExtractedTradeData
): ExtractedTradeData {
  const exitReason = verification.exit_reason
    ?? humanReview.exit_reason
    ?? extraction.exit_reason
    ?? null;

  return {
    ...baseRead,
    exit_reason: exitReason,
    pnl_result: exitReason === 'TP' ? 'Win' : exitReason === 'SL' ? 'Loss' : null,
    trade_length_seconds: verification.trade_length_seconds
      ?? humanReview.trade_length_seconds
      ?? extraction.trade_length_seconds
      ?? null,
    candle_count: verification.candle_count
      ?? humanReview.candle_count
      ?? extraction.candle_count
      ?? null,
    timeframe_minutes: verification.timeframe_minutes
      ?? baseRead.timeframe_minutes
      ?? null,
    exit_confidence: verification.exit_confidence
      ?? humanReview.exit_confidence
      ?? extraction.exit_confidence
      ?? 'low',
    first_touch_candle_index: verification.first_touch_candle_index
      ?? humanReview.first_touch_candle_index
      ?? extraction.first_touch_candle_index
      ?? null,
    first_touch_evidence: verification.first_touch_evidence
      ?? humanReview.first_touch_evidence
      ?? extraction.first_touch_evidence
      ?? null,
  };
}

function applySanityOverride(
  result: ExtractedTradeData,
  sanity: LevelTouchSanityResult | null
): ExtractedTradeData {
  if (!sanity) {
    return result;
  }

  const next = { ...result };

  if (sanity.target_touched === false && sanity.stop_touched === true) {
    next.exit_reason = 'SL';
  } else if (sanity.target_touched === true && sanity.stop_touched === false) {
    next.exit_reason = 'TP';
  } else if (sanity.first_touch) {
    next.exit_reason = sanity.first_touch;
  }

  if (next.exit_reason) {
    next.pnl_result = next.exit_reason === 'TP' ? 'Win' : 'Loss';
  }

  if (sanity.evidence) {
    next.first_touch_evidence = sanity.evidence;
  }

  return next;
}

function hasHighConfidenceExit(
  source: ExtractedTradeData | ExitVerificationResult,
  exitReason: 'TP' | 'SL'
): boolean {
  return source.exit_reason === exitReason && source.exit_confidence === 'high';
}

function applyConservativeExitDecision(
  result: ExtractedTradeData,
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  decisiveReview: ExtractedTradeData,
  extraction: ExtractedTradeData,
  sanity: LevelTouchSanityResult | null
): ExtractedTradeData {
  const next = { ...result };
  const votes = countVotes(
    verification.exit_reason,
    humanReview.exit_reason,
    decisiveReview.exit_reason,
    extraction.exit_reason
  );

  if (sanity?.stop_touched === true && sanity?.target_touched === false) {
    next.exit_reason = 'SL';
  } else if (sanity?.target_touched === true && sanity?.stop_touched === false) {
    next.exit_reason = 'TP';
  } else if (votes.SL >= 2 && votes.TP <= 1) {
    next.exit_reason = 'SL';
  } else if (votes.TP >= 2 && votes.SL === 0) {
    next.exit_reason = 'TP';
  } else if (
    next.exit_reason === 'TP' &&
    votes.SL >= 1 &&
    !hasHighConfidenceExit(verification, 'TP') &&
    !hasHighConfidenceExit(humanReview, 'TP') &&
    !hasHighConfidenceExit(decisiveReview, 'TP')
  ) {
    next.exit_reason = 'SL';
    appendWarning(
      next.warnings ?? (next.warnings = []),
      'Exit-order signals disagreed, so the scanner used the conservative stop-first fallback.'
    );
  }

  if (votes.TP > 0 && votes.SL > 0) {
    appendWarning(
      next.warnings ?? (next.warnings = []),
      'Exit-order signals disagreed across scanner passes.'
    );
  }

  if (next.exit_reason) {
    next.pnl_result = next.exit_reason === 'TP' ? 'Win' : 'Loss';
  }

  return next;
}

function buildConsensusTradeAnalysis(
  extraction: ExtractedTradeData,
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  decisiveReview: ExtractedTradeData,
  fallbackEntryTime: string
): ExtractedTradeData {
  const warnings = [
    ...(extraction.warnings ?? []),
    ...(humanReview.warnings ?? []),
    ...(decisiveReview.warnings ?? []),
  ];

  const resolvedStructure = repairTradeStructure(
    pickMostCommonString(decisiveReview.direction, humanReview.direction, extraction.direction),
    chooseConsensusNumber(decisiveReview.entry_price, humanReview.entry_price, extraction.entry_price),
    chooseConsensusNumber(decisiveReview.sl_price, humanReview.sl_price, extraction.sl_price),
    chooseConsensusNumber(decisiveReview.tp_price, humanReview.tp_price, extraction.tp_price),
    {
      entries: [decisiveReview.entry_price, humanReview.entry_price, extraction.entry_price],
      stops: [decisiveReview.sl_price, humanReview.sl_price, extraction.sl_price],
      targets: [decisiveReview.tp_price, humanReview.tp_price, extraction.tp_price],
    }
  );

  const result: ExtractedTradeData = {
    symbol: decisiveReview.symbol
      ?? pickMostCommonString(humanReview.symbol, extraction.symbol)
      ?? pickFirstNonNull(humanReview.symbol, extraction.symbol),
    direction: resolvedStructure.direction,
    entry_price: resolvedStructure.entry_price,
    entry_time: pickFirstNonNull(decisiveReview.entry_time, humanReview.entry_time, extraction.entry_time, parseNullableTime(fallbackEntryTime)),
    entry_time_confidence: normalizeExitConfidence(decisiveReview.entry_time_confidence, humanReview.entry_time_confidence, extraction.entry_time_confidence, 'low'),
    sl_price: resolvedStructure.sl_price,
    tp_price: resolvedStructure.tp_price,
    trade_length_seconds: null,
    candle_count: null,
    timeframe_minutes: decisiveReview.timeframe_minutes
      ?? chooseConsensusNumber(humanReview.timeframe_minutes, verification.timeframe_minutes, extraction.timeframe_minutes),
    exit_reason: null,
    pnl_result: null,
    exit_confidence: null,
    first_touch_candle_index: null,
    first_touch_evidence: null,
    warnings,
  };

  if (!hasValidLevelStructure(result.direction, result.entry_price, result.sl_price, result.tp_price)) {
    result.direction = inferDirectionFromLevels(result.entry_price, result.sl_price, result.tp_price);
  }

  const votes = countVotes(decisiveReview.exit_reason, extraction.exit_reason, verification.exit_reason, humanReview.exit_reason);
  result.exit_reason = resolveExitReason(verification, humanReview, decisiveReview, extraction);

  const durationSource = [
    verification.exit_reason === result.exit_reason ? verification : null,
    humanReview.exit_reason === result.exit_reason ? humanReview : null,
    decisiveReview.exit_reason === result.exit_reason ? decisiveReview : null,
    extraction.exit_reason === result.exit_reason ? extraction : null,
  ].find(Boolean) as (ExtractedTradeData | ExitVerificationResult | null);

  result.trade_length_seconds = chooseConsensusNumber(
    durationSource?.trade_length_seconds,
    verification.trade_length_seconds,
    humanReview.trade_length_seconds,
    decisiveReview.trade_length_seconds,
    extraction.trade_length_seconds
  );
  result.candle_count = chooseConsensusNumber(
    durationSource?.candle_count,
    verification.candle_count,
    humanReview.candle_count,
    decisiveReview.candle_count,
    extraction.candle_count
  );
  result.timeframe_minutes = result.timeframe_minutes ?? durationSource?.timeframe_minutes ?? null;
  result.pnl_result = result.exit_reason === 'TP' ? 'Win' : result.exit_reason === 'SL' ? 'Loss' : null;
  result.exit_confidence = verification.exit_confidence
    ?? humanReview.exit_confidence
    ?? decisiveReview.exit_confidence
    ?? (votes.TP === 3 || votes.SL === 3
    ? 'high'
    : votes.TP >= 2 || votes.SL >= 2
      ? 'medium'
      : normalizeExitConfidence(extraction.exit_confidence, 'low'));
  result.first_touch_candle_index = pickFirstNonNull(verification.first_touch_candle_index, humanReview.first_touch_candle_index, result.candle_count);
  result.first_touch_evidence = pickFirstNonNull(verification.first_touch_evidence, humanReview.first_touch_evidence, decisiveReview.first_touch_evidence, extraction.first_touch_evidence);

  if (result.trade_length_seconds === null && result.candle_count !== null && result.timeframe_minutes !== null) {
    result.trade_length_seconds = result.candle_count * result.timeframe_minutes * 60;
  }

  if (result.entry_time === null) {
    result.entry_time = parseNullableTime(fallbackEntryTime);
    result.entry_time_confidence = 'low';
  }

  return result;
}

export async function analyzeChartImage(
  base64Image: string,
  mimeType: string,
  entryDate: string,
  entryTime: string,
  focusImages: Array<{ base64Image: string; mimeType: string; label: string }> = [],
  scannerContext?: Record<string, unknown>
): Promise<ExtractedTradeData> {
  const safeMimeType: ImageMimeType = VALID_MIME_TYPES.includes(mimeType as ImageMimeType)
    ? (mimeType as ImageMimeType)
    : 'image/jpeg';
  const analysisImages: ChartImageInput[] = [
    { base64Image, mimeType: safeMimeType, label: 'full_chart' },
    ...focusImages.map((image, index) => ({
      base64Image: image.base64Image,
      mimeType: VALID_MIME_TYPES.includes(image.mimeType as ImageMimeType)
        ? (image.mimeType as ImageMimeType)
        : 'image/jpeg',
      label: image.label || `focus_${index + 1}`,
    })),
  ];
  const normalizedScannerContext = scannerContext as ScannerContext | undefined;
  const exactPriceImages = selectImagesByLabels(analysisImages, [
    'trade-box-focus',
    'price-label-focus',
    'entry-label-focus',
    'stop-label-focus',
    'target-label-focus',
  ]);
  const extractionImages = selectImagesByLabels(analysisImages, [
    'header-focus',
    'trade-box-focus',
    'entry-window-focus',
    'exit-path-focus',
    'price-label-focus',
    'entry-label-focus',
    'stop-label-focus',
    'target-label-focus',
  ]);
  const verificationImages = selectImagesByLabels(analysisImages, [
    'header-focus',
    'trade-box-focus',
    'entry-window-focus',
    'exit-path-focus',
    'price-label-focus',
    'entry-label-focus',
    'stop-label-focus',
    'target-label-focus',
  ]);
  const sanityImages = selectImagesByLabels(analysisImages, [
    'trade-box-focus',
    'entry-window-focus',
    'exit-path-focus',
    'stop-label-focus',
    'target-label-focus',
  ]);
  const preAnalysisWarnings: string[] = [];
  let exactPriceRead: ExactPriceRead | null = null;

  try {
    exactPriceRead = await extractExactPriceLevels(exactPriceImages, normalizedScannerContext);
  } catch {
    preAnalysisWarnings.push('Exact price-label review failed, so price levels relied on the broader chart reads.');
  }

  const extraction = applyExactPriceRead(
    await extractTradeFacts(extractionImages, entryDate, entryTime, normalizedScannerContext),
    exactPriceRead
  );
  const rawHumanReview = applyExactPriceRead(
    await humanStyleReview(extractionImages, entryDate, entryTime, normalizedScannerContext),
    exactPriceRead
  );
  const baseRead = buildManualReaderBase(extraction, rawHumanReview, entryTime);
  preAnalysisWarnings.forEach(warning => appendWarning(baseRead.warnings ?? (baseRead.warnings = []), warning));

  let verification: ExitVerificationResult = {
    exit_reason: baseRead.exit_reason,
    trade_length_seconds: baseRead.trade_length_seconds,
    candle_count: baseRead.candle_count,
    timeframe_minutes: baseRead.timeframe_minutes,
    exit_confidence: baseRead.exit_confidence,
    first_touch_candle_index: baseRead.first_touch_candle_index,
    first_touch_evidence: baseRead.first_touch_evidence,
  };

  try {
    verification = await verifyExitOrder(verificationImages, entryDate, baseRead, normalizedScannerContext);
  } catch {
    appendWarning(baseRead.warnings ?? (baseRead.warnings = []), 'Exit verification failed, so the final answer relied on the manual chart read.');
  }

  let sanityCheck: LevelTouchSanityResult | null = null;
  try {
    sanityCheck = await sanityCheckLevelTouches(sanityImages, entryDate, baseRead);
  } catch {
    appendWarning(baseRead.warnings ?? (baseRead.warnings = []), 'Stop/target sanity check failed, so the final answer relied on the broader exit review.');
  }

  let decisiveReview = rawHumanReview;
  try {
    decisiveReview = applyExactPriceRead(
      await decisiveFinalReview(
        extractionImages,
        entryDate,
        entryTime,
        extraction,
        verification,
        rawHumanReview,
        normalizedScannerContext
      ),
      exactPriceRead
    );
  } catch {
    appendWarning(baseRead.warnings ?? (baseRead.warnings = []), 'Final consensus review failed, so the result relied on the primary extraction passes.');
  }

  const consensus = applyExactPriceRead(
    buildConsensusTradeAnalysis(
      extraction,
      verification,
      rawHumanReview,
      decisiveReview,
      entryTime
    ),
    exactPriceRead
  );
  const fallbackResult = applyExactPriceRead(
    finalizeManualReaderResult(baseRead, verification, extraction, rawHumanReview),
    exactPriceRead
  );
  const structureSafeResult = hasValidLevelStructure(consensus.direction, consensus.entry_price, consensus.sl_price, consensus.tp_price)
    ? consensus
    : fallbackResult;
  const finalResult = applyConservativeExitDecision(
    applySanityOverride(structureSafeResult, sanityCheck),
    verification,
    rawHumanReview,
    decisiveReview,
    extraction,
    sanityCheck
  );

  finalResult.warnings = [
    ...(finalResult.warnings ?? []),
    ...(baseRead.warnings ?? []),
  ];

  return finalResult;
}

export async function analyzeIndividualTrade(trade: Trade): Promise<string> {
  const rr = trade.sl_price && trade.entry_price && trade.tp_price
    ? Math.abs(trade.tp_price - trade.entry_price) / Math.abs(trade.sl_price - trade.entry_price)
    : 0;

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 2048,
    system: `You are a brutally honest professional futures trading coach with 20+ years of experience.
Your job is to give traders raw, unfiltered feedback on their trades. Do not sugarcoat.
Be direct, insightful, and constructive. Focus on what they did right, what they did wrong,
and exactly what they need to improve. Use specific numbers from the trade.`,
    messages: [
      {
        role: 'user',
        content: `Analyse this trade in detail:

Symbol: ${trade.symbol}
Direction: ${trade.direction}
Date: ${trade.trade_date} at ${trade.trade_time}
Session: ${trade.session}
Entry: ${trade.entry_price}
Stop Loss: ${trade.sl_price}
Take Profit: ${trade.tp_price}
Exit Price: ${trade.exit_price}
Exit Reason: ${trade.exit_reason}
Contracts: ${trade.contract_size}
Point Value: $${trade.point_value}
P&L: $${trade.pnl.toFixed(2)}
R:R Ratio: ${rr.toFixed(2)}
Trade Duration: ${trade.trade_length_seconds ? Math.round(trade.trade_length_seconds / 60) + ' minutes' : 'unknown'}
Emotional State: ${trade.emotional_state}
Confidence Level: ${trade.confidence_level}/10
Followed Plan: ${trade.followed_plan ? 'Yes' : 'No'}
Pre-trade Notes: ${trade.pre_trade_notes || 'None'}
Post-trade Notes: ${trade.post_trade_notes || 'None'}

Provide a brutally honest breakdown covering:
1. Trade quality assessment
2. Risk management evaluation
3. Execution analysis
4. Psychology and emotional factors
5. What was done well (if anything)
6. Key mistakes and how to fix them
7. Specific actionable improvements for next time`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function analyzePatterns(trades: Trade[]): Promise<string> {
  const tradeSummaries = trades.map(t => ({
    symbol: t.symbol,
    direction: t.direction,
    date: t.trade_date,
    time: t.trade_time,
    session: t.session,
    pnl: t.pnl,
    exit_reason: t.exit_reason,
    emotional_state: t.emotional_state,
    confidence: t.confidence_level,
    followed_plan: t.followed_plan,
    rr: t.sl_price && t.entry_price && t.tp_price
      ? (Math.abs(t.tp_price - t.entry_price) / Math.abs(t.sl_price - t.entry_price)).toFixed(2)
      : 'N/A',
  }));

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 3000,
    system: `You are a professional trading performance analyst specialising in pattern recognition and behavioral finance.
Analyse trading data to find actionable patterns, both profitable and detrimental.
Be specific with numbers and percentages. Identify root causes of problems.`,
    messages: [
      {
        role: 'user',
        content: `Analyse these ${trades.length} futures trades and identify all significant patterns:

${JSON.stringify(tradeSummaries, null, 2)}

Provide a comprehensive pattern analysis covering:
1. Best performing setups (time, session, symbol, direction)
2. Worst performing patterns and why
3. Emotional state impact on performance
4. Plan adherence correlation with results
5. Risk management patterns
6. Time-of-day and session edge analysis
7. Confidence calibration (do high confidence trades perform better?)
8. Most critical behavioural improvements needed
9. Top 3 strengths to capitalise on
10. Top 3 weaknesses that are costing the most money`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function generateWeeklyReport(
  trades: Trade[],
  weekStart: string,
  weekEnd: string
): Promise<string> {
  const wins = trades.filter(t => t.exit_reason === 'TP');
  const losses = trades.filter(t => t.exit_reason === 'SL');
  const netPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length * 100).toFixed(1) : '0';

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 3000,
    system: `You are a professional trading performance coach generating weekly review reports.
Create comprehensive, structured reports that help traders improve systematically.
Be specific, actionable, and data-driven. Format your response with clear sections using markdown.`,
    messages: [
      {
        role: 'user',
        content: `Generate a comprehensive weekly performance report for the week of ${weekStart} to ${weekEnd}.

Summary Statistics:
- Total Trades: ${trades.length}
- Wins: ${wins.length} | Losses: ${losses.length}
- Win Rate: ${winRate}%
- Net P&L: $${netPnL.toFixed(2)}

Individual Trades:
${JSON.stringify(trades.map(t => ({
  date: t.trade_date,
  time: t.trade_time,
  symbol: t.symbol,
  direction: t.direction,
  session: t.session,
  pnl: t.pnl,
  exit_reason: t.exit_reason,
  emotional_state: t.emotional_state,
  confidence: t.confidence_level,
  followed_plan: t.followed_plan,
})), null, 2)}

Create a report with these sections:
# Weekly Performance Report: ${weekStart} to ${weekEnd}

## Executive Summary
## Performance Statistics
## Best Trades of the Week
## Worst Trades and Lessons
## Psychological Performance
## Plan Adherence Analysis
## Key Patterns Observed
## Goals for Next Week
## Action Items (specific, numbered list)`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function generatePsychologyReport(
  trades: Trade[],
  psychLogs: Array<{
    date: string;
    mood: string;
    mindset_score: number;
    pre_session_notes: string;
    post_session_notes: string;
  }>
): Promise<string> {
  const emotionalBreakdown = trades.reduce<Record<string, { count: number; pnl: number }>>((acc, t) => {
    const state = t.emotional_state || 'Unknown';
    if (!acc[state]) acc[state] = { count: 0, pnl: 0 };
    acc[state].count++;
    acc[state].pnl += t.pnl;
    return acc;
  }, {});

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 3000,
    system: `You are a trading psychologist specialising in performance psychology and behavioral finance.
Provide deep, insightful analysis of a trader's psychological patterns.
Be empathetic but brutally honest about destructive patterns.
Give concrete, practical psychological techniques to improve performance.`,
    messages: [
      {
        role: 'user',
        content: `Perform a deep psychology analysis for this futures trader.

Emotional State vs Performance:
${JSON.stringify(emotionalBreakdown, null, 2)}

Plan Adherence: ${trades.filter(t => t.followed_plan).length}/${trades.length} trades followed the plan

Psychology Logs (recent):
${JSON.stringify(psychLogs.slice(-14), null, 2)}

Trades Not Following Plan:
${JSON.stringify(trades.filter(t => !t.followed_plan).map(t => ({
  date: t.trade_date,
  emotional_state: t.emotional_state,
  pnl: t.pnl,
  notes: t.post_trade_notes,
})), null, 2)}

Provide a comprehensive psychology report:
# Trading Psychology Report

## Emotional State Analysis
## Behavioral Patterns
## Tilt and Revenge Trading Assessment
## FOMO and Overconfidence Patterns
## Discipline and Plan Adherence
## Mindset Score Trends
## Root Cause Analysis
## Recommended Psychological Strategies
## Daily Routine Recommendations
## Affirmations and Mental Framework`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function compareTradeToPlaybook(
  trade: Trade,
  playbookEntries: Array<{
    setup_name: string;
    description: string;
    rules: string;
    ideal_conditions: string;
  }>
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 2048,
    system: `You are a trading coach that specialises in evaluating whether trades adhere to established trading playbooks and rules.
Be specific about which rules were followed and which were violated.
Provide a structured compliance assessment.`,
    messages: [
      {
        role: 'user',
        content: `Evaluate this trade against the trading playbook.

Trade Details:
${JSON.stringify({
  symbol: trade.symbol,
  direction: trade.direction,
  date: trade.trade_date,
  time: trade.trade_time,
  session: trade.session,
  entry_price: trade.entry_price,
  sl_price: trade.sl_price,
  tp_price: trade.tp_price,
  exit_reason: trade.exit_reason,
  pnl: trade.pnl,
  emotional_state: trade.emotional_state,
  confidence_level: trade.confidence_level,
  followed_plan: trade.followed_plan,
  pre_trade_notes: trade.pre_trade_notes,
  post_trade_notes: trade.post_trade_notes,
}, null, 2)}

Playbook Entries:
${JSON.stringify(playbookEntries, null, 2)}

Provide a detailed compliance assessment:
# Playbook Compliance Report

## Best Matching Setup
## Rules Followed
## Rules Violated
## Ideal Conditions Match
## Compliance Score (0-100%)
## Specific Violations and Impact
## How to Better Execute This Setup Next Time`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function answerFlyxaQuestion(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    throw new Error('Question is required');
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 700,
    system: `You are Flyxa's built-in product assistant.

Flyxa is a futures trading journal and review workspace. Key areas include:
- Trade journaling and daily reflections
- Dashboard analytics and performance review
- AI Coach analysis
- Risk Manager and daily risk controls
- Trade Scanner and chart import workflows
- Backtesting / replay
- Playbook and psychology tracking

Rules:
- Answer questions about Flyxa clearly and helpfully.
- Be concise, practical, and product-focused.
- If the user asks how to do something in Flyxa, give direct steps.
- If the user asks about account-specific data, explain you cannot see their private data from the chat widget.
- If the question is unrelated to Flyxa, gently steer back to Flyxa and what the product does.
- Do not invent features that Flyxa does not clearly have.
- Keep responses in plain text, usually 2-6 short sentences.`,
    messages: [
      ...history
        .filter(message => message.content.trim() !== '')
        .slice(-8)
        .map(message => ({
          role: message.role,
          content: message.content,
        })),
      {
        role: 'user',
        content: trimmedQuestion,
      },
    ],
  });

  const textBlocks = response.content.filter(block => block.type === 'text');
  const combined = textBlocks.map(block => block.text.trim()).filter(Boolean).join('\n\n');

  if (!combined) {
    throw new Error('Unexpected response type from Claude');
  }

  return combined;
}
