import { Router, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/index';

const router = Router();

interface LivePriceResponse {
  firm: string;
  prices: Record<string, number>;
  source: string;
  fetchedAt: string;
  live: boolean;
  fallback: boolean;
  note?: string;
  unavailableSizes?: string[];
}

interface CacheEntry {
  expiresAt: number;
  payload: LivePriceResponse;
}

const CACHE_TTL_MS = 15 * 60 * 1000;

const FALLBACK_PRICES: Record<string, Record<string, number>> = {
  'Apex Funded': {
    '$25,000': 147,
    '$50,000': 167,
    '$100,000': 207,
    '$150,000': 297,
    '$250,000': 497,
    '$300,000': 597,
  },
  FTMO: {
    '\u20AC10,000': 155,
    '\u20AC25,000': 250,
    '\u20AC50,000': 345,
    '\u20AC100,000': 540,
    '\u20AC200,000': 1080,
  },
  MyFundedFutures: {
    '$50,000': 165,
    '$100,000': 250,
    '$150,000': 340,
    '$200,000': 430,
  },
  Topstep: {
    '$50,000': 99,
    '$100,000': 149,
    '$150,000': 199,
  },
};

const LIVE_CACHE = new Map<string, CacheEntry>();

const TOPSTEP_PRICING_URL = 'https://help.topstep.com/en/articles/9208217-topstep-pricing';
const FTMO_PRICING_URL = 'https://ftmo.com/en/';
const MFF_API_URL = 'https://api.myfundedfutures.com/api/getBusinessProducts/';
const APEX_PRICING_URL = 'https://apextraderfunding.com/pricing';

function toCurrencySizeLabel(amount: number, symbol: '$' | 'EUR'): string {
  const prefix = symbol === 'EUR' ? '\u20AC' : '$';
  return `${prefix}${amount.toLocaleString('en-US')}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return 'Unknown error';
}

function parseNumeric(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function mergeWithFallback(
  firm: string,
  livePrices: Record<string, number>,
  source: string,
  note?: string
): LivePriceResponse {
  const fallbackPrices = FALLBACK_PRICES[firm] ?? {};
  const merged = { ...fallbackPrices, ...livePrices };
  const fallbackOnlyKeys = Object.keys(fallbackPrices).filter(size => !(size in livePrices));
  const hasLiveValues = Object.keys(livePrices).length > 0;
  const usesFallback = !hasLiveValues || fallbackOnlyKeys.length > 0;

  let mergedNote = note;
  if (!mergedNote && usesFallback && !hasLiveValues) {
    mergedNote = 'Live pricing is temporarily unavailable. Using fallback values.';
  }
  if (!mergedNote && hasLiveValues && fallbackOnlyKeys.length > 0) {
    mergedNote = 'Some sizes were unavailable live and were filled from fallback values.';
  }

  return {
    firm,
    prices: merged,
    source,
    fetchedAt: new Date().toISOString(),
    live: hasLiveValues,
    fallback: usesFallback,
    note: mergedNote,
    unavailableSizes: fallbackOnlyKeys.length > 0 ? fallbackOnlyKeys : undefined,
  };
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlyxaBillingBot/1.0',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function extractFtmoTableData(html: string): { data?: Record<string, unknown> } | null {
  const withSourceUrl = html.match(
    /var\s+ftmoPricingTable\s*=\s*(\{[\s\S]*?\});\s*\/\/#\s*sourceURL=pricing-table-data-js-extra/
  );
  const fallbackMatch = html.match(/var\s+ftmoPricingTable\s*=\s*(\{[\s\S]*?\});/);
  const payload = withSourceUrl?.[1] ?? fallbackMatch?.[1];
  if (!payload) return null;

  try {
    return JSON.parse(payload) as { data?: Record<string, unknown> };
  } catch {
    return null;
  }
}

function parseTopstepPrices(html: string): Record<string, number> {
  const prices: Record<string, number> = {};
  const regex = /\$?\s*([0-9]{2,3})K\s+Standard Path(?:\s+Trading Combine)?\s+costs\s+\$([0-9]+)(?:\/month)?/gi;

  for (const match of html.matchAll(regex)) {
    const sizeK = Number(match[1]);
    const price = Number(match[2]);
    if (!Number.isFinite(sizeK) || !Number.isFinite(price)) continue;
    prices[toCurrencySizeLabel(sizeK * 1000, '$')] = price;
  }

  return prices;
}

function parseFtmoPrices(html: string): Record<string, number> {
  const parsed = extractFtmoTableData(html);
  if (!parsed?.data) return {};

  const items = Array.isArray(parsed.data.items)
    ? (parsed.data.items as Array<Record<string, unknown>>)
    : [];
  const eurItem = items.find(item => item.currency === 'EUR') ?? items[0];
  if (!eurItem) return {};

  const challenges = Array.isArray(eurItem.challenges)
    ? (eurItem.challenges as Array<Record<string, unknown>>)
    : [];
  const balances = challenges
    .map(item => parseNumeric(String(item.balance ?? '')))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  const pricesNode = parsed.data.prices as Record<string, unknown> | undefined;
  const stepTwo = Array.isArray(pricesNode?.step_2)
    ? (pricesNode.step_2 as Array<Record<string, unknown>>)
    : [];
  const stepOne = Array.isArray(pricesNode?.step_1)
    ? (pricesNode.step_1 as Array<Record<string, unknown>>)
    : [];
  const selectedPriceRows = stepTwo.length > 0 ? stepTwo : stepOne;

  const prices: Record<string, number> = {};
  for (let index = 0; index < Math.min(balances.length, selectedPriceRows.length); index += 1) {
    const balance = balances[index];
    if (balance === undefined || !Number.isFinite(balance)) continue;
    const row = selectedPriceRows[index];
    const price = parseNumeric(String(row?.price ?? ''));
    if (price === null || !Number.isFinite(price)) continue;
    prices[toCurrencySizeLabel(balance, 'EUR')] = price;
  }

  return prices;
}

function parseMyFundedFuturesPrices(payload: unknown): Record<string, number> {
  if (!payload || typeof payload !== 'object') return {};
  const root = payload as { ok?: Record<string, unknown> };
  const rapid = Array.isArray(root.ok?.Rapid)
    ? (root.ok.Rapid as Array<Record<string, unknown>>)
    : [];
  const allCategories = root.ok
    ? (Object.values(root.ok).flatMap(value => (Array.isArray(value) ? value : [])) as Array<
        Record<string, unknown>
      >)
    : [];
  const sourcePlans = rapid.length > 0 ? rapid : allCategories;

  const prices: Record<string, number> = {};
  sourcePlans.forEach(plan => {
    const accountSize = parseNumeric(String(plan.account_size ?? ''));
    const priceData = plan.price_data as Record<string, unknown> | undefined;
    const price = parseNumeric(String(priceData?.price ?? ''));
    if (accountSize === null || !Number.isFinite(accountSize) || price === null || !Number.isFinite(price)) {
      return;
    }

    const key = toCurrencySizeLabel(accountSize, '$');
    const current = prices[key];
    if (!Number.isFinite(current) || price < current) {
      prices[key] = price;
    }
  });

  return prices;
}

async function fetchTopstepLivePrices(): Promise<LivePriceResponse> {
  const html = await fetchText(TOPSTEP_PRICING_URL);
  const parsed = parseTopstepPrices(html);
  return mergeWithFallback('Topstep', parsed, TOPSTEP_PRICING_URL);
}

async function fetchFtmoLivePrices(): Promise<LivePriceResponse> {
  const html = await fetchText(FTMO_PRICING_URL);
  const parsed = parseFtmoPrices(html);
  return mergeWithFallback('FTMO', parsed, FTMO_PRICING_URL);
}

async function fetchMyFundedFuturesLivePrices(): Promise<LivePriceResponse> {
  const response = await fetch(MFF_API_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlyxaBillingBot/1.0',
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  const parsed = parseMyFundedFuturesPrices(payload);
  return mergeWithFallback('MyFundedFutures', parsed, MFF_API_URL);
}

async function fetchApexLivePrices(): Promise<LivePriceResponse> {
  try {
    await fetchText(APEX_PRICING_URL);
    return mergeWithFallback(
      'Apex Funded',
      {},
      APEX_PRICING_URL,
      'Apex blocks automated server requests (Cloudflare). Using configured fallback values.'
    );
  } catch {
    return mergeWithFallback(
      'Apex Funded',
      {},
      APEX_PRICING_URL,
      'Apex blocks automated server requests (Cloudflare). Using configured fallback values.'
    );
  }
}

async function getLivePricesForFirm(firm: string): Promise<LivePriceResponse> {
  const now = Date.now();
  const cached = LIVE_CACHE.get(firm);
  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }

  let payload: LivePriceResponse;
  try {
    if (firm === 'Topstep') {
      payload = await fetchTopstepLivePrices();
    } else if (firm === 'FTMO') {
      payload = await fetchFtmoLivePrices();
    } else if (firm === 'MyFundedFutures') {
      payload = await fetchMyFundedFuturesLivePrices();
    } else if (firm === 'Apex Funded') {
      payload = await fetchApexLivePrices();
    } else {
      payload = mergeWithFallback(
        firm,
        {},
        '',
        'Live pricing is not configured for this firm yet. Using local values if available.'
      );
    }
  } catch (error) {
    payload = mergeWithFallback(
      firm,
      {},
      '',
      `Live pricing request failed: ${getErrorMessage(error)}. Using fallback values.`
    );
  }

  LIVE_CACHE.set(firm, {
    expiresAt: now + CACHE_TTL_MS,
    payload,
  });

  return payload;
}

router.get(
  '/live-prices',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const firm = String(req.query.firm ?? '').trim();
      if (!firm) {
        return res.status(400).json({ error: 'Firm is required.' });
      }

      const payload = await getLivePricesForFirm(firm);
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
