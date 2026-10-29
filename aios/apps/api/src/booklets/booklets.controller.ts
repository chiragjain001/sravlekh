import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { sendBinaryDownload } from '../shared/http-response.helper';
import { BookletsService } from './booklets.service';
import { CreatePrintRunDto, VoidBookletDto, VerifyBookletQrDto } from './dto/booklet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

@Controller('institutes/:instituteId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookletsController {
  constructor(private readonly bookletsService: BookletsService) {}

  @Post('deliveries/:deliveryId/print-runs')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  async createPrintRun(
    @Param('instituteId') instituteId: string,
    @Param('deliveryId') deliveryId: string,
    @Body() dto: CreatePrintRunDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookletsService.createPrintRun(instituteId, deliveryId, dto, actor);
  }

  @Get('deliveries/:deliveryId/print-runs')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER, UserRole.TEACHER)
  async getPrintRuns(
    @Param('instituteId') instituteId: string,
    @Param('deliveryId') deliveryId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookletsService.getPrintRuns(instituteId, deliveryId, actor);
  }

  @Get('deliveries/:deliveryId/print-runs/:printRunId/pdf')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER, UserRole.TEACHER)
  async downloadPrintRunPdf(
    @Param('instituteId') instituteId: string,
    @Param('deliveryId') deliveryId: string,
    @Param('printRunId') printRunId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res() res: any,
  ) {
    const { buffer, filename } = await this.bookletsService.renderPrintRunPdf(
      instituteId,
      deliveryId,
      printRunId,
      actor,
    );

    sendBinaryDownload(res, buffer, filename, 'application/pdf');
    /* res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer); */
  }

  @Post('booklets/verify-qr')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN, UserRole.FOUNDER, UserRole.TEACHER)
  async verifyBookletQr(
    @Param('instituteId') instituteId: string,
    @Body() dto: VerifyBookletQrDto,
  ) {
    return this.bookletsService.verifyBookletQr(instituteId, dto.qrPayload);
  }

  @Post('booklets/:bookletId/void')
  @Roles(UserRole.ADMIN, UserRole.FOUNDER)
  async voidBooklet(
    @Param('instituteId') instituteId: string,
    @Param('bookletId') bookletId: string,
    @Body() dto: VoidBookletDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookletsService.voidBooklet(instituteId, bookletId, dto, actor);
  }
}
