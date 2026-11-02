# MyLibrary Cloud — Nuvem Própria de Arquivos e Documentos

Sistema completo de armazenamento em nuvem privada com autenticação JWT, hierarquia de pastas e subpastas estilo Google Drive, upload múltiplo (com drag-and-drop), preview integrado de documentos/mídia e gerenciamento de contas por Administrador.

## Stack Tecnológica

- **Frontend:** Next.js 15 (App Router, TypeScript, CSS Moderno Responsivo)
- **Backend:** NestJS 10 (REST API, JWT Auth, Multer Disk Storage)
- **ORM:** Prisma 5
- **Banco de Dados:** MariaDB 11.4 (via Docker Compose na porta `3309`)

## Estrutura do Projeto

- [`docker-compose.yml`](./docker-compose.yml) — Container MariaDB 11.4 configurado com volume persistente
- [`backend/`](./backend) — API NestJS + Prisma + armazenamento local em `backend/storage/uploads/`
- [`frontend/`](./frontend) — Interface Web Next.js com login, navegador de pastas, tabela responsiva e preview

## Como Executar

### 1. Subir o Banco de Dados MariaDB

```bash
docker compose up -d
```

### 2. Iniciar o Backend (NestJS — Porta 4000)

```bash
cd backend
npm install
npx prisma db push
npm run start:dev
```

Ao iniciar pela primeira vez, o backend cria automaticamente a conta de Administrador padrão e pastas iniciais:
- **E-mail:** `admin@mylibrary.local`
- **Senha:** `admin123`

### 3. Iniciar o Frontend (Next.js — Porta 3000)

```bash
cd frontend
npm install
npm run dev
```

Acesse no navegador: **http://localhost:3000**

