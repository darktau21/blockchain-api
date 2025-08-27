import { Controller, Get, Param } from '@nestjs/common';
import { CosmosHashPipe } from '../common/pipes/cosmos-hash.pipe';
import { ParseHeightPipe } from '../common/pipes/parse-height.pipe';
import { CosmosService } from './cosmos.service';

@Controller('cosmos')
export class CosmosController {
  constructor(private readonly cosmosService: CosmosService) {}

  @Get('block/:height')
  async getBlock(@Param('height', ParseHeightPipe) height: number) {
    return this.cosmosService.getBlock(height);
  }

  @Get('transactions/:hash')
  async getTx(@Param('hash', CosmosHashPipe) hash: string) {
    return this.cosmosService.getTransaction(hash);
  }
}
