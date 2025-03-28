import { IsDateString, IsOptional, IsArray, ValidateNested, IsString } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

class RepositoryDto {
    @ApiProperty({
        description: 'Nome do repositório',
        example: 'meu-repositorio'
    })
    @IsString()
    name: string

    @ApiProperty({
        description: 'URL do repositório',
        example: 'https://github.com/usuario/repositorio'
    })
    @IsString()
    url: string
}

export class CommitReportDto {
    @ApiProperty({
        description: 'Data inicial no formato ISO (YYYY-MM-DD)',
        example: '2025-03-01'
    })
    @IsDateString()
    startDate: string

    @ApiProperty({
        description: 'Data final no formato ISO (YYYY-MM-DD)',
        example: '2025-03-27'
    })
    @IsDateString()
    endDate: string

    @ApiProperty({
        description: 'Lista opcional de repositórios personalizados',
        type: [RepositoryDto],
        required: false
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RepositoryDto)
    repositories?: RepositoryDto[]
}