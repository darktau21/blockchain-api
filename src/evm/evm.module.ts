import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { EvmController } from './evm.controller';
import { EvmService } from './evm.service';

@Module({
  imports: [
    HttpModule.register({
      baseURL: process.env.EVM_RPC_URL ?? 'https://sei-evm-rpc.publicnode.com',
      timeout: 10000,
      maxRedirects: 0,
      headers: { 'content-type': 'application/json' },
    }),
  ],
  controllers: [EvmController],
  providers: [EvmService],
})
export class EvmModule {}
