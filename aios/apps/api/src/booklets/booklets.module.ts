import { Module } from '@nestjs/common';
import { BookletsService } from './booklets.service';
import { BookletsController } from './booklets.controller';
import { BookletSecurityService } from './booklet-security.service';

@Module({
  controllers: [BookletsController],
  providers: [BookletsService, BookletSecurityService],
  exports: [BookletsService, BookletSecurityService],
})
export class BookletsModule {}
