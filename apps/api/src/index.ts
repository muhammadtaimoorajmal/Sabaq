/**
 * Entry point: validate configuration, connect to the database, start the server and handle
 * process signals.
 * Everything with logic lives in tested modules; this file only wires them together.
 */
import { createApp } from './app.js';
import { ConfigError, loadConfig, type Config } from './config/env.js';
import { databaseHealthCheck } from './db/connection.js';
import { setUpDatabase } from './db/setup.js';
import { createLogger } from './lib/logger.js';
import { startServer } from './server.js';

function readConfig(): Config {
  try {
    return loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

const config = readConfig();
const logger = createLogger(config);

try {
  const onShutdown = await setUpDatabase(config, logger);
  const app = createApp({ config, logger, healthChecks: [databaseHealthCheck] });
  const running = await startServer({ app, config, logger, onShutdown });
  logger.info({ env: config.env, url: running.url }, `Sabaq API listening on ${running.url}`);

  const stop = (reason: string, exitCode: number) => {
    void running.shutdown(reason).then((clean) => process.exit(clean ? exitCode : 1));
  };
  process.once('SIGTERM', () => stop('SIGTERM', 0));
  process.once('SIGINT', () => stop('SIGINT', 0));
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    stop('unhandledRejection', 1);
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    stop('uncaughtException', 1);
  });
} catch (error) {
  logger.fatal({ err: error }, 'Server failed to start');
  process.exitCode = 1;
}
