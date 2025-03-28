import { Controller, Get, Post, Body, Param, Query, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue, Job } from 'bull'
import { ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger'
import { v4 as uuidv4 } from 'uuid'
import { CommitReportDto } from './dto/commit-repot.dto'

@ApiTags('Relatórios Assíncronos')
@Controller('async-reports')
export class CommitReportAsyncController {
    constructor(
        @InjectQueue('commit-reports') private reportsQueue: Queue,
    ) { }

    @ApiOperation({ summary: 'Criar um relatório de commits assíncrono' })
    @ApiBody({ type: CommitReportDto })
    @ApiResponse({
        status: 201,
        description: 'Relatório enfileirado para processamento',
        schema: {
            type: 'object',
            properties: {
                reportId: { type: 'string' },
                status: { type: 'string' },
            },
        },
    })
    @Post()
    async createReport(@Body() data: CommitReportDto) {
        const reportId = uuidv4()

        // Enfileirar o job de geração de relatório
        await this.reportsQueue.add('generate-report', {
            reportId,
            startDate: data.startDate,
            endDate: data.endDate,
            repositories: data.repositories, // Incluir os repositórios personalizados
        }, {
            attempts: 3, // Número de tentativas em caso de falha
            backoff: {
                type: 'exponential',
                delay: 5000, // Delay inicial de 5 segundos
            },
            removeOnComplete: false, // Manter o job após completar para consultas
            removeOnFail: false, // Manter o job em caso de falha para debugging
        })

        return {
            reportId,
            status: 'queued',
            message: 'Relatório enfileirado para processamento',
        }
    }

    @ApiOperation({ summary: 'Verificar status de um relatório assíncrono' })
    @ApiResponse({
        status: 200,
        description: 'Status do relatório',
        schema: {
            type: 'object',
            properties: {
                reportId: { type: 'string' },
                status: { type: 'string' },
                progress: { type: 'number' },
                completed: { type: 'boolean' },
                data: { type: 'object', nullable: true },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Relatório não encontrado' })
    @Get(':reportId')
    async getReportStatus(@Param('reportId') reportId: string) {
        // Buscar o job na fila
        const job = await this.reportsQueue.getJob(reportId)

        if (!job) {
            throw new NotFoundException(`Relatório com ID ${reportId} não encontrado`)
        }

        const state = await job.getState()
        const progress = job.progress || 0
        const result = job.returnvalue
        const reason = job.failedReason

        return {
            reportId,
            status: state,
            progress,
            completed: state === 'completed',
            failed: state === 'failed',
            reason: state === 'failed' ? reason : undefined,
            data: state === 'completed' ? result : null,
        }
    }

    @ApiOperation({ summary: 'Listar relatórios assíncronos' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({
        status: 200,
        description: 'Lista de relatórios',
        schema: {
            type: 'object',
            properties: {
                reports: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            status: { type: 'string' },
                            progress: { type: 'number' },
                            createdAt: { type: 'string' },
                            finishedAt: { type: 'string', nullable: true },
                        },
                    },
                },
                total: { type: 'number' },
                page: { type: 'number' },
                limit: { type: 'number' },
            },
        },
    })
    @Get()
    async listReports(
        @Query('page') page = 1,
        @Query('limit') limit = 20,
    ) {
        // Cálculo de offset para paginação
        const start = (page - 1) * limit
        const end = start + limit - 1

        // Buscar jobs em diferentes estados
        const [waiting, active, completed, failed] = await Promise.all([
            this.reportsQueue.getWaiting(start, end),
            this.reportsQueue.getActive(start, end),
            this.reportsQueue.getCompleted(start, end),
            this.reportsQueue.getFailed(start, end),
        ])

        // Combinar e mapear os resultados
        const allJobs = [...waiting, ...active, ...completed, ...failed]
            .sort((a, b) => b.timestamp - a.timestamp) // Ordenar do mais recente para o mais antigo
            .slice(0, limit) // Limitar ao tamanho da página
            .map(job => ({
                id: job.id,
                status: job.finishedOn ? (job.failedReason ? 'failed' : 'completed') : (job.processedOn ? 'active' : 'waiting'),
                progress: job.progress || 0,
                createdAt: new Date(job.timestamp).toISOString(),
                finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
            }))

        const totalJobs = await this.reportsQueue.getJobCounts()

        return {
            reports: allJobs,
            total: totalJobs.waiting + totalJobs.active + totalJobs.completed + totalJobs.failed,
            page,
            limit,
        }
    }
}