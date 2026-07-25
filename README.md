# Master Transportes — Ride Matching

Microserviço de matching motorista-passageiro.

## O que faz

Recebe pedidos de corrida via RabbitMQ, busca motoristas disponíveis próximos ao passageiro usando grade geográfica H3, cria ofertas com timeout de 20s, gerencia aceitação/rejeição/expiração, e notifica o gateway WebSocket em tempo real.

## Dependências

- [Redis](https://redis.io) — armazenamento de estado + indexação geoespacial
- [RabbitMQ](https://rabbitmq.com) — mensageria entre serviços

## Configuração

Copie `.env.example` para `.env` e ajuste as credenciais:

```bash
cp .env.example .env
```

## Build

```bash
npm install
npm run build
```

## Executar

```bash
npm start       # produção (node dist/index.js)
npm run dev     # desenvolvimento (tsx watch)
```

## Health check

```
GET http://localhost:9090/health
```

Resposta:

```json
{ "status": "ok", "redis": true, "rabbitmq": true }
```

## Fluxo

```
ride.requested → Matching Service → busca motorista (H3 + Redis)
                                    → cria oferta → ride.offer.new
                                    → timeout 20s (DLX)
                                    → aceita/rejeita → ride.driver.accepted
                                    → sem motoristas → ride.no.drivers
```

Eventos enviados ao gateway WebSocket:

| Evento | Destino | Quando |
|---|---|---|
| `ride.new_offer` | motorista | Oferta criada |
| `ride.accepted` | motorista + passageiro | Match confirmado |
| `ride.no_drivers` | passageiro | Nenhum motorista encontrado |
| `ride.cancelled` | passageiro (+ motorista) | Matching cancelado |
