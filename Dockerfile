FROM node:22-alpine AS runner
WORKDIR /app

# Instala curl e dependências necessárias para bibliotecas nativas se houver
RUN apk add --no-cache libc6-compat openssl

# Copia package.json da raiz e dos subprojetos
COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY backend/prisma ./backend/prisma

# Instala dependências e gera o Prisma Client
RUN npm --prefix backend install && \
    npx --prefix backend prisma generate && \
    npm --prefix frontend install

# Copia código fonte
COPY backend ./backend
COPY frontend ./frontend
COPY start.js ./

# Constrói backend e frontend
ENV NODE_ENV=production
RUN npm --prefix backend run build && \
    npm --prefix frontend run build

# Porta padrão de escuta para Coolify / proxy
ENV PORT=3000
EXPOSE 3000

CMD ["node", "start.js"]

