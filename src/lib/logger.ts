export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let globalLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

export function getLogLevel(): LogLevel {
  return globalLevel;
}

export function parseLogLevel(value: string | undefined): LogLevel {
  if (!value) return 'info';
  const lower = value.toLowerCase();
  if (lower in LEVEL_ORDER) return lower as LogLevel;
  return 'info';
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

export function createLogger(component: string): Logger {
  function log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[globalLevel]) return;

    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      component,
      msg,
    };

    if (data) {
      for (const [key, value] of Object.entries(data)) {
        entry[key] = value;
      }
    }

    process.stderr.write(JSON.stringify(entry) + '\n');
  }

  return {
    debug: (msg, data?) => log('debug', msg, data),
    info: (msg, data?) => log('info', msg, data),
    warn: (msg, data?) => log('warn', msg, data),
    error: (msg, data?) => log('error', msg, data),
  };
}
