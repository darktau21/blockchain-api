import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggingInterceptor } from './common/logging.interceptor';
import { CosmosModule } from './cosmos/cosmos.module';
import { EvmModule } from './evm/evm.module';

@Module({
  imports: [EvmModule, CosmosModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
