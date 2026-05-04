const DELETED_TRADE_IDS_KEY = 'flyxa_trade_journal_deleted_ids_v1';

export function loadDeletedTradeIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DELETED_TRADE_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function persistDeletedTradeId(id: string): void {
  try {
    const existing = loadDeletedTradeIds();
    existing.add(id);
    window.localStorage.setItem(DELETED_TRADE_IDS_KEY, JSON.stringify(Array.from(existing)));
  } catch {
    // Non-critical
  }
}
