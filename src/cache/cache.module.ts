import { Module } from '@nestjs/common'
import { CacheModule } from '@nestjs/cache-manager'
import { ConfigModule, ConfigService } from '@nestjs/config'
import * as redisStore from 'cache-manager-redis-store'

@Module({
    imports: [
        CacheModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                store: redisStore,
                host: configService.get('REDIS_HOST', 'localhost'),
                port: configService.get('REDIS_PORT', 6379),
                password: configService.get('REDIS_PASSWORD'),
                ttl: 60 * 60, // Tempo de vida do cache: 1 hora (em segundos)
                max: 100, // Número máximo de itens no cache
            }),
            isGlobal: true, // Disponibiliza o cache globalmente
        }),
    ],
})
export class CacheAppModule { }