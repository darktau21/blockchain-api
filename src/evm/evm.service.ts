import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown[];
}

interface JsonRpcError {
  code: number;
  message: string;
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: JsonRpcError;
}

interface EvmBlockResult {
  number: string;
  hash: string;
  parentHash: string;
  gasLimit: string;
  gasUsed: string;
  size?: string;
}

interface EvmTransactionResult {
  hash: string;
  to: string | null;
  from: string;
  value: string;
  input: string;
  maxFeePerGas?: string | null;
  maxPriorityFeePerGas?: string | null;
  gasPrice?: string | null;
}

@Injectable()
export class EvmService {
  constructor(private readonly http: HttpService) {}

  private async callRpc<T>(method: string, params: unknown[] = []): Promise<T> {
    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    };
    const response = await firstValueFrom(
      this.http.post<JsonRpcResponse<T>>('/', payload),
    );
    const data = response.data;
    if (data.error) {
      throw new NotFoundException(data.error.message);
    }
    return data.result as T;
  }

  private static toHexQuantity(value: number): string {
    return '0x' + value.toString(16);
  }

  async getBlockByHeight(height: number) {
    const block = await this.callRpc<EvmBlockResult>('eth_getBlockByNumber', [
      EvmService.toHexQuantity(height),
      false,
    ]);
    if (!block) {
      throw new NotFoundException('Block not found');
    }
    return {
      height: block.number,
      hash: block.hash,
      parentHash: block.parentHash,
      gasLimit: block.gasLimit,
      gasUsed: block.gasUsed,
      size: block.size ?? null,
    };
  }

  async getTransactionByHash(hash: string) {
    const tx = await this.callRpc<EvmTransactionResult>(
      'eth_getTransactionByHash',
      [hash],
    );
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    return {
      hash: tx.hash,
      to: tx.to,
      from: tx.from,
      value: tx.value,
      input: tx.input,
      maxFeePerGas: tx.maxFeePerGas ?? null,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? null,
      gasPrice: tx.gasPrice ?? null,
    };
  }
}
