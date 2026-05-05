import useFlyxaStore from '../store/flyxaStore.js';

export function loadDeletedTradeIds(): Set<string> {
  return new Set(useFlyxaStore.getState().deletedTradeIds);
}

export function persistDeletedTradeId(id: string): void {
  useFlyxaStore.getState().addDeletedTradeId(id);
}
