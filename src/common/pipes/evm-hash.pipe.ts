import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class EvmHashPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value) {
      throw new BadRequestException('hash is required');
    }
    const normalized = value.startsWith('0x') ? value : `0x${value}`;
    const isValid = /^0x[0-9a-fA-F]{64}$/.test(normalized);
    if (!isValid) {
      throw new BadRequestException('hash must be a 0x-prefixed 64-hex string');
    }
    return normalized.toLowerCase();
  }
}
