# Zelafin — Simulador de Empréstimo Consignado

MVP de um simulador de crédito consignado feito para **consultar e interpretar respostas de diferentes bancos**, lidando com formatos distintos, demora e instabilidade.

O cliente informa salário, valor e prazo, e o sistema consulta **quatro bancos fictícios em paralelo**, mostrando o resultado de cada um e destacando a oferta de **menor valor total**. Do outro lado, a equipe acompanha tudo em um **painel administrativo**: vê quem escolheu uma oferta, fala com o cliente pelo WhatsApp e pode reconsultar bancos que estavam fora do ar.

---

## Como rodar

Você precisa ter **Node.js `24.21.0`**, **pnpm `12.18.0`** e **Docker** instalados.

```bash
cp .env.example .env   # configurações prontas para rodar localmente
pnpm install
pnpm infra:up          # sobe o PostgreSQL em localhost:5432
pnpm db:migrate        # cria as tabelas no banco
pnpm db:seed           # insere clientes e simulações de exemplo
pnpm dev               # sobe o simulador (:3000) e os bancos fictícios (:4000)
```

| Onde             | Acesso                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Site do cliente  | http://localhost:3000                                                  |
| Área da equipe   | http://localhost:3000/admin — `admin@zelafin.com.br` / `zelafin-admin` |
| Bancos fictícios | http://localhost:4000/health                                           |

### Roteiro rápido para testar

O último dígito do CPF força o comportamento dos bancos para facilitar os testes (use o CNPJ de empregador `11.222.333/0001-81`):

| CPF                        | O que acontece                                                          |
| -------------------------- | ----------------------------------------------------------------------- |
| `390.533.451-83`           | Fluxo normal (a Carcará falha em ~20% das vezes para testar reconsulta) |
| `529.982.241-30` (final 0) | Todos os bancos recusam                                                 |
| `529.982.240-59` (final 9) | Todos os bancos retornam erro e ficam indisponíveis                     |
| `529.982.258-88` (final 8) | Os bancos demoram 10 s e estouram o timeout de 5 s                      |

---

## Como o projeto está organizado

O repositório é um monorepo (pnpm + Turborepo) dividido em 4 partes com responsabilidades bem separadas:

```text
apps/
  simulator/     Next.js: telas do cliente, painel da equipe e rotas de API
  bank-mocks/    Fastify: servidor separado que simula os 4 bancos externos
packages/
  core/          Regras de negócio puras (sem depender de banco, HTTP ou framework)
  infra/         Conexão com PostgreSQL (Drizzle), chamadas HTTP aos bancos, logs e container
```

```text
 navegador ──► simulator (Next.js) ──► core (regras e serviços)
                                          │
                                          ▼
                               infra (Postgres + HTTP) ──► bank-mocks (:4000)
```

- O **`core`** não importa nada de banco nem de HTTP; ele só define interfaces e aplica as regras (margem, parcela, CPF/CNPJ, melhor oferta).
- O **`infra`** implementa essas interfaces e monta tudo em um único lugar (`packages/infra/src/container.ts`). Para adicionar um banco novo, basta criar o adaptador dele e registrar uma linha no container.
- O **`bank-mocks`** roda separado e não importa nenhum pacote interno, exatamente como APIs de terceiros na vida real.

### Os quatro bancos fictícios

Cada banco responde em um formato diferente, e cada um tem um adaptador no `infra` que valida o retorno com Zod e traduz para o formato padrão do `core`:

| Banco              | Formato da resposta                                           | Comportamento               |
| ------------------ | ------------------------------------------------------------- | --------------------------- |
| Ipê Bank           | JSON em inglês, valores em reais, taxa decimal                | Rápido e estável            |
| Banco Mandacaru    | Campos em português, taxa em texto (`"1,65%"`)                | Menor taxa, mais restritivo |
| Jangada Crédito    | Estrutura `{ data, meta }`, valores em centavos               | Mais lento (~2,5 s)         |
| Carcará Financeira | Sempre responde HTTP 200; erro vem no JSON (`sucesso: false`) | Instável (~20% de falha)    |

---

## Decisões técnicas

- **Regras separadas da infraestrutura:** o `core` não conhece Next.js, Drizzle nem o formato de cada banco. Isso deixa a regra de negócio limpa e fácil de manter mesmo quando a API de um banco muda.
- **Dinheiro sempre em centavos:** todos os valores são salvos e calculados como números inteiros (ex.: R$ 3.500,00 = `350000`) para evitar erros de arredondamento de número quebrado (`float`) no cálculo das parcelas.
- **Consultas em paralelo e sem travar a tela:** quando o cliente envia a simulação, a API salva os dados, responde `201` na hora e dispara as 4 consultas bancárias em paralelo no servidor (`after()` do Next.js) com timeout de 5 s cada. A tela vai buscando novidades a cada 2 s e exibindo cada banco conforme ele responde.
- **Status calculado na leitura:** não existe uma coluna fixa de "status" na tabela de simulações. O status (`Em análise`, `Respondida`, `Interessado`, `Expirada`) é calculado a partir das respostas dos bancos e da data de validade — assim nada fica fora de sincronia.
- **Não confiar no que vem de fora:** toda resposta dos bancos passa por validação com Zod. Se um banco devolver HTTP 200 com erro no corpo (como a Carcará) ou mudar um campo sem aviso, o sistema trata como falha técnica em vez de mostrar uma oferta errada.
- **Melhor oferta só entre propostas equivalentes:** o destaque de "Menor total" compara apenas ofertas aprovadas com o mesmo valor e prazo pedidos pelo cliente, evitando comparações injustas.
- **Cuidado com dados do cliente:** o salário não vai na URL (fica salvo só na aba via `sessionStorage`), o link público da simulação usa UUID e não expõe CPF, e-mail, telefone ou salário, e o logger esconde esses campos automaticamente.
- **Login simples e seguro no painel:** o acesso do admin usa um cookie `httpOnly` assinado com HMAC (usando Web Crypto nativo, sem biblioteca extra) e protegido tanto no `proxy.ts` quanto nas rotas do servidor.

---

## Limitações conhecidas

- As consultas aos bancos rodam no próprio servidor web (`after()`), sem fila: se o servidor reiniciar no meio de uma consulta, o banco fica como pendente até expirar o tempo limite (~35 s) e virar indisponível para a equipe reconsultar.
- Não há retry automático quando um banco falha; hoje a reconsulta é feita manualmente no painel.
- A listagem e os números do painel olham as 200 simulações mais recentes.
- Existe apenas um usuário administrador configurado por variáveis de ambiente.
- A margem consignável de 35% é calculada sobre o salário informado pelo cliente, sem consulta a bases externas reais.

---

## Propostas

Pensando tanto no **cliente** (que preenche os dados e espera as ofertas) quanto na **operação** (que lida com bancos externos fora do controle da empresa), separei o que já foi implementado neste MVP do que eu priorizaria em seguida.

### Implementadas neste MVP

| Problema                                                                                                                                  | Proposta                                                                                                                                                                     | Por quê                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| O cliente podia preencher todos os dados pessoais e disparar 4 chamadas aos bancos mesmo pedindo um valor que já estoura a margem de 35%. | Pré-filtro de margem logo na tela inicial, usando a menor taxa disponível e já sugerindo o valor máximo possível.                                                            | Evita frustração para o cliente, deixa claro o limite desde o começo e economiza chamadas desnecessárias aos bancos.  |
| Bancos demoram tempos diferentes e podem falhar; esperar todos de forma síncrona travaria a tela ou derrubaria a simulação toda.          | Criar a simulação rápido, consultar os 4 bancos em paralelo com timeout de 5 s e atualizar a tela aos poucos via polling.                                                    | O cliente já vê as primeiras ofertas em poucos segundos e a queda de um banco não atrapalha os outros.                |
| Taxas de crédito mudam com o tempo e o cliente pode voltar dias depois ou tentar escolher mais de uma oferta.                             | Definir validade de 72 h, permitir escolher apenas uma oferta por simulação e oferecer um botão de renovação com 1 clique quando expirar.                                    | Evita prometer condição vencida, evita atendimento duplicado e facilita refazer a simulação sem digitar tudo de novo. |
| Sem um painel interno, a equipe não sabe quem escolheu uma oferta nem consegue recuperar simulações de bancos que caíram.                 | Criar a área `/admin` com resumo do dia, lista com busca e filtros, link pronto para WhatsApp, nova simulação pelo atendimento e botão para reconsultar bancos que falharam. | Permite que o time comercial atenda os interessados rápido e recupere propostas de bancos que voltaram ao ar.         |

### Planejadas (em ordem de prioridade)

Se eu tivesse **mais uma semana** para evoluir o produto, seguiria esta ordem:

| Prioridade | Problema                                                                                                                     | Proposta                                                                             | Por quê                                                                                                                        |
| :--------: | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
|   **1**    | Consultas presas ao servidor web podem ser interrompidas em um deploy ou em momentos de pico.                                | Colocar uma fila com **Redis + BullMQ** e um worker separado (um job por banco).     | Primeira melhoria que eu faria: o site só enfileira e responde rápido, e as consultas continuam rodando mesmo durante deploys. |
|   **2**    | Uma instabilidade rápida de um banco já marca a resposta como falha e exige ação manual da equipe.                           | Adicionar **retry automático** com espera progressiva (_backoff_) no worker.         | Recupera falhas passageiras sozinho e diminui o trabalho manual do time de atendimento.                                        |
|   **3**    | Se um banco ficar fora do ar por vários minutos, o sistema continua tentando chamá-lo e esperando o timeout de 5 s toda vez. | Implementar um **circuit breaker** por banco.                                        | Para de insistir em um banco que já sabemos estar caído, responde mais rápido ao cliente e testa a volta dele aos poucos.      |
|   **4**    | A lista do painel hoje carrega no máximo as 200 simulações mais recentes.                                                    | Fazer paginação e contagens direto no banco (SQL).                                   | Mantém o painel rápido e os números exatos conforme o volume de clientes crescer.                                              |
|   **5**    | A margem é baseada só no salário digitado e o fechamento acontece fora do site (no WhatsApp).                                | Integrar consulta de margem real e acompanhar a contratação por webhooks dos bancos. | Reduz recusas depois que o cliente escolhe a oferta e automatiza o acompanhamento até o contrato fechado.                      |
