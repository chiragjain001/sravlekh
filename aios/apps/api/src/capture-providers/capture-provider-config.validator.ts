import { BadRequestException } from '@nestjs/common';
import { CaptureProviderType } from '@prisma/client';

/**
 * 29-CAPTURE-PROVIDER-ARCHITECTURE.md §6's config-field table, enforced for
 * real at creation time rather than left as documentation only. MANUAL_GRID
 * has no required fields, matching the doc's "none required" row exactly.
 */
const REQUIRED_CONFIG_FIELDS: Record<CaptureProviderType, string[]> = {
  OMR: ['answerKeyReference', 'bubbleSheetTemplateId'],
  MANUAL_GRID: [],
  CSV_IMPORT: ['expectedColumnMapping'],
  PHOTO_CAPTURE_OBJECTIVE: ['bubbleSheetTemplateId', 'expectedOptionCount'],
  PHOTO_CAPTURE_SUBJECTIVE: ['expectedPageCount'],
};

export function validateCaptureProviderConfig(type: CaptureProviderType, config: Record<string, unknown>): void {
  const required = REQUIRED_CONFIG_FIELDS[type];
  const missing = required.filter((field) => config[field] === undefined || config[field] === null || config[field] === '');
  if (missing.length > 0) {
    throw new BadRequestException(
      `Missing required config field(s) for ${type}: ${missing.join(', ')} (29-CAPTURE-PROVIDER-ARCHITECTURE.md §6).`,
    );
  }
}
