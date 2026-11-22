import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Express } from 'express';
import type { Logger } from 'pino';
import type { Config } from './config/env.js';

/** Cleanup to run after the server stops accepting requests, such as closing the database. */
export type ShutdownHook = () => Promise<void>;

export interface RunningServer {
  server: Server;
  url: string;
  /** Stops gracefully; calling it again returns the same promise. Resolves `false` on timeout. */
  shutdown: (reason: string) => Promise<boolean>;
}

/**
 * Starts listening and returns a graceful shutdown function: stop accepting connections,
 * let in-flight requests finish, then run cleanup hooks. Connections still open after
 * `shutdownTimeoutMs` are closed forcibly.
 */
export async function startServer({
  app,
  config,
  logger,
  onShutdown = [],
}: {
  app: Express;
  config: Pick<Config, 'host' | 'port' | 'shutdownTimeoutMs'>;
  logger: Logger;
  onShutdown?: ShutdownHook[];
}): Promise<RunningServer> {
  const server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(config.port, config.host, (error) => {
      if (error) reject(error);
      else resolve(listening);
    });
  });

  // Keep idle connections open longer than the proxies in front of us, so they never
  // reuse a connection that we are about to close.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 30_000;

  const { port } = server.address() as AddressInfo;
  const host = config.host === '0.0.0.0' || config.host === '::' ? 'localhost' : config.host;

  let stopping: Promise<boolean> | undefined;
  const shutdown = (reason: string) =>
    (stopping ??= (async () => {
      logger.info({ reason }, 'Shutting down');
      let clean = true;
      const force = setTimeout(() => {
        clean = false;
        logger.error({ timeoutMs: config.shutdownTimeoutMs }, 'Closing connections forcibly');
        server.closeAllConnections();
      }, config.shutdownTimeoutMs);
      force.unref();

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeIdleConnections();
      });
      clearTimeout(force);

      for (const hook of onShutdown) {
        try {
          await hook();
        } catch (error) {
          clean = false;
          logger.error({ err: error }, 'Shutdown step failed');
        }
      }
      logger.info({ clean }, 'Shutdown complete');
      return clean;
    })());

  return { server, url: `http://${host}:${port}`, shutdown };
}
