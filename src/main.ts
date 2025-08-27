import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  const url = await app.getUrl();
  console.info(`[APP] Listening on ${url} (port ${port})`);
}
void bootstrap();
