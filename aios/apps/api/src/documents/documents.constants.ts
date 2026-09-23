export interface PdfSplitJobData {
  instituteId: string;
  /** The document whose stored source PDF is to be rendered into page images. */
  documentId: string;
}

export const PDF_SPLIT_QUEUE = 'pdf-split';
