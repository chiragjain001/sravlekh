import { Module } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { TeachersController } from './teachers.controller';
import { TeacherBulkImportService } from './teacher-bulk-import.service';

@Module({
  controllers: [TeachersController],
  providers: [TeachersService, TeacherBulkImportService],
  exports: [TeachersService, TeacherBulkImportService],
})
export class TeachersModule {}
