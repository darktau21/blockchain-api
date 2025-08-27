import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class CosmosHashPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!value) {
      throw new BadRequestException('hash is required');
    }
    const hex = value.startsWith('0x') ? value.slice(2) : value;
    const isValid = /^[0-9a-fA-F]{64}$/.test(hex);
    if (!isValid) {
      throw new BadRequestException('hash must be a 64-hex string');
    }
    return `0x${hex.toUpperCase()}`;
  }
}
