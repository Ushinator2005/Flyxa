import { useState, useEffect, useCallback } from 'react';
import { tradesApi } from '../services/api.js';
import { Trade } from '../types/index.js';
import { useAuth } from './useAuth.js';
import { useAppSettings } from '../contexts/AppSettingsContext.js';

function getTradesCacheKey(userId: string) {
  return `tw_trades_cache_${userId}`;
}

function getTradeScreenshotsKey(userId: string) {
  return `tw_trade_screenshots_${userId}`;
}

function loadTradeScreenshots(userId: string): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(getTradeScreenshotsKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
    );
  } catch {
    return {};
  }
}

function saveTradeScreenshots(userId: string, screenshots: Record<string, string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getTradeScreenshotsKey(userId), JSON.stringify(screenshots));
}

function mergeTradeScreenshots(trades: Trade[], screenshots: Record<string, string>): Trade[] {
  return trades.map(trade => {
    const cachedScreenshot = screenshots[trade.id];
    if (trade.screenshot_url || !cachedScreenshot) {
      return trade;
    }

    return {
      ...trade,
      screenshot_url: cachedScreenshot,
    };
  });
}

function upsertTradeScreenshot(userId: string, tradeId: string, screenshotUrl: string | undefined) {
  if (!screenshotUrl) return;
  const screenshots = loadTradeScreenshots(userId);
  screenshots[tradeId] = screenshotUrl;
  saveTradeScreenshots(userId, screenshots);
}

function removeTradeScreenshot(userId: string, tradeId: string) {
  const screenshots = loadTradeScreenshots(userId);
  delete screenshots[tradeId];
  saveTradeScreenshots(userId, screenshots);
}

function loadTradesCache(userId: string): Trade[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(getTradesCacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Trade[]) : [];
  } catch {
    return [];
  }
}

function saveTradesCache(userId: string, trades: Trade[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getTradesCacheKey(userId), JSON.stringify(trades));
}

export function useTrades() {
  const { user } = useAuth();
  const { decorateTrades, persistTradeAccount, removeTradeAccount } = useAppSettings();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!user) {
      setTrades([]);
      setError(null);
      return;
    }

    const cached = decorateTrades(mergeTradeScreenshots(loadTradesCache(user.id), loadTradeScreenshots(user.id)));
    if (cached.length > 0) {
      setTrades(cached);
    }
  }, [decorateTrades, user]);

  useEffect(() => {
    setTrades(current => decorateTrades(current));
  }, [decorateTrades]);

  const fetchTrades = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const merged = decorateTrades(mergeTradeScreenshots(await tradesApi.getAll(), loadTradeScreenshots(user.id)));
      setTrades(merged);
      saveTradesCache(user.id, merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trades');
    } finally {
      setLoading(false);
    }
  }, [decorateTrades, user]);

  useEffect(() => {
    if (!userId) return;
    fetchTrades();
  }, [userId]);

  const createTrade = async (data: Partial<Trade>): Promise<Trade> => {
    const newTrade = await tradesApi.create(data);
    const hydratedTrade = {
      ...newTrade,
      accountId: newTrade.accountId || newTrade.account_id || data.accountId,
      screenshot_url: newTrade.screenshot_url || data.screenshot_url,
    };
    const decoratedTrade = decorateTrades([hydratedTrade])[0];
    if (user) {
      upsertTradeScreenshot(user.id, decoratedTrade.id, decoratedTrade.screenshot_url);
      persistTradeAccount(decoratedTrade.id, decoratedTrade.accountId);
    }
    setTrades(prev => {
      const next = [decoratedTrade, ...prev];
      if (user) saveTradesCache(user.id, next);
      return next;
    });
    return decoratedTrade;
  };

  const updateTrade = async (id: string, data: Partial<Trade>): Promise<Trade> => {
    const updated = await tradesApi.update(id, data);
    const hydratedTrade = {
      ...updated,
      accountId: updated.accountId || updated.account_id || data.accountId,
      screenshot_url: updated.screenshot_url || data.screenshot_url,
    };
    const decoratedTrade = decorateTrades([hydratedTrade])[0];
    if (user) {
      upsertTradeScreenshot(user.id, decoratedTrade.id, decoratedTrade.screenshot_url);
      persistTradeAccount(decoratedTrade.id, decoratedTrade.accountId);
    }
    setTrades(prev => {
      const next = prev.map(t => t.id === id ? decoratedTrade : t);
      if (user) saveTradesCache(user.id, next);
      return next;
    });
    return decoratedTrade;
  };

  const deleteTrade = async (id: string): Promise<void> => {
    await tradesApi.delete(id);
    setTrades(prev => {
      const next = prev.filter(t => t.id !== id);
      if (user) {
        saveTradesCache(user.id, next);
        removeTradeScreenshot(user.id, id);
        removeTradeAccount(id);
      }
      return next;
    });
  };

  return { trades, loading, error, fetchTrades, createTrade, updateTrade, deleteTrade };
}
