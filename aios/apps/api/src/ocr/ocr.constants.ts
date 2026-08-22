export interface OcrJobData {
  instituteId: string;
  questionRegionId: string;
  /** Storage key, not a pre-signed URL — the processor signs it fresh at
   * process time so a job sitting queued for a while never ships an
   * already-expired URL to the FastAPI call. */
  imageKey: string;
  blockType: string;
}

export const OCR_QUEUE = 'ocr';
