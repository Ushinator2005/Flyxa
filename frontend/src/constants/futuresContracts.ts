export interface FuturesContract {
  symbol: string;
  name: string;
  exchange: string;
  point_value: number;
  tick_size: number;
  tick_value: number;
  currency: string;
}

export const FUTURES_CONTRACTS: FuturesContract[] = [
  { symbol: 'ES',  name: 'S&P 500 Futures',           exchange: 'CME',   point_value: 50,       tick_size: 0.25,      tick_value: 12.50,   currency: 'USD' },
  { symbol: 'MES', name: 'Micro S&P 500 Futures',      exchange: 'CME',   point_value: 5,        tick_size: 0.25,      tick_value: 1.25,    currency: 'USD' },
  { symbol: 'NQ',  name: 'Nasdaq 100 Futures',         exchange: 'CME',   point_value: 20,       tick_size: 0.25,      tick_value: 5.00,    currency: 'USD' },
  { symbol: 'MNQ', name: 'Micro Nasdaq 100 Futures',   exchange: 'CME',   point_value: 2,        tick_size: 0.25,      tick_value: 0.50,    currency: 'USD' },
  { symbol: 'YM',  name: 'Dow Jones Futures',          exchange: 'CBOT',  point_value: 5,        tick_size: 1,         tick_value: 5.00,    currency: 'USD' },
  { symbol: 'MYM', name: 'Micro Dow Jones Futures',    exchange: 'CBOT',  point_value: 0.50,     tick_size: 1,         tick_value: 0.50,    currency: 'USD' },
  { symbol: 'RTY', name: 'Russell 2000 Futures',       exchange: 'CME',   point_value: 50,       tick_size: 0.10,      tick_value: 5.00,    currency: 'USD' },
  { symbol: 'M2K', name: 'Micro Russell 2000 Futures', exchange: 'CME',   point_value: 5,        tick_size: 0.10,      tick_value: 0.50,    currency: 'USD' },
  { symbol: 'CL',  name: 'Crude Oil Futures',          exchange: 'NYMEX', point_value: 1000,     tick_size: 0.01,      tick_value: 10.00,   currency: 'USD' },
  { symbol: 'MCL', name: 'Micro Crude Oil Futures',    exchange: 'NYMEX', point_value: 100,      tick_size: 0.01,      tick_value: 1.00,    currency: 'USD' },
  { symbol: 'GC',  name: 'Gold Futures',               exchange: 'COMEX', point_value: 100,      tick_size: 0.10,      tick_value: 10.00,   currency: 'USD' },
  { symbol: 'MGC', name: 'Micro Gold Futures',         exchange: 'COMEX', point_value: 10,       tick_size: 0.10,      tick_value: 1.00,    currency: 'USD' },
  { symbol: 'SI',  name: 'Silver Futures',             exchange: 'COMEX', point_value: 5000,     tick_size: 0.005,     tick_value: 25.00,   currency: 'USD' },
  { symbol: 'SIL', name: 'Micro Silver Futures',       exchange: 'COMEX', point_value: 1000,     tick_size: 0.005,     tick_value: 5.00,    currency: 'USD' },
  { symbol: 'ZB',  name: '30-Year US Treasury Bond',   exchange: 'CBOT',  point_value: 1000,     tick_size: 0.03125,   tick_value: 31.25,   currency: 'USD' },
  { symbol: 'ZN',  name: '10-Year US Treasury Note',   exchange: 'CBOT',  point_value: 1000,     tick_size: 0.015625,  tick_value: 15.625,  currency: 'USD' },
  { symbol: 'ZF',  name: '5-Year US Treasury Note',    exchange: 'CBOT',  point_value: 1000,     tick_size: 0.0078125, tick_value: 7.8125,  currency: 'USD' },
  { symbol: '6E',  name: 'Euro FX Futures',            exchange: 'CME',   point_value: 125000,   tick_size: 0.00005,   tick_value: 6.25,    currency: 'USD' },
  { symbol: '6B',  name: 'British Pound Futures',      exchange: 'CME',   point_value: 62500,    tick_size: 0.0001,    tick_value: 6.25,    currency: 'USD' },
  { symbol: '6J',  name: 'Japanese Yen Futures',       exchange: 'CME',   point_value: 12500000, tick_size: 0.0000005, tick_value: 6.25,    currency: 'USD' },
  { symbol: 'BTC', name: 'Bitcoin Futures',            exchange: 'CME',   point_value: 5,        tick_size: 5,         tick_value: 25.00,   currency: 'USD' },
  { symbol: 'MBT', name: 'Micro Bitcoin Futures',      exchange: 'CME',   point_value: 0.1,      tick_size: 5,         tick_value: 0.50,    currency: 'USD' },
  { symbol: 'ETH', name: 'Ether Futures',              exchange: 'CME',   point_value: 50,       tick_size: 0.25,      tick_value: 12.50,   currency: 'USD' },
  { symbol: 'MET', name: 'Micro Ether Futures',        exchange: 'CME',   point_value: 0.1,      tick_size: 0.25,      tick_value: 0.025,   currency: 'USD' },
];

// Strip expiry code (e.g. "MNQM26" → "MNQ", "ESH25" → "ES")
export function getBaseSymbol(symbol: string): string {
  return symbol.replace(/[FGHJKMNQUVXZ]\d{2}$/, '');
}

export function lookupContract(symbol: string): FuturesContract | undefined {
  const base = getBaseSymbol(symbol.toUpperCase());
  return FUTURES_CONTRACTS.find(c => c.symbol === base);
}
