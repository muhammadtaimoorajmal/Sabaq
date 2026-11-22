import type { Logger } from 'pino';
import { pinoHttp, type HttpLogger } from 'pino-http';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id.js';

export const isHealthRequest = (url = '') => url.startsWith('/api/health');

/**
 * One log line per request, carrying the request ID. Logs record only what is needed to
 * debug: never headers, cookies, query strings or bodies, which may hold personal data.
 */
export function httpLogger(logger: Logger): HttpLogger {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = resolveRequestId(req.headers[REQUEST_ID_HEADER.toLowerCase()]);
      res.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        path: req.url.split('?')[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      return res.statusCode >= 400 ? 'warn' : 'info';
    },
    // Wake-up pings and uptime monitors would drown out real traffic.
    autoLogging: { ignore: (req) => isHealthRequest(req.url) },
    quietReqLogger: true,
  });
}
