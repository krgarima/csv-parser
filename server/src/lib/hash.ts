import { createHash } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function configHash(obj: unknown): string {
  return sha256(JSON.stringify(obj, Object.keys(obj as object).sort()));
}
