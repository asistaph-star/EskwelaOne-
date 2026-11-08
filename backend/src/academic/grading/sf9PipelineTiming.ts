/**
 * DIGISKWELA — SF9 PIPELINE TIMING & INSTRUMENTATION
 *
 * Instruments the authentic Calulut SF9 PDF generation and viewing pipeline:
 * - db_retrieval: Database queries (student, enrollment, grades, attendance, comments)
 * - data_mapping: Validation of demographics, attendance mapping, grade slot mapping
 * - xlsx_population: ExcelJS workbook creation and XML sheet population
 * - soffice_startup: Headless LibreOffice process invocation
 * - soffice_conversion: LibreOffice XLSX-to-PDF conversion time
 * - pdf_delivery: Response serialization and delivery
 *
 * Generates standards-compliant Server-Timing headers and privacy-safe
 * structured execution logs for performance auditing.
 */

export interface Sf9TimingMetrics {
  dbRetrievalMs?: number;
  dataMappingMs?: number;
  xlsxPopulationMs?: number;
  sofficeStartupMs?: number;
  sofficeConversionMs?: number;
  storageReadMs?: number;
  storageWriteMs?: number;
  pdfDeliveryMs?: number;
  totalMs: number;
}

export class Sf9PipelineProfiler {
  private readonly startTimes: Map<string, number> = new Map();
  private readonly durations: Map<string, number> = new Map();
  private readonly overallStartMs: number;

  constructor(public readonly label: string = 'sf9_pipeline') {
    this.overallStartMs = Date.now();
  }

  public start(stage: string): void {
    this.startTimes.set(stage, Date.now());
  }

  public stop(stage: string): number {
    const started = this.startTimes.get(stage);
    const duration = started ? Math.max(0, Date.now() - started) : 0;
    this.durations.set(stage, (this.durations.get(stage) || 0) + duration);
    return duration;
  }

  public async measure<T>(stage: string, fn: () => Promise<T>): Promise<T> {
    this.start(stage);
    try {
      return await fn();
    } finally {
      this.stop(stage);
    }
  }

  public measureSync<T>(stage: string, fn: () => T): T {
    this.start(stage);
    try {
      return fn();
    } finally {
      this.stop(stage);
    }
  }

  public recordDuration(stage: string, ms: number): void {
    this.durations.set(stage, Math.max(0, ms));
  }

  public getDuration(stage: string): number {
    return this.durations.get(stage) ?? 0;
  }

  public getTotalDuration(): number {
    return Date.now() - this.overallStartMs;
  }

  public getMetrics(): Sf9TimingMetrics {
    return {
      dbRetrievalMs: this.durations.get('db_retrieval'),
      dataMappingMs: this.durations.get('data_mapping'),
      xlsxPopulationMs: this.durations.get('xlsx_population'),
      sofficeStartupMs: this.durations.get('soffice_startup'),
      sofficeConversionMs: this.durations.get('soffice_conversion'),
      storageReadMs: this.durations.get('storage_read'),
      storageWriteMs: this.durations.get('storage_write'),
      pdfDeliveryMs: this.durations.get('pdf_delivery'),
      totalMs: this.getTotalDuration(),
    };
  }

  /**
   * Generates a standard W3C Server-Timing header string:
   * e.g. "db;dur=14, map;dur=3, xlsx;dur=22, soffice;dur=1250, total;dur=1295"
   */
  public toServerTimingHeader(): string {
    const parts: string[] = [];
    for (const [key, dur] of this.durations.entries()) {
      parts.push(`${key};dur=${dur}`);
    }
    parts.push(`total;dur=${this.getTotalDuration()}`);
    return parts.join(', ');
  }

  /**
   * Emits a privacy-preserving log line with stage durations in milliseconds.
   * Zero learner PII is logged.
   */
  public logSummary(meta: {
    source: 'STORED_PDF' | 'LIBREOFFICE_RENDER' | 'DRAFT_CACHE_HIT' | 'DRAFT_CACHE_MISS';
    mode?: string;
    targetTerm?: string;
    studentIdPrefix?: string;
  }): void {
    const total = this.getTotalDuration();
    const metrics = Array.from(this.durations.entries())
      .map(([k, v]) => `${k}=${v}ms`)
      .join(' ');
    console.log(
      `[SF9-TIMING] source=${meta.source} mode=${meta.mode || 'UNKNOWN'} term=${meta.targetTerm || 'T1'} total=${total}ms ${metrics}`
    );
  }
}
