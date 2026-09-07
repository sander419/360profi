import { buildApp } from './app.ts';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

const app = await buildApp({ logger: true });

try {
  await app.listen({ port, host });
  app.log.info(`API 360PROFI слушает http://localhost:${port}/api/v1`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
