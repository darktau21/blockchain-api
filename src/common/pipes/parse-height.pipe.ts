import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseHeightPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (value === undefined || value === null) {
      throw new BadRequestException('height is required');
    }
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException('height must be a non-negative integer');
    }
    return parsed;
  }
}
