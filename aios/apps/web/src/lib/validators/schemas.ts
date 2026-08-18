// ─── Zod Validation Schemas ───────────────────────────────────────────────────
// All form validation schemas. Import these in components + use with RHF.
// Server re-validates. These are for UX feedback only.

import { z } from 'zod';

// ── Assignment Schema ─────────────────────────────────────────────────────────
export const createAssignmentSchema = z.object({
  title: z
    .string()
    .min(3,  'Title must be at least 3 characters')
    .max(200, 'Title cannot exceed 200 characters'),

  type:       z.enum(['general', 'personalized'], { required_error: 'Please select assignment type' }),
  publishMode:z.enum(['live', 'online', 'offline'], { required_error: 'Please select publish mode' }),

  batchId:   z.string().min(1, 'Please select a batch'),
  subjectId: z.string().min(1, 'Please select a subject'),

  sources:   z.array(z.string()).min(1, 'Select at least one source'),
  chapters:  z.array(z.string()).min(1, 'Select at least one chapter'),
  topics:    z.array(z.string()).min(1, 'Select at least one topic'),
  subtopics: z.array(z.string()).default([]),

  totalQuestions: z
    .number({ invalid_type_error: 'Please enter a number' })
    .min(1,   'Minimum 1 question required')
    .max(200, 'Cannot exceed 200 questions'),

  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']),

  difficultyDistribution: z.object({
    easy:   z.number().min(0).max(100),
    medium: z.number().min(0).max(100),
    hard:   z.number().min(0).max(100),
  }).refine(
    d => d.easy + d.medium + d.hard === 100,
    { message: 'Difficulty distribution must add up to 100%' }
  ),

  estimatedTime:   z.number().min(5, 'Minimum 5 minutes').max(300, 'Maximum 300 minutes'),
  marksPerQuestion:z.number().min(1, 'Minimum 1 mark per question'),

  randomizeQuestions:          z.boolean().default(false),
  showSolutionsAfterSubmission:z.boolean().default(true),

  instructions: z.string().max(1000, 'Instructions cannot exceed 1000 characters').default(''),

  dueDate: z
    .string()
    .min(1, 'Due date is required')
    .refine(d => new Date(d) > new Date(), { message: 'Due date must be in the future' }),

  dueTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
    .default('23:59'),

  personalizationFactors: z.object({
    weakTopics:          z.boolean().default(true),
    previousPerformance: z.boolean().default(true),
    accuracyTrend:       z.boolean().default(true),
    learningProgress:    z.boolean().default(false),
    difficultyAdaptation:z.boolean().default(true),
    practiceHistory:     z.boolean().default(false),
  }).optional(),
});

export type CreateAssignmentFormValues = z.infer<typeof createAssignmentSchema>;

// ── Test/Exam Schema ──────────────────────────────────────────────────────────
export const createTestSchema = z.object({
  name: z
    .string()
    .min(3,  'Test name must be at least 3 characters')
    .max(200, 'Test name cannot exceed 200 characters'),

  type: z.enum(['unit-test', 'chapter-test', 'weekly-test', 'mock-test', 'dpp', 'full-syllabus', 'practice'], {
    required_error: 'Please select test type',
  }),

  mode: z.enum(['online', 'offline', 'hybrid'], {
    required_error: 'Please select test mode',
  }),

  batchIds:  z.array(z.string()).min(1, 'Select at least one batch'),
  subjectId: z.string().min(1, 'Please select a subject'),
  paperId:   z.string().optional(),

  totalMarks:    z.number().min(1, 'Total marks required').max(1000),
  totalQuestions:z.number().min(1, 'Total questions required').max(500),
  duration:      z.number().min(10, 'Minimum 10 minutes').max(360, 'Maximum 6 hours'),

  negativeMarking:  z.string().default('None'),
  instructions:     z.string().max(2000).default(''),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions:   z.boolean().default(false),
  showSolutions:    z.boolean().default(true),
  isPersonalized:   z.boolean().default(false),

  scheduledDate: z.string().optional(),
  startTime:     z.string().optional(),
  endTime:       z.string().optional(),
});

export type CreateTestFormValues = z.infer<typeof createTestSchema>;

// ── Doubt Resolution Schema ────────────────────────────────────────────────────
export const resolveDoubtSchema = z.object({
  answer:  z.string().min(10, 'Please provide a more detailed answer'),
  method:  z.enum(['text', 'video', 'ai-assisted']),
  imageUrls: z.array(z.string()).default([]),
});

export type ResolveDoubtFormValues = z.infer<typeof resolveDoubtSchema>;

// ── Student Enrollment Schema ──────────────────────────────────────────────────
export const enrollStudentSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters').max(100),
  email:    z.string().email('Invalid email address'),
  phone:    z.string().regex(/^\+?[\d\s-]{10,15}$/, 'Invalid phone number'),
  classId:  z.string().min(1, 'Please select a class'),
  batchId:  z.string().min(1, 'Please select a batch'),
  enrolledExams: z.array(z.string()).min(1, 'Select at least one exam'),
  parentName:  z.string().optional(),
  parentPhone: z.string().optional(),
  rollNo:      z.string().optional(),
});

export type EnrollStudentFormValues = z.infer<typeof enrollStudentSchema>;
