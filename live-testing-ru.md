## Проверка эндпоинтов с валидными хешами (EVM и Cosmos)

Этот документ помогает быстро получить «правильные» hash для проверки эндпоинтов и объясняет возможные сетевые проблемы публичных RPC.

### Предварительные требования

- `curl`, `jq`, `awk`, `sha256sum`, `base64`
- Запущенное приложение: `npm run start:dev` (по умолчанию `http://localhost:3000`)

Переменные окружения RPC (опционально):

```bash
export EVM_RPC_URL=https://sei-evm-rpc.publicnode.com
export COSMOS_RPC_URL=https://sei-m.rpc.n0ok.net:443
```

---

## EVM: получить валидный tx hash и проверить эндпоинт

1. Получить последний номер блока (hex):

```bash
LATEST=$(curl -s ${EVM_RPC_URL:-https://sei-evm-rpc.publicnode.com} \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
| jq -r '.result')
echo "$LATEST"
```

2. Взять хеш первой транзакции из этого блока (или ближайших):

```bash
EVM_TX_HASH=$(curl -s ${EVM_RPC_URL:-https://sei-evm-rpc.publicnode.com} \
  -H 'content-type: application/json' \
  --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBlockByNumber\",\"params\":[\"$LATEST\", true]}" \
| jq -r '.result.transactions[0].hash')
echo "$EVM_TX_HASH"
```

Если транзакций нет — попробуйте соседние блоки:

```bash
for off in 0 1 2 3 4 5; do \
  H=$(printf "0x%x" $(( $(printf "%d" "$LATEST") - off )) 2>/dev/null || echo "$LATEST"); \
  echo "try block $H"; \
  curl -s ${EVM_RPC_URL:-https://sei-evm-rpc.publicnode.com} \
    -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBlockByNumber\",\"params\":[\"$H\", true]}" \
  | jq -r '.result.transactions[0].hash // empty' && break; \
done
```

3. Проверить наш эндпоинт:

```bash
curl -s "http://localhost:3000/evm/transactions/${EVM_TX_HASH}"
```

Подсказки:

- 400 → формат не 0x+64 hex.
- 404 → транзакция не найдена/ещё не распропагирована/реорг/узел без архива.

---

## Cosmos: получить валидный tx hash

Есть несколько способов. Рекомендуется начать с tx_search; если RPC отдаёт 504, используйте альтернативный RPC или метод через блок.

### Вариант A — tx_search (быстро, но зависит от узла)

```bash
# иногда публичный n0ok отдаёт 504; можно попробовать polkachu
RPC=${COSMOS_RPC_URL:-https://sei-m.rpc.n0ok.net:443}

COSMOS_TX_HASH=$(curl -sG "$RPC/tx_search" \
  --data-urlencode 'query="tx.height>0"' \
  --data-urlencode 'page=1' \
  --data-urlencode 'per_page=1' \
  --data-urlencode 'order_by="desc"' \
  --retry 5 --retry-delay 1 \
| jq -r '.result.txs[0].hash' | awk '{print "0x" toupper($0)}')

echo "$COSMOS_TX_HASH"
```

Альтернативный RPC, если видите 504 на n0ok:

```bash
RPC=https://sei-rpc.polkachu.com
COSMOS_TX_HASH=$(curl -sG "$RPC/tx_search" \
  --data-urlencode 'query="tx.height>0"' \
  --data-urlencode 'page=1' \
  --data-urlencode 'per_page=1' \
  --data-urlencode 'order_by="desc"' \
  --retry 5 --retry-delay 1 \
| jq -r '.result.txs[0].hash' | awk '{print "0x" toupper($0)}')
echo "$COSMOS_TX_HASH"
```

### Вариант B — без tx_search: хеш из блока (надёжнее)

1. Узнать актуальную высоту:

```bash
RPC=${COSMOS_RPC_URL:-https://sei-m.rpc.n0ok.net:443}
LATEST=$(curl -s "$RPC/block" | jq -r '.block.header.height // .result.block.header.height')
echo "$LATEST"
```

2. Посмотреть несколько последних блоков, взять первую tx и посчитать её sha256:

```bash
RPC=${COSMOS_RPC_URL:-https://sei-m.rpc.n0ok.net:443}
for i in $(seq 0 10); do
  H=$((LATEST - i))
  B64=$(curl -s "$RPC/block?height=$H" \
    | jq -r '.block.data.txs[0] // .result.block.data.txs[0] // empty')
  [ -n "$B64" ] || continue
  COSMOS_TX_HASH=0x$(echo "$B64" | base64 -d | sha256sum | awk '{print toupper($1)}')
  echo "Found tx at height $H -> $COSMOS_TX_HASH"
  break
done
```

3. Проверить наш эндпоинт:

```bash
curl -s "http://localhost:3000/cosmos/transactions/${COSMOS_TX_HASH}"
```

### Вариант C — LCD (если доступен)

```bash
LCD=https://sei-api.polkachu.com
H=$(curl -s "$LCD/cosmos/base/tendermint/v1beta1/blocks/latest" | jq -r '.block.header.height')
COSMOS_TX_HASH=$(curl -s "$LCD/cosmos/tx/v1beta1/txs?events=tx.height=$H&orderBy=ORDER_BY_DESC&limit=1" \
  | jq -r '.txs[0].txhash' | awk '{print "0x" $0}')
echo "$COSMOS_TX_HASH"
```

---

## Проверка эндпоинтов приложения

```bash
# EVM
curl -s "http://localhost:3000/evm/block/17000000"
curl -s "http://localhost:3000/evm/transactions/${EVM_TX_HASH}"

# Cosmos
curl -s "http://localhost:3000/cosmos/block/1000"
curl -s "http://localhost:3000/cosmos/transactions/${COSMOS_TX_HASH}"
```

---

## Частые вопросы

- Почему 400?
  - Некорректный формат хеша: EVM требует `0x` + 64 hex; Cosmos принимает и без `0x`, внутри нормализует.

- Почему 404?
  - Транзакция не найдена: реорги, задержка индексации, неархивный узел, слишком свежая tx, другой формат/регистр.

- Что делать с 504 и "socket hang up"?
  - Это особенности публичных RPC. Используйте `--retry`, альтернативные RPC, либо способ через блок (sha256(base64)).

- Как понять, проблема в моём коде или в RPC?
  - Сначала проверьте мок‑тесты (они детерминированные). Live‑проверки зависят от узлов и сети.
