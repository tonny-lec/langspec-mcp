import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createLogger } from './logger.js';

const log = createLogger('Cache');

export interface CacheMeta {
  url: string;
  etag: string | null;
  fetchedAt: string;
}

export class DiskCache {
  constructor(private readonly baseDir: string) {}

  private dirFor(language: string, doc: string): string {
    return join(this.baseDir, language, doc);
  }

  private keyFor(url: string): string {
    return createHash('sha256').update(url).digest('hex').substring(0, 16);
  }

  has(language: string, doc: string, url: string): boolean {
    const dir = this.dirFor(language, doc);
    const key = this.keyFor(url);
    return existsSync(join(dir, `${key}.meta.json`));
  }

  getMeta(language: string, doc: string, url: string): CacheMeta | null {
    const dir = this.dirFor(language, doc);
    const key = this.keyFor(url);
    const metaPath = join(dir, `${key}.meta.json`);
    if (!existsSync(metaPath)) return null;
    try {
      return JSON.parse(readFileSync(metaPath, 'utf-8')) as CacheMeta;
    } catch {
      return null;
    }
  }

  getContent(language: string, doc: string, url: string): string | null {
    const dir = this.dirFor(language, doc);
    const key = this.keyFor(url);
    const contentPath = join(dir, `${key}.html`);
    if (!existsSync(contentPath)) return null;
    try {
      return readFileSync(contentPath, 'utf-8');
    } catch {
      return null;
    }
  }

  put(language: string, doc: string, url: string, content: string, etag: string | null): void {
    const dir = this.dirFor(language, doc);
    mkdirSync(dir, { recursive: true });
    const key = this.keyFor(url);

    writeFileSync(join(dir, `${key}.html`), content, 'utf-8');

    const meta: CacheMeta = {
      url,
      etag,
      fetchedAt: new Date().toISOString(),
    };
    writeFileSync(join(dir, `${key}.meta.json`), JSON.stringify(meta, null, 2), 'utf-8');

    log.debug('Cached', { language, doc, url: url.substring(0, 80) });
  }
}
