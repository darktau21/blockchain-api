import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<
      Request & { method?: string; url?: string; ip?: string }
    >();
    const method = req?.method ?? 'UNKNOWN';
    const url = req?.url ?? 'UNKNOWN_URL';
    const ip = (req as any)?.ip ?? 'unknown-ip';

    console.info(`[HTTP] ${method} ${url} ← ${ip}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - now;
          console.info(`[HTTP] ${method} ${url} → 200 ${ms}ms`);
        },
        error: (err: any) => {
          const ms = Date.now() - now;
          const status = err?.status ?? 500;
          console.error(`[HTTP] ${method} ${url} → ${status} ${ms}ms`);
        },
      }),
    );
  }
}
