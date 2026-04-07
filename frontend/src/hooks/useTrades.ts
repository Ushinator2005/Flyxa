import { useState, useEffect, useCallback } from 'react';
import { tradesApi } from '../services/api.js';
import { Trade } from '../types/index.js';
import { useAuth } from './useAuth.js';

export function useTrades() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await tradesApi.getAll();
      setTrades(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trades');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const createTrade = async (data: Partial<Trade>): Promise<Trade> => {
    const newTrade = await tradesApi.create(data);
    setTrades(prev => [newTrade, ...prev]);
    return newTrade;
  };

  const updateTrade = async (id: string, data: Partial<Trade>): Promise<Trade> => {
    const updated = await tradesApi.update(id, data);
    setTrades(prev => prev.map(t => t.id === id ? updated : t));
    return updated;
  };

  const deleteTrade = async (id: string): Promise<void> => {
    await tradesApi.delete(id);
    setTrades(prev => prev.filter(t => t.id !== id));
  };

  return { trades, loading, error, fetchTrades, createTrade, updateTrade, deleteTrade };
}
