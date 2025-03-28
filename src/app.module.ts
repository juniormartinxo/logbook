import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { CommitReportModule } from './commit-report/commit-report.module'
import { JobsModule } from './jobs/jobs.module'
import { BullBoardAppModule } from './bull-board/bull-board.module'
import { CacheAppModule } from './cache/cache.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheAppModule, // Adicionar o módulo de cache
    // ThrottlerModule para rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // tempo em milissegundos (1 minuto)
      limit: 10,  // número máximo de requisições neste período
    }]),
    JobsModule,
    CommitReportModule,
    BullBoardAppModule,
  ],
})
export class AppModule { }