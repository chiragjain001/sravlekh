export interface MasteryRecalcJobData {
  studentProfileId: string;
  topicIds: string[];
}

export const MASTERY_RECALC_QUEUE = 'mastery-recalc';
