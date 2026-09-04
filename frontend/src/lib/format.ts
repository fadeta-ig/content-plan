/**
 * Formatting helpers for Content Plan Studio.
 */

/**
 * Ensures a social handle always starts with exactly one '@' sign,
 * regardless of whether the input already has '@', '@@', or no '@'.
 */
export function formatHandle(handle?: string | null): string {
  if (!handle) return '';
  const clean = handle.trim().replace(/^@+/, '');
  return clean ? `@${clean}` : '';
}

/**
 * Strips any leading '@' characters from a social handle.
 */
export function cleanHandle(handle?: string | null): string {
  if (!handle) return '';
  return handle.trim().replace(/^@+/, '');
}

/**
 * Formats file size in bytes into human-readable string (KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
