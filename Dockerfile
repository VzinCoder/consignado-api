# Versão exata exigida por package.json + .npmrc (engine-strict=true)
FROM node:24.21.0-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Versão exata do pnpm exigida pelo projeto
RUN npm install -g pnpm@12.18.0

# Copia apenas os manifestos primeiro para reaproveitar cache de camadas no pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json tsconfig.json ./
COPY apps/simulator/package.json apps/simulator/package.json
COPY apps/bank-mocks/package.json apps/bank-mocks/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/infra/package.json packages/infra/package.json

# Instala todas as dependências (tsx é usado nas migrations e no bank-mocks)
RUN pnpm install --frozen-lockfile

# Copia o restante do código-fonte
COPY . .

# Compila o simulador Next.js para produção
ENV NODE_ENV=production
RUN pnpm --filter @zelafin/simulator build
