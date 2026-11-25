import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface StoredFileMeta {
  storageKey: string;
  size: number;
  checksumSha256: string;
  backend: 's3' | 'local';
}

/**
 * Storage adapter supporting S3-compatible object storage (via presigned/REST requests)
 * with a deterministic local filesystem sandbox fallback when S3_ENDPOINT is absent.
 */
export const storageService = {
  isS3Configured(): boolean {
    return Boolean(config.s3.endpoint && config.s3.accessKey && config.s3.secretKey);
  },

  sanitizeKey(key: string): string {
    return key.replace(/\.\./g, '').replace(/^\/+/, '');
  },

  async uploadFile(key: string, buffer: Buffer, contentType: string): Promise<StoredFileMeta> {
    const safeKey = this.sanitizeKey(key);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    if (this.isS3Configured()) {
      const targetUrl = `${config.s3.endpoint.replace(/\/$/, '')}/${config.s3.bucket}/${safeKey}`;
      const res = await this.fetchWithRetry(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'x-amz-content-sha256': checksum,
        },
        body: new Uint8Array(buffer),
      });
      if (!res.ok) {
        throw new Error(`S3 upload failed with status ${res.status}`);
      }
      return { storageKey: safeKey, size: buffer.length, checksumSha256: checksum, backend: 's3' };
    }

    const fullPath = path.resolve(config.s3.localUploadDir, safeKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return { storageKey: safeKey, size: buffer.length, checksumSha256: checksum, backend: 'local' };
  },

  async downloadFile(key: string): Promise<Buffer> {
    const safeKey = this.sanitizeKey(key);
    if (this.isS3Configured()) {
      const targetUrl = `${config.s3.endpoint.replace(/\/$/, '')}/${config.s3.bucket}/${safeKey}`;
      const res = await this.fetchWithRetry(targetUrl, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`S3 download failed with status ${res.status}`);
      }
      return Buffer.from(await res.arrayBuffer());
    }

    const fullPath = path.resolve(config.s3.localUploadDir, safeKey);
    return fs.readFile(fullPath);
  },

  async deleteFile(key: string): Promise<void> {
    const safeKey = this.sanitizeKey(key);
    if (this.isS3Configured()) {
      const targetUrl = `${config.s3.endpoint.replace(/\/$/, '')}/${config.s3.bucket}/${safeKey}`;
      await this.fetchWithRetry(targetUrl, { method: 'DELETE' });
      return;
    }

    const fullPath = path.resolve(config.s3.localUploadDir, safeKey);
    await fs.unlink(fullPath).catch(() => undefined);
  },

  generatePresignedUrl(key: string, expiresInSeconds = 900): string {
    const safeKey = this.sanitizeKey(key);
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = crypto
      .createHmac('sha256', config.jwt.secret)
      .update(`${safeKey}:${expires}`)
      .digest('hex');

    if (this.isS3Configured()) {
      return `${config.s3.endpoint.replace(/\/$/, '')}/${config.s3.bucket}/${safeKey}?expires=${expires}&sig=${signature}`;
    }
    return `${config.apiUrl}/api/v1/tasks/attachments/download?key=${encodeURIComponent(safeKey)}&expires=${expires}&sig=${signature}`;
  },

  async fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timer);
        if (res.status < 500) return res;
        lastError = new Error(`Storage returned HTTP ${res.status}`);
      } catch (err) {
        lastError = err as Error;
        logger.warn('Storage request failed, retrying', { attempt, error: lastError.message });
      }
      await new Promise((r) => setTimeout(r, 150 * Math.pow(2, attempt - 1)));
    }
    throw lastError || new Error('Storage request failed');
  },
};
