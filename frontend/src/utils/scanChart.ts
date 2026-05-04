import { aiApi } from '../services/api.js'
import type { ExtractedTradeData } from '../types/index.js'

export type ScanChartResult = ExtractedTradeData & { warnings?: string[] }

export function scanChart(
  file: File,
  entryDate: string,
  entryTime: string,
  focusImages: File[] = [],
  scannerContext?: Record<string, unknown>
) {
  return aiApi.scanChart(file, entryDate, entryTime, focusImages, scannerContext) as Promise<ScanChartResult>
}
