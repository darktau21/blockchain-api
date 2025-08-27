import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { CosmosController } from './cosmos.controller';
import { CosmosService } from './cosmos.service';

@Module({
  imports: [
    HttpModule.register({
      baseURL: process.env.COSMOS_RPC_URL ?? 'https://sei-m.rpc.n0ok.net:443',
      timeout: 10000,
      maxRedirects: 0,
    }),
  ],
  controllers: [CosmosController],
  providers: [CosmosService],
})
export class CosmosModule {}
