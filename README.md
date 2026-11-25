# Zelafin — simulador de crédito consignado

O cliente informa salário, valor e prazo, o sistema consulta **quatro bancos fictícios** em paralelo e
mostra a resposta de cada um, destacando a oferta de **menor custo total**. A equipe acompanha tudo numa
**área administrativa**: vê quem escolheu uma oferta, fala com o cliente pelo WhatsApp e reconsulta bancos
que estavam fora do ar.

O foco do projeto é consumir e interpretar respostas de serviços de terceiros que a empresa não controla
(cada banco tem um contrato diferente, alguns são lentos, um deles devolve erro com HTTP 200), pensando em
quem espera a resposta (o cliente) e em quem depende dela (a empresa).

## Como rodar

Requisitos: **Node 24.21.0**, **pnpm 12.18.0** e **Docker**.

```bash
cp .env.example .env   # valores fictícios que funcionam localmente
pnpm install
pnpm infra:up          # Postgres em localhost:5432
pnpm db:migrate
pnpm db:seed           # clientes e simulações de exemplo (inclui ofertas expiradas)
pnpm dev               # simulador em :3000 e bancos fictícios em :4000
```

| O quê            | Onde                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| Site do cliente  | http://localhost:3000                                                  |
| Área da equipe   | http://localhost:3000/admin — `admin@zelafin.com.br` / `zelafin-admin` |
| Bancos fictícios | http://localhost:4000/health                                           |

**Roteiro de demonstração.** O último dígito do CPF força o comportamento de todos os bancos:

| CPF                        | Resultado                                                                   |
| -------------------------- | --------------------------------------------------------------------------- |
| `529.982.247-25`           | Fluxo normal (a Carcará falha em ~20% das vezes, para mostrar a reconsulta) |
| `529.982.241-30` (final 0) | Todos os bancos recusam                                                     |
| `529.982.240-59` (final 9) | Todos os bancos ficam indisponíveis                                         |
| `529.982.258-88` (final 8) | Os bancos demoram 10 s e estouram o timeout de 5 s                          |

### Scripts

| Script                                               | O que faz                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`                                           | Sobe simulador e bancos fictícios com hot reload                                  |
| `pnpm test`                                          | Testes de todos os pacotes (os de integração criam e usam o banco `zelafin_test`) |
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | Qualidade de código                                                               |
| `pnpm build`                                         | Build de produção do simulador                                                    |
| `pnpm db:generate` / `db:migrate` / `db:seed`        | Migrations (Drizzle) e dados de exemplo                                           |
| `pnpm infra:up` / `infra:down`                       | Sobe e derruba o Postgres (os dados ficam no volume)                              |

## Arquitetura

Monorepo com pnpm workspaces e Turborepo, em **arquitetura hexagonal simplificada**:

```
apps/
  simulator/     Next.js: site do cliente, área da equipe e API (route handlers)
  bank-mocks/    Fastify: os 4 bancos fictícios (representa sistemas de terceiros)
packages/
  core/          Regras de negócio puras: modelos, regras, interfaces (portas) e services
  infra/         Adaptadores: Postgres (Drizzle), clientes HTTP dos bancos, logger, env, container
```

```
 navegador ──► simulator (rotas Next) ──► core: SimulationService / BankQueryService
                                              │  depende só de interfaces
                                              ▼
                                   infra: repositórios Drizzle ──► Postgres
                                          providers dos bancos ──► bank-mocks (HTTP)
```

- **O `core` não depende de nada** (o `package.json` dele não tem dependências). Banco de dados, bancos
  e logger ficam atrás de interfaces do core e são implementados no `infra`.
- **Só o `infra/container.ts` monta as implementações.** Banco novo = rota no `bank-mocks` + provider
  no `infra` + uma linha no container.
- **Os apps não têm regra de negócio:** validam o formato da entrada (Zod), chamam um service e
  convertem o resultado (ou o erro, em `lib/http-error.ts`) para HTTP.
- **O `bank-mocks` não importa nada interno**: ele faz o papel dos sistemas externos.

### Os quatro bancos

Cada banco tem um contrato próprio; o provider correspondente traduz a resposta para o formato do core
e valida tudo com Zod (resposta fora do contrato vira falha técnica, nunca uma oferta errada).

| Banco              | Contrato                                                  | Particularidade             |
| ------------------ | --------------------------------------------------------- | --------------------------- |
| Ipê Bank           | JSON em inglês, taxa decimal, valores em reais            | Rápido e estável            |
| Banco Mandacaru    | Campos em português, taxa como texto (`"1,65%"`)          | Menor taxa, mais restritivo |
| Jangada Crédito    | Envelope `{ data, meta }`, centavos, taxa em basis points | Mais lento                  |
| Carcará Financeira | Sempre HTTP 200; o erro vem no corpo (`sucesso: false`)   | Instável                    |

### Fluxo de uma simulação

1. A Landing checa a **margem consignável** (parcela até 35% do salário) antes de pedir dados pessoais.
   O pré-filtro usa a menor taxa entre os bancos: se nem assim couber, sugere o valor máximo.
2. `POST /api/simulations` valida tudo no core, cria a simulação com um resultado `PENDING` por banco e
   responde `201`. As consultas começam **logo depois da resposta**, no próprio servidor (`after()` do
   Next), em paralelo e com timeout de 5 s cada.
3. A tela do cliente faz polling a cada 2 s enquanto houver banco `PENDING`. Cada banco termina como
   `APPROVED`, `REJECTED` ou `FAILED` (timeout, rede, 5xx, erro no corpo ou resposta fora do contrato).
4. Ofertas valem 72 h. O cliente registra interesse em **uma** oferta; a equipe vê o lead na visão geral
   (mesmo depois da validade) e pode reconsultar bancos `FAILED` enquanto a simulação vale.

## Decisões principais

| Decisão                                                            | Por quê                                                                            |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Status da simulação calculado na leitura, sem coluna               | Uma única fonte de verdade (os resultados por banco); nada fica dessincronizado    |
| Atualizações condicionais (`completeIfPending`, `restartIfFailed`) | Duas consultas ao mesmo banco nunca sobrescrevem uma à outra                       |
| `PENDING` antigo vira `FAILED` ao ler a simulação                  | Se o servidor reiniciar no meio de uma consulta, a tela não fica presa para sempre |
| Melhor oferta só entre aprovações com o valor e o prazo pedidos    | Comparar total pago de valores diferentes enganaria o cliente                      |
| Dinheiro em centavos inteiros, taxa como decimal mensal            | Sem erro de arredondamento de ponto flutuante                                      |
| Erros de negócio com `code` estável                                | A API responde sempre `{ error: { code, message, fields? } }`                      |
| Link público sem CPF, e-mail, telefone ou salário                  | O UUID do link é o acesso do cliente; salário não vai na URL                       |
| Logs com redação de dados pessoais                                 | CPF, e-mail, telefone, nome e salário nunca aparecem nos logs                      |
| Sessão do admin com HMAC (Web Crypto) em cookie `httpOnly`         | Um único admin fixo; sem dependência extra                                         |
| "Hoje" no fuso `America/Sao_Paulo`                                 | O servidor costuma rodar em UTC                                                    |

## Testes

Vitest, com uma pasta `tests/` por pacote espelhando a `src/`:

- **core:** regras (CPF/CNPJ, Price, margem, status, melhor oferta) e services com fakes em memória.
- **infra:** providers dos 4 bancos (resposta válida, recusa, fora do contrato, HTTP 503 e timeout),
  env, logger e, em `tests/integration/`, os repositórios contra um Postgres real no banco `_test`.
- **bank-mocks:** contrato de cada banco via `inject` do Fastify.
- **simulator:** formatação, conversão de erros para HTTP, sessão e env.

O CI (GitHub Actions) roda instalação congelada, Prettier, ESLint, typecheck, build e testes com Postgres.

## Limitações conhecidas

- As consultas rodam no próprio servidor web, sem fila: um deploy no meio da consulta deixa o resultado
  `PENDING` até virar `FAILED` por tempo (e a equipe reconsulta).
- Sem retry automático: a reconsulta é manual, pelo admin.
- A lista e os números do admin olham as 200 simulações mais recentes (filtros em memória).
- Um único admin fixo, por variável de ambiente; o cliente acessa só pelo link.
- O cadastro do cliente é atualizado pelo CPF a cada simulação (o contato mais recente vence).
- Bancos fictícios com regras simplificadas; margem calculada só pelo salário informado.

## Próximos passos (propostas)

| Problema                                     | Proposta                                                          | Por quê                                                      |
| -------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| Consultas presas ao servidor web             | Fila com Redis + BullMQ e um worker, um job por banco             | Deploy e picos não derrubam consultas; o web só enfileira    |
| Falha passageira vira `FAILED` direto        | Retry automático com backoff e chave de idempotência              | Menos trabalho manual e nenhuma consulta duplicada           |
| Banco fora do ar continua recebendo chamadas | Circuit breaker por banco                                         | Responde rápido ao cliente e testa a volta aos poucos        |
| Taxa mínima fixa no código                   | Taxas vigentes consultadas e guardadas em cache (fail-open)       | O pré-filtro não bloqueia pedido viável quando os juros caem |
| Pouca visibilidade dos bancos                | Métricas de aprovação, latência e falhas por banco; correlationId | Saber qual parceiro está piorando antes do cliente reclamar  |
| Contratos podem mudar sem aviso              | Testes de contrato com os bancos                                  | Quebra aparece no CI, não em produção                        |
| Lista do admin limitada a 200                | Paginação e contagens no SQL                                      | Números certos com qualquer volume                           |
| Margem estimada pelo salário                 | Margem real via eSocial, Dataprev ou convênio                     | Menos recusas depois da escolha                              |
| Contratação fora do sistema                  | Proposta e contratação com webhooks dos bancos                    | Fecha o ciclo sem depender do WhatsApp                       |
| Dados e acesso                               | Consentimento LGPD, vários usuários no admin, rate limit          | Requisitos para operar de verdade                            |
