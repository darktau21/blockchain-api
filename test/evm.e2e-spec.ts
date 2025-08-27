import { HttpService } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { log } from './utils/logger';

describe('EVM endpoints (e2e)', () => {
  let app: INestApplication;
  let httpMock: { post: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    httpMock = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpService)
      .useValue(httpMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /evm/block/:height returns block fields (single RPC call)', async () => {
    const payload = {
      number: '0xA',
      hash: '0xabc',
      parentHash: '0xdef',
      gasLimit: '0x5208',
      gasUsed: '0x1000',
      size: '0x1f4',
    };
    httpMock.post.mockImplementationOnce((_url: string, body: unknown) => {
      log('Mock RPC request', body);
      const response: { data: unknown } = {
        data: { jsonrpc: '2.0', id: 1, result: payload },
      };
      return of(response);
    });

    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/evm/block/10').expect(200);
    log('EVM block response', res.body);
    expect(res.body).toEqual({
      height: '0xA',
      hash: '0xabc',
      parentHash: '0xdef',
      gasLimit: '0x5208',
      gasUsed: '0x1000',
      size: '0x1f4',
    });
    expect(httpMock.post).toHaveBeenCalledTimes(1);
  });

  it('GET /evm/block/:height returns 400 on invalid height', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/evm/block/-1').expect(400);
    log('EVM block 400 response', res.body);
    expect(httpMock.post).not.toHaveBeenCalled();
  });

  it('GET /evm/block/:height returns 404 when not found', async () => {
    httpMock.post.mockImplementationOnce(() => {
      const response: { data: unknown } = {
        data: { jsonrpc: '2.0', id: 1, result: null },
      };
      return of(response);
    });
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/evm/block/15').expect(404);
    log('EVM block 404 response', res.body);
  });

  it('GET /evm/transactions/:hash returns tx fields', async () => {
    const tx = {
      hash: '0x' + '1'.repeat(64),
      to: '0x' + '2'.repeat(40),
      from: '0x' + '3'.repeat(40),
      value: '0x0',
      input: '0x',
      maxFeePerGas: '0x10',
      maxPriorityFeePerGas: '0x1',
      gasPrice: '0x5',
    };
    httpMock.post.mockImplementationOnce((_url: string, body: unknown) => {
      log('Mock RPC request', body);
      const response: { data: unknown } = {
        data: { jsonrpc: '2.0', id: 1, result: tx },
      };
      return of(response);
    });
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server)
      .get(`/evm/transactions/${tx.hash}`)
      .expect(200);
    log('EVM tx response', res.body);
    expect(res.body).toEqual({
      hash: tx.hash,
      to: tx.to,
      from: tx.from,
      value: tx.value,
      input: tx.input,
      maxFeePerGas: tx.maxFeePerGas,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      gasPrice: tx.gasPrice,
    });
  });

  it('GET /evm/transactions/:hash returns 400 on invalid hash', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server)
      .get('/evm/transactions/0x123')
      .expect(400);
    log('EVM tx 400 response', res.body);
    expect(httpMock.post).not.toHaveBeenCalled();
  });

  it('GET /evm/transactions/:hash returns 404 when not found', async () => {
    httpMock.post.mockImplementationOnce(() => {
      const response: { data: unknown } = {
        data: { jsonrpc: '2.0', id: 1, result: null },
      };
      return of(response);
    });
    const server = app.getHttpServer() as unknown as import('http').Server;
    const zeroHash = '0x' + '0'.repeat(64);
    const res = await request(server)
      .get(`/evm/transactions/${zeroHash}`)
      .expect(404);
    log('EVM tx 404 response', res.body);
  });
});
