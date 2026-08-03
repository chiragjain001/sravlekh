import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// Import PrismaClient from the generated client in node_modules
// (not from @prisma/client which is a package wrapper — that would cause circular issues at runtime)
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
