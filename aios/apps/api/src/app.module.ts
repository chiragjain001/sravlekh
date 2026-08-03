import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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
  ],
})
export class AppModule {}
