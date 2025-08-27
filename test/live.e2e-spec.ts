import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { createHash } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { log, warn } from './utils/logger';

jest.setTimeout(30000);

const EVM_RPC_URL =
  process.env.EVM_RPC_URL ?? 'https://sei-evm-rpc.publicnode.com';
const COSMOS_RPC_URL =
  process.env.COSMOS_RPC_URL ?? 'https://sei-m.rpc.n0ok.net:443';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function fetchLatestEvmHeight(): Promise<number> {
  const { data } = await axios.post(EVM_RPC_URL, {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_blockNumber',
    params: [],
  });
  log('eth_blockNumber raw', data);
  const result = isRecord(data) ? data.result : undefined;
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result)) {
    throw new Error('Unexpected eth_blockNumber result');
  }
  return parseInt(result, 16);
}

async function fetchEvmTxHashNearHeight(height: number): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const h = height - i;
    const { data } = await axios.post(EVM_RPC_URL, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBlockByNumber',
      params: ['0x' + h.toString(16), true],
    });
    log('eth_getBlockByNumber raw', { height: h, data });
    const result = isRecord(data) ? data.result : undefined;
    if (isRecord(result)) {
      const txs = result.transactions;
      if (Array.isArray(txs) && txs.length > 0) {
        const first = txs[0] as Record<string, unknown>;
        const hash = first.hash;
        if (typeof hash === 'string') return hash;
      }
    }
  }
  throw new Error('No EVM tx found near latest height');
}

async function fetchLatestCosmosHeight(): Promise<number> {
  // Try /block (latest) first, supporting both Tendermint response shapes
  try {
    const { data } = await axios.get(`${COSMOS_RPC_URL}/block`);
    log('/block raw', data);
    const fromResult = isRecord(data) ? data.result : undefined;
    const headerFromResult = isRecord(fromResult)
      ? fromResult.block
      : undefined;
    const headerA =
      isRecord(headerFromResult) && isRecord(headerFromResult.header)
        ? headerFromResult.header
        : undefined;
    const headerB =
      isRecord(data) && isRecord(data.block) && isRecord(data.block.header)
        ? data.block.header
        : undefined;
    const heightStr =
      (headerA?.height as string | undefined) ??
      (headerB?.height as string | undefined);
    if (typeof heightStr === 'string' && /^(\d+)$/.test(heightStr)) {
      return parseInt(heightStr, 10);
    }
  } catch {}
  // Fallback to /status
  const { data } = await axios.get(`${COSMOS_RPC_URL}/status`);
  log('/status raw', data);
  const result = isRecord(data) ? data.result : undefined;
  const sync = isRecord(result) ? result.sync_info : undefined;
  const heightStr = isRecord(sync) ? sync.latest_block_height : undefined;
  if (typeof heightStr !== 'string')
    throw new Error('Unexpected /status response');
  return parseInt(heightStr, 10);
}

async function fetchCosmosTxHashFromRecentBlocks(
  latestHeight: number,
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const h = latestHeight - i;
    const { data } = await axios.get(`${COSMOS_RPC_URL}/block?height=${h}`);
    log('/block?height raw', { height: h, data });
    const wrapper = isRecord(data) ? data : undefined;
    const blockA = isRecord(wrapper?.result)
      ? (wrapper.result.block as Record<string, unknown> | undefined)
      : undefined;
    const blockB = isRecord(wrapper?.block)
      ? (wrapper.block as Record<string, unknown> | undefined)
      : undefined;
    const txs =
      (blockA?.data as Record<string, unknown> | undefined)?.txs ??
      (blockB?.data as Record<string, unknown> | undefined)?.txs;
    if (Array.isArray(txs) && txs.length > 0 && typeof txs[0] === 'string') {
      const b64 = txs[0];
      const raw = Buffer.from(b64, 'base64');
      const hashHex = createHash('sha256')
        .update(raw)
        .digest('hex')
        .toUpperCase();
      const hash = '0x' + hashHex;
      // Verify existence before returning
      try {
        const verify = await axios.get(`${COSMOS_RPC_URL}/tx?hash=${hash}`);
        log('/tx verify raw', verify.data);
        if (isRecord(verify.data) && isRecord(verify.data.tx_response)) {
          return hash;
        }
      } catch {}
    }
  }
  throw new Error('No Cosmos tx found in recent blocks');
}

async function fetchCosmosTxHashRobust(latestHeight: number): Promise<string> {
  // Try tx_search first
  try {
    const url = `${COSMOS_RPC_URL}/tx_search?query=${encodeURIComponent('"tx.height>0"')}&page=1&per_page=1&order_by=${encodeURIComponent('"desc"')}`;
    const { data } = await axios.get(url);
    log('/tx_search raw', data);
    const result = isRecord(data) ? data.result : undefined;
    const txs = isRecord(result) ? result.txs : undefined;
    if (Array.isArray(txs) && txs.length > 0) {
      const first = txs[0] as Record<string, unknown>;
      const hex = first.hash;
      if (typeof hex === 'string' && /^[0-9A-Fa-f]+$/.test(hex)) {
        return '0x' + hex.toUpperCase();
      }
    }
  } catch {}
  // Fallback to recent blocks hashing
  return fetchCosmosTxHashFromRecentBlocks(latestHeight);
}

describe('Live EVM (e2e, hitting public RPC)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('successfully fetches a block and a transaction', async () => {
    const latestHeight = await fetchLatestEvmHeight();

    const server = app.getHttpServer() as unknown as import('http').Server;
    const blockRes = await request(server)
      .get(`/evm/block/${latestHeight}`)
      .expect(200);
    log('App /evm/block response', blockRes.body);
    expect(blockRes.body).toEqual(
      expect.objectContaining({
        height: expect.any(String),
        hash: expect.any(String),
        parentHash: expect.any(String),
        gasLimit: expect.any(String),
        gasUsed: expect.any(String),
      }),
    );

    const txHash = await fetchEvmTxHashNearHeight(latestHeight);
    const txRes = await request(server)
      .get(`/evm/transactions/${txHash}`)
      .expect(200);
    log('App /evm/transactions response', txRes.body);
    expect(txRes.body).toEqual(
      expect.objectContaining({
        hash: expect.any(String),
        from: expect.any(String),
        value: expect.any(String),
        input: expect.any(String),
      }),
    );
  });
});

describe('Live Cosmos (e2e, hitting public RPC)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('successfully fetches a block and a transaction', async () => {
    const latestHeight = await fetchLatestCosmosHeight();
    const server = app.getHttpServer() as unknown as import('http').Server;
    const blockRes = await request(server)
      .get(`/cosmos/block/${latestHeight}`)
      .expect(200);
    log('App /cosmos/block response', blockRes.body);
    expect(blockRes.body).toEqual(
      expect.objectContaining({
        height: expect.any(String),
        time: expect.any(String),
        hash: expect.any(String),
      }),
    );

    let txHash: string;
    try {
      txHash = await fetchCosmosTxHashRobust(latestHeight);
    } catch (e) {
      warn('Skipping live Cosmos tx fetch due to RPC variability', String(e));
      return;
    }
    const txRes = await request(server)
      .get(`/cosmos/transactions/${txHash}`)
      .expect(200);
    log('App /cosmos/transactions response', txRes.body);
    expect(txRes.body).toEqual(
      expect.objectContaining({
        hash: expect.any(String),
        height: expect.any(String),
        time: expect.any(String),
        gasUsed: expect.any(String),
        gasWanted: expect.any(String),
      }),
    );
  }, 90000);
});
