import { HttpService } from '@nestjs/axios';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { log } from './utils/logger';

describe('Cosmos endpoints (e2e)', () => {
  let app: INestApplication;
  let httpMock: { get: jest.Mock; post: jest.Mock };

  beforeEach(async () => {
    httpMock = {
      get: jest.fn(),
      post: jest.fn(),
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

  it('GET /cosmos/block/:height returns block fields', async () => {
    const rpcResponse = {
      block_id: { hash: 'ABCD' },
      block: {
        header: {
          height: '100',
          time: '2024-01-01T00:00:00Z',
          proposer_address: 'ABCDEF',
        },
      },
    };
    httpMock.get.mockImplementationOnce((_url: string) => {
      log('Mock Tendermint /block', _url);
      return of({ data: rpcResponse });
    });

    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/cosmos/block/100').expect(200);
    log('Cosmos block response', res.body);
    expect(res.body).toEqual({
      height: '100',
      time: '2024-01-01T00:00:00Z',
      hash: '0xABCD',
      proposedAddress: '0xABCDEF',
    });
  });

  it('GET /cosmos/block/:height returns 400 on invalid height', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/cosmos/block/-5').expect(400);
    log('Cosmos block 400 response', res.body);
    expect(httpMock.get).not.toHaveBeenCalled();
  });

  it('GET /cosmos/block/:height returns 404 when not found', async () => {
    httpMock.get.mockImplementationOnce((_url: string) => {
      log('Mock Tendermint /block (not found)', _url);
      return of({ data: { block: null } });
    });
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/cosmos/block/999').expect(404);
    log('Cosmos block 404 response', res.body);
  });

  it('GET /cosmos/transactions/:hash returns tx fields', async () => {
    const txhash = '0x' + 'a'.repeat(64);
    const rpcResponse = {
      tx_response: {
        txhash: txhash.slice(2),
        height: '123',
        timestamp: '2024-01-01T00:00:00Z',
        gas_used: '1000',
        gas_wanted: '1200',
        tx: {
          auth_info: { fee: { amount: [{ amount: '10', denom: 'usei' }] } },
          body: { messages: [{ from_address: 'sei1sender' }] },
        },
      },
    };
    httpMock.get.mockImplementationOnce((_url: string) => {
      log('Mock Tendermint /tx', _url);
      return of({ data: rpcResponse });
    });
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server)
      .get(`/cosmos/transactions/${txhash}`)
      .expect(200);
    log('Cosmos tx response', res.body);
    expect(res.body).toEqual({
      hash: '0x' + txhash.slice(2).toUpperCase(),
      height: '123',
      time: '2024-01-01T00:00:00Z',
      gasUsed: '1000',
      gasWanted: '1200',
      fee: '10usei',
      sender: 'sei1sender',
    });
  });

  it('GET /cosmos/transactions/:hash returns 400 on invalid hash', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server)
      .get('/cosmos/transactions/xyz')
      .expect(400);
    log('Cosmos tx 400 response', res.body);
    expect(httpMock.get).not.toHaveBeenCalled();
  });

  it('GET /cosmos/transactions/:hash returns 404 when not found', async () => {
    httpMock.get.mockImplementationOnce((_url: string) => {
      log('Mock Tendermint /tx (not found)', _url);
      return of({ data: { tx_response: null } });
    });
    const server = app.getHttpServer() as unknown as import('http').Server;
    const zeroHash = '0x' + '0'.repeat(64);
    const res = await request(server)
      .get(`/cosmos/transactions/${zeroHash}`)
      .expect(404);
    log('Cosmos tx 404 response', res.body);
  });
});
