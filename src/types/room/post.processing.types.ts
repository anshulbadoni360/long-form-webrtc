export interface ProcessingResult {
  status: "completed" | "processing" | "disabled" | "failed";
  message?: string;
  data?: unknown;
}

export interface TranscriptResponse {
  transcriptEntries?: unknown[];
}

export interface SummaryResponse {
  summary?: string;
}

export interface PostProcessingResponse {
  status: "success" | "failed" | "disabled";
  results?: PromiseSettledResult<ProcessingResult>[];
  message?: string;
}
