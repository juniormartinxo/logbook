// src/bull-board/bull-board.controller.ts
import { Controller, Get, Res } from '@nestjs/common'
import { Response } from 'express'
import { ExpressAdapter } from '@bull-board/express'

@Controller('admin')
export class BullBoardController {
    constructor() { }

    @Get('queues')
    async getBullBoard(@Res() res: Response) {
        // Redirecionar para a rota correta do Bull Board
        res.redirect('/admin/queues')
    }
}