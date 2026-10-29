import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StudentBulkImportService } from './student-bulk-import.service';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, StudentBulkImportService],
  exports: [StudentsService, StudentBulkImportService],
})
export class StudentsModule {}
