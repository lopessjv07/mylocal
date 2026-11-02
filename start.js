require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const rootDir = __dirname;
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

console.log('--- Iniciando MyLibrary Cloud Monorepo ---');

// 1. Sincroniza o banco de dados via Prisma caso DATABASE_URL exista
function syncDatabase() {
  return new Promise((resolve) => {
    if (!process.env.DATABASE_URL) {
      console.log('[DB] DATABASE_URL não definida, pulando sincronização Prisma.');
      return resolve();
    }
    console.log('[DB] Sincronizando schema do Prisma com o banco de dados...');
    const prismaProcess = spawn('npx', ['prisma', 'db', 'push', '--schema=prisma/schema.prisma', '--accept-data-loss'], {
      cwd: backendDir,
      env: { ...process.env },
      stdio: 'inherit',
      shell: true,
    });

    prismaProcess.on('close', (code) => {
      if (code === 0) {
        console.log('[DB] Schema do banco de dados sincronizado com sucesso!');
      } else {
        console.warn(`[DB] Aviso: prisma db push encerrou com código ${code}. Continuando inicialização...`);
      }
      resolve();
    });

    prismaProcess.on('error', (err) => {
      console.warn('[DB] Erro ao sincronizar Prisma:', err.message);
      resolve();
    });
  });
}

async function start() {
  await syncDatabase();

  const backendPort = process.env.BACKEND_PORT || '4000';
  const frontendPort = process.env.PORT || '3000';

  console.log(`[START] Iniciando Backend NestJS na porta ${backendPort}...`);
  const backend = spawn('node', ['dist/main.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      BACKEND_PORT: backendPort,
    },
    stdio: 'inherit',
    shell: true,
  });

  // Aguarda 2 segundos para o NestJS subir antes de iniciar o Next.js
  await new Promise((r) => setTimeout(r, 2000));

  console.log(`[START] Iniciando Frontend Next.js na porta ${frontendPort}...`);
  const frontend = spawn('npx', ['next', 'start', '-p', frontendPort], {
    cwd: frontendDir,
    env: {
      ...process.env,
      PORT: frontendPort,
      BACKEND_INTERNAL_URL: `http://127.0.0.1:${backendPort}`,
    },
    stdio: 'inherit',
    shell: true,
  });

  function shutdown() {
    console.log('\n[STOP] Encerrando processos...');
    backend.kill('SIGTERM');
    frontend.kill('SIGTERM');
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  backend.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[BACKEND] Encerrou com código de erro ${code}`);
      frontend.kill('SIGTERM');
      process.exit(code);
    }
  });

  frontend.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[FRONTEND] Encerrou com código de erro ${code}`);
      backend.kill('SIGTERM');
      process.exit(code);
    }
  });
}

start();

