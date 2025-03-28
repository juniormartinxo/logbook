import { Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { CommitReportService } from '../commit-report/commit-report.service'

interface ReportJobData {
    startDate: string
    endDate: string
    reportId: string
    repositories?: { name: string; url: string }[]
}

@Processor('commit-reports')
export class CommitReportJobProcessor {
    private readonly logger = new Logger(CommitReportJobProcessor.name)

    constructor(private readonly commitReportService: CommitReportService) { }

    @Process('generate-report')
    async handleGenerateReport(job: Job<ReportJobData>) {
        try {
            this.logger.debug(`Iniciando job de relatório ${job.data.reportId}`)

            const startDate = new Date(job.data.startDate)
            const endDate = new Date(job.data.endDate)

            // Informar o progresso inicial
            await job.progress(10)

            // Chamar o serviço para gerar o relatório, passando os repositórios personalizados
            const reports = await this.commitReportService.generateReport(
                startDate,
                endDate,
                job.data.repositories
            )

            // Atualizar o progresso
            await job.progress(100)

            // Aqui você poderia salvar o resultado em um banco de dados ou sistema de arquivos
            this.logger.debug(`Job de relatório ${job.data.reportId} concluído com sucesso`)

            return {
                reportId: job.data.reportId,
                status: 'completed',
                data: reports
            }
        } catch (error) {
            this.logger.error(`Erro no job de relatório ${job.data.reportId}:`, error)

            return {
                reportId: job.data.reportId,
                status: 'failed',
                error: error.message
            }
        }
    }
}