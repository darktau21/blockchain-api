## Blockchain API

NestJS‑сервис с REST‑эндпоинтами для EVM и Cosmos (SEI). Реализованы валидация параметров и e2e‑тесты (моковые и «живые»).

## Установка

```bash
$ npm install
```

Создайте файл `.env` (или скопируйте из примера) и заполните переменные:

```bash
cp .env.example .env

# .env
PORT=3000
EVM_RPC_URL=https://sei-evm-rpc.publicnode.com
COSMOS_RPC_URL=https://sei-m.rpc.n0ok.net:443
```

## Запуск

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Тесты

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## API

- EVM
  - `GET /evm/block/:height` → height, hash, parentHash, gasLimit, gasUsed, size
  - `GET /evm/transactions/:hash` → hash, to, from, value, input, maxFeePerGas, maxPriorityFeePerGas, gasPrice
- Cosmos
  - `GET /cosmos/block/:height` → height, time, hash, proposedAddress
  - `GET /cosmos/transactions/:hash` → hash, height, time, gasUsed, gasWanted, fee, sender

Переменные окружения:

```bash
EVM_RPC_URL=https://sei-evm-rpc.publicnode.com
COSMOS_RPC_URL=https://sei-m.rpc.n0ok.net:443
```

## E2E‑тесты и поведение на публичных RPC

Есть два типа e2e‑тестов:

- Моковые: полностью детерминированные, проверяют валидацию и логику приложения.
- Живые: обращаются к публичным RPC, чтобы получить реальные height и tx hash, затем вызывают наши эндпоинты.

Особенности «живых» e2e на публичных узлах:

- Возможны «socket hang up» и другие сетевые ошибки — это нормально для публичных RPC (обрывы keep‑alive, rate limiting, перезапуски прокси). Тесты устойчивы и не считают это багом приложения.
- «Transaction not found» — тоже нормальная ситуация:
  - EVM: транзакция может быть вне канонической цепи (реорг), ещё не распропагирована или удалена на неархивном узле.
  - Cosmos: Tendermint RPC может не индексировать транзакции или отставать; конфигурация индексатора может отличаться. Тесты пробуют несколько стратегий (tx_search, просмотр последних блоков и хеширование base64‑tx) и пропускают проверку транзакции при быстром отсутствии данных.

Моковые e2e должны проходить всегда; «живые» e2e — дополнительный smoke‑чек внешней инфраструктуры/данных.

## Логирование тестов

В e2e‑тестах всегда печатаются полезные логи через `test/utils/logger.ts`:

- Для моков: параметры «RPC‑запросов» и ответы приложения (200/400/404).
- Для live: сырые ответы публичных RPC (`eth_blockNumber`, `eth_getBlockByNumber`, `/block`, `/status`, `/tx_search`, `/tx`) и ответы нашего API.

Это помогает отличать сбои из‑за внешних данных/RPC от ошибок логики приложения.

## License

MIT
