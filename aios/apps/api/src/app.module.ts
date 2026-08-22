import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { envSchema } from './config/env.schema';
import { AuthModule } from './auth/auth.module';
import { InstitutesModule } from './institutes/institutes.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { BatchesModule } from './batches/batches.module';
import { QuestionsModule } from './questions/questions.module';
import { PapersModule } from './papers/papers.module';
import { ExamsModule } from './exams/exams.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DoubtsModule } from './doubts/doubts.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { TimetableModule } from './timetable/timetable.module';
import { NoticesModule } from './notices/notices.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { FounderModule } from './founder/founder.module';
import { HealthModule } from './health/health.module';
import { EvaluationPoliciesModule } from './evaluation-policies/evaluation-policies.module';
import { CaptureProvidersModule } from './capture-providers/capture-providers.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { AttemptsModule } from './attempts/attempts.module';
import { RubricsModule } from './rubrics/rubrics.module';
import { DocumentsModule } from './documents/documents.module';
import { IdentityResolutionModule } from './identity-resolution/identity-resolution.module';
import { OcrModule } from './ocr/ocr.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { RequestIdMiddleware } from './shared/middleware/request-id.middleware';
import { RequestLoggingInterceptor } from './shared/interceptors/request-logging.interceptor';

@Module({
  imports: [
    // ── Config ────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),

    // ── Rate limiting — prevent brute-force on auth endpoints ──────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60_000, // 1 minute
        limit: 100,
      },
    ]),

    // ── Core modules ──────────────────────────────────────────────────────
    PrismaModule,
    QueueModule,
    StorageModule,
    CacheModule,
    AuthModule,
    InstitutesModule,
    UsersModule,
    StudentsModule,
    TeachersModule,
    BatchesModule,
    QuestionsModule,
    PapersModule,
    ExamsModule,
    AnalyticsModule,
    DoubtsModule,
    AssignmentsModule,
    TimetableModule,
    NoticesModule,
    ReportsModule,
    AuditModule,
    FounderModule,
    HealthModule,
    EvaluationPoliciesModule,
    CaptureProvidersModule,
    AssessmentsModule,
    AttemptsModule,
    RubricsModule,
    DocumentsModule,
    IdentityResolutionModule,
    OcrModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
