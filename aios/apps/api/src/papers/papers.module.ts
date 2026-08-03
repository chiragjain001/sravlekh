import { Module } from '@nestjs/common';
import { PapersService } from './papers.service';
import { PapersController } from './papers.controller';

@Module({
  controllers: [PapersController],
  providers: [PapersService],
  exports: [PapersService],
})
export class PapersModule {}
