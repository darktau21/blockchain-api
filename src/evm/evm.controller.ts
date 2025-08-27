import { Controller, Get, Param } from '@nestjs/common';
import { EvmHashPipe } from '../common/pipes/evm-hash.pipe';
import { ParseHeightPipe } from '../common/pipes/parse-height.pipe';
import { EvmService } from './evm.service';

@Controller('evm')
export class EvmController {
  constructor(private readonly evmService: EvmService) {}

  @Get('block/:height')
  async getBlockByHeight(@Param('height', ParseHeightPipe) height: number) {
    return this.evmService.getBlockByHeight(height);
  }

  @Get('transactions/:hash')
  async getTransactionByHash(@Param('hash', EvmHashPipe) hash: string) {
    return this.evmService.getTransactionByHash(hash);
  }
}
