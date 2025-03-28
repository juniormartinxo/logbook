import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { BullBoardModule } from '@bull-board/nestjs'
import { ExpressAdapter } from '@bull-board/express'
import { BullBoardController } from './bull-board.controller'
import { BullAdapter } from '@bull-board/api/bullAdapter'

@Module({
    imports: [
        BullBoardModule.forRoot({
            route: '/admin/queues', // Rota para acessar o dashboard
            adapter: ExpressAdapter,
        }),
        BullBoardModule.forFeature({
            name: 'commit-reports',
            adapter: BullAdapter,
        }),
    ],
    controllers: [BullBoardController],
})
export class BullBoardAppModule { }