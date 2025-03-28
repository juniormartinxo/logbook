import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { CommitReportJobProcessor } from './commit-report-job.processor'
import { CommitReportModule } from 'src/commit-report/commit-report.module'

@Module({
    imports: [
        CommitReportModule,
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                redis: {
                    host: configService.get('REDIS_HOST', 'localhost'),
                    port: configService.get('REDIS_PORT', 6379),
                    password: configService.get('REDIS_PASSWORD'),
                },
            }),
        }),
        BullModule.registerQueue({
            name: 'commit-reports',
        }),
    ],
    providers: [CommitReportJobProcessor],
    exports: [BullModule],
})
export class JobsModule { }