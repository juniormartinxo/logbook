import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { CommitReportService } from './commit-report.service'
import { CommitReportController } from './commit-report.controller'
import { CommitReportAsyncController } from './commit-report-async.controller'
import { BullModule } from '@nestjs/bull'

@Module({
    imports: [
        HttpModule,
        // Importar a queue para uso no controlador
        BullModule.registerQueue({
            name: 'commit-reports',
        }),
    ],
    controllers: [CommitReportController, CommitReportAsyncController],
    providers: [CommitReportService],
    exports: [CommitReportService],
})
export class CommitReportModule { }