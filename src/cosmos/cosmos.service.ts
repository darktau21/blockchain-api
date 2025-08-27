import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

interface RpcBlockId {
  hash: string;
}

interface RpcBlockHeader {
  height: string;
  time: string;
  proposer_address: string;
}

interface RpcBlockData {
  header: RpcBlockHeader;
}

interface RpcBlockResponse {
  block_id: RpcBlockId;
  block: RpcBlockData;
}

interface RpcTxAuthInfoFeeAmount {
  denom: string;
  amount: string;
}

interface RpcTxAuthInfoFee {
  amount: RpcTxAuthInfoFeeAmount[];
}

interface RpcTxBodyMessage {
  from_address?: string;
  sender?: string;
}

interface RpcTxBody {
  messages: RpcTxBodyMessage[];
}

interface RpcTx {
  body?: RpcTxBody;
  auth_info?: { fee?: RpcTxAuthInfoFee };
}

interface RpcTxResponse {
  txhash: string;
  height: string;
  timestamp: string;
  gas_used: string;
  gas_wanted: string;
  tx?: RpcTx;
}

interface RpcTxByHashResponse {
  tx_response?: RpcTxResponse;
}

@Injectable()
export class CosmosService {
  constructor(private readonly http: HttpService) {}

  private async get<T>(url: string): Promise<T> {
    const res = await firstValueFrom(this.http.get<T>(url));
    return res.data;
  }

  async getBlock(height: number) {
    const data = await this.get<RpcBlockResponse>(`/block?height=${height}`);
    if (!data || !data.block) {
      throw new NotFoundException('Block not found');
    }
    const header = data.block.header;
    const proposer = header.proposer_address as string | undefined;
    const proposedAddress = proposer
      ? proposer.startsWith('0x')
        ? proposer.toUpperCase()
        : `0x${proposer.toUpperCase()}`
      : null;
    return {
      height: header.height,
      time: header.time,
      hash:
        data.block_id && data.block_id.hash
          ? `0x${String(data.block_id.hash).toUpperCase()}`
          : null,
      proposedAddress,
    };
  }

  async getTransaction(hash: string) {
    const hex = hash.startsWith('0x') ? hash.slice(2) : hash;
    const data = await this.get<RpcTxByHashResponse>(`/tx?hash=0x${hex}`);
    if (!data || !data.tx_response) {
      throw new NotFoundException('Transaction not found');
    }
    const txr = data.tx_response;
    const feeAmount = txr.tx?.auth_info?.fee?.amount?.[0];
    const fee = feeAmount ? `${feeAmount.amount}${feeAmount.denom}` : null;
    const firstMsg = txr.tx?.body?.messages?.[0];
    const sender = firstMsg?.from_address || firstMsg?.sender || null;
    return {
      hash: `0x${String(txr.txhash).toUpperCase()}`,
      height: txr.height,
      time: txr.timestamp,
      gasUsed: txr.gas_used,
      gasWanted: txr.gas_wanted,
      fee,
      sender,
    };
  }
}
