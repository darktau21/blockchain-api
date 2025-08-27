import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AxiosError } from 'axios';
import { EvmController } from './evm.controller';
import { EvmService } from './evm.service';

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

@Module({
  imports: [
    HttpModule.register({
      baseURL: process.env.EVM_RPC_URL ?? 'https://sei-evm-rpc.publicnode.com',
      timeout: 10000,
      maxRedirects: 0,
      headers: { 'content-type': 'application/json' },
    }),
  ],
  controllers: [EvmController],
  providers: [
    EvmService,
    {
      provide: 'EVM_HTTP_LOGGING',
      useFactory: (http: HttpService) => {
        const axios = http.axiosRef;
        axios.interceptors.request.use(
          (config) => {
            const method = (config.method || 'get').toUpperCase();
            const url = `${config.baseURL ?? ''}${config.url ?? ''}`;
            console.info(`[EVM→RPC] ${method} ${url}`);
            if (config.data) {
              console.info(`[EVM→RPC] body: ${safeStringify(config.data)}`);
            }
            return config;
          },
          (error: unknown) => {
            const message =
              error instanceof Error
                ? error.message
                : (() => {
                    try {
                      return JSON.stringify(error);
                    } catch {
                      return String(error);
                    }
                  })();
            console.error(`[EVM→RPC] request error: ${message}`);
            return Promise.reject(
              error instanceof Error ? error : new Error(message),
            );
          },
        );
        axios.interceptors.response.use(
          (response) => {
            const method = (response.config?.method || 'get').toUpperCase();
            const url = `${response.config?.baseURL ?? ''}${response.config?.url ?? ''}`;
            console.info(`[RPC→EVM] ${method} ${url} → ${response.status}`);
            return response;
          },
          (error: unknown) => {
            const axiosError = error as AxiosError | undefined;
            const res = axiosError?.response;
            const cfg = axiosError?.config as
              | { method?: string; baseURL?: string; url?: string }
              | undefined;
            const method = (cfg?.method || 'get').toUpperCase();
            const url = `${cfg?.baseURL ?? ''}${cfg?.url ?? ''}`;
            const status = res?.status ?? 'ERR';
            console.error(`[RPC→EVM] ${method} ${url} → ${status}`);
            if (res?.data) {
              console.error(`[RPC→EVM] error body: ${safeStringify(res.data)}`);
            }
            const message =
              error instanceof Error
                ? error.message
                : (() => {
                    try {
                      return JSON.stringify(error);
                    } catch {
                      return String(error);
                    }
                  })();
            return Promise.reject(
              error instanceof Error ? error : new Error(message),
            );
          },
        );
        return true;
      },
      inject: [HttpService],
    },
  ],
})
export class EvmModule {}
