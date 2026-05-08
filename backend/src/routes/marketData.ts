import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const ALLOWED_INTERVALS = new Set(['1m', '5m', '15m', '1h', '1d']);
const ALLOWED_RANGES = new Set(['1d', '5d', '1mo', '3mo', '1y']);

type YahooChartResponse = {
  chart?: {
    error?: { description?: string } | null;
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

function normalizeYahooResponse(payload: YahooChartResponse) {
  if (payload.chart?.error?.description) {
    throw new Error(payload.chart.error.description);
  }

  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp || !quote) {
    throw new Error('No candle data returned for this symbol/timeframe/range.');
  }

  const candles = result.timestamp.reduce<Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>>((acc, timestamp, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index] ?? 0;

    if (
      typeof timestamp !== 'number' ||
      typeof open !== 'number' ||
      typeof high !== 'number' ||
      typeof low !== 'number' ||
      typeof close !== 'number'
    ) {
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

function readXmlTag(block: string, tag: string): string {
  const cdataMatch = block.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i'));
  if (cdataMatch?.[1]) return cdataMatch[1].trim();
  const plainMatch = block.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, 'i'));
  if (plainMatch?.[1]) return plainMatch[1].trim();
  const selfClosing = block.match(new RegExp(`<${tag}\\s*/>`, 'i'));
  if (selfClosing) return '';
  return '';
}

function normalizeXmlDate(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  const mdy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (mdy) {
    const [, mm, dd, yyyy] = mdy;
    return `${yyyy}-${mm}-${dd}`;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return '';
}

function parseForexFactoryXml(xml: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  const matches = xml.matchAll(/<event>([\s\S]*?)<\/event>/gi);
  for (const match of matches) {
    const block = match[1] ?? '';
    const title = readXmlTag(block, 'title');
    const country = readXmlTag(block, 'country');
    const date = normalizeXmlDate(readXmlTag(block, 'date'));
    const time = readXmlTag(block, 'time');
    const impact = readXmlTag(block, 'impact');
    const actual = readXmlTag(block, 'actual');
    const forecast = readXmlTag(block, 'forecast');
    const previous = readXmlTag(block, 'previous');

    if (!date || !country) continue;
    events.push({
      title,
      country,
      date,
      time,
      impact,
      actual: actual || null,
      forecast: forecast || null,
      previous: previous || null,
    });
  }
  return events;
}

router.get('/chart', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
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

    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query.toString()}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance request failed with status ${response.status}.`);
    }

    const payload = await response.json() as YahooChartResponse;
    const candles = normalizeYahooResponse(payload);

    return res.json(candles);
  } catch (error) {
    return next(error);
  }
});

router.get('/ff-calendar', authMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sources = [
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
      'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
      'http://nfs.faireconomy.media/ff_calendar_thisweek.json',
      'http://nfs.faireconomy.media/ff_calendar_nextweek.json',
    ];

    const settled = await Promise.allSettled(
      sources.map((url) =>
        fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
          .then((response) => (response.ok ? response.json() : []))
      )
    );

    const combined = settled.flatMap((result) => (
      result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []
    ));

    if (combined.length > 0) {
      return res.json(combined);
    }

    // Fallback: XML export is often available even when JSON is rate-limited.
    const xmlResponse = await fetch('http://nfs.faireconomy.media/ff_calendar_thisweek.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/xml,text/xml,*/*' },
    });
    if (xmlResponse.ok) {
      const xmlText = await xmlResponse.text();
      const parsed = parseForexFactoryXml(xmlText);
      if (parsed.length > 0) return res.json(parsed);
    }

    return res.json([]);
  } catch (error) {
    return next(error);
  }
});

export default router;
