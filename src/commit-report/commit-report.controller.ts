// commit-report.controller.ts
import { Controller, Get, Query, Body, UseGuards } from '@nestjs/common'
import { CommitReportService } from './commit-report.service'
import { parseISO } from 'date-fns'
import { CommitReportDto } from './dto/commit-repot.dto'
import { ApiBody, ApiTags } from '@nestjs/swagger'
import { ApiOperation } from '@nestjs/swagger'
import { ApiResponse } from '@nestjs/swagger'
import { ThrottlerGuard } from '@nestjs/throttler'

@ApiTags('Relatórios de Commits')
@UseGuards(ThrottlerGuard)
@Controller('commit-report')
export class CommitReportController {
    constructor(private readonly commitReportService: CommitReportService) { }

    @ApiOperation({ summary: 'Gera o relatório de commits' })
    @ApiBody({ type: CommitReportDto })
    @ApiResponse({
        status: 200,
        description: 'Relatório de commits gerado com sucesso',
        type: String,
    })
    @Get()
    async generateReport(@Body() body: CommitReportDto): Promise<string[]> {
        // Converter strings para objetos Date preservando o fuso horário
        const parsedStartDate = parseISO(body.startDate)
        const parsedEndDate = parseISO(body.endDate)

        return this.commitReportService.generateReport(
            parsedStartDate,
            parsedEndDate,
            body.repositories
        )
    }

    @ApiOperation({ summary: 'Gera o relatório de commits' })
    @ApiBody({ type: CommitReportDto })
    @ApiResponse({
        status: 200,
        description: 'Relatório de commits gerado com sucesso',
        type: String,
    })
    @Get('raw')
    async getRawCommits(@Body() body: CommitReportDto): Promise<string> {
        // Converter strings para objetos Date preservando o fuso horário
        const parsedStartDate = parseISO(body.startDate)
        const parsedEndDate = parseISO(body.endDate)

        return this.commitReportService.getRawCommits(
            parsedStartDate,
            parsedEndDate,
            body.repositories
        )
    }

    @ApiOperation({ summary: 'Gera o resumo do relatório de commits' })
    @ApiBody({ type: CommitReportDto })
    @ApiResponse({
        status: 200,
        description: 'Resumo do relatório de commits gerado com sucesso',
        type: String,
    })
    @Get('summary')
    async generateSummary(@Body() body: CommitReportDto): Promise<string> {
        // Converter strings para objetos Date preservando o fuso horário
        const parsedStartDate = parseISO(body.startDate)
        const parsedEndDate = parseISO(body.endDate)

        return this.commitReportService.generateSummary(
            parsedStartDate,
            parsedEndDate,
            body.repositories
        )
    }
}