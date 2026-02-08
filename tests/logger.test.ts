import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger, setLogLevel, getLogLevel, parseLogLevel } from '../src/lib/logger.js';

describe('Logger', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];

  beforeEach(() => {
    written = [];
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      written.push(chunk.toString());
      return true;
    });
    setLogLevel('debug');
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    setLogLevel('info');
  });

  it('outputs JSON Lines to stderr with correct fields', () => {
    const log = createLogger('Test');
    log.info('hello world');

    expect(written).toHaveLength(1);
    const entry = JSON.parse(written[0]);
    expect(entry.level).toBe('info');
    expect(entry.component).toBe('Test');
    expect(entry.msg).toBe('hello world');
    expect(entry.ts).toBeDefined();
  });

  it('includes extra data fields in output', () => {
    const log = createLogger('Fetcher');
    log.info('Fetching page', { url: 'https://example.com', bytes: 1234 });

    const entry = JSON.parse(written[0]);
    expect(entry.url).toBe('https://example.com');
    expect(entry.bytes).toBe(1234);
    expect(entry.component).toBe('Fetcher');
  });

  it('filters messages below the current log level', () => {
    setLogLevel('warn');
    const log = createLogger('Test');

    log.debug('should not appear');
    log.info('should not appear');
    log.warn('should appear');
    log.error('should appear');

    expect(written).toHaveLength(2);
    expect(JSON.parse(written[0]).level).toBe('warn');
    expect(JSON.parse(written[1]).level).toBe('error');
  });

  it('parseLogLevel handles valid and invalid values', () => {
    expect(parseLogLevel('debug')).toBe('debug');
    expect(parseLogLevel('INFO')).toBe('info');
    expect(parseLogLevel('WARN')).toBe('warn');
    expect(parseLogLevel('error')).toBe('error');
    expect(parseLogLevel('invalid')).toBe('info');
    expect(parseLogLevel(undefined)).toBe('info');
  });

  it('setLogLevel / getLogLevel round-trip', () => {
    setLogLevel('error');
    expect(getLogLevel()).toBe('error');
    setLogLevel('debug');
    expect(getLogLevel()).toBe('debug');
  });
});
