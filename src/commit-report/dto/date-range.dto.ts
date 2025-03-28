import { IsDateString, IsOptional, IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'
export class DateRangeDto {
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
        description: 'Número da página para paginação (começando de 1)',
        example: 1,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1

    @ApiProperty({
        description: 'Número de itens por página',
        example: 50,
        required: false
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 50
}