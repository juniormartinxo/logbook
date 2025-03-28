import { ApiProperty } from '@nestjs/swagger'

export class PaginatedMetaDto {
    @ApiProperty({ example: 1 })
    currentPage: number

    @ApiProperty({ example: 50 })
    itemsPerPage: number

    @ApiProperty({ example: 1230 })
    totalItems: number

    @ApiProperty({ example: 25 })
    totalPages: number

    @ApiProperty({ example: true })
    hasNextPage: boolean

    @ApiProperty({ example: false })
    hasPreviousPage: boolean
}

export class PaginatedResponseDto<T> {
    @ApiProperty({ isArray: true })
    data: T[]

    @ApiProperty()
    meta: PaginatedMetaDto
}