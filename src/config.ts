export const APP_VERSION = 'v9.8.9 Pro';

export function getAppVersion(): string {
  return localStorage.getItem('wms_app_version') || 'v9.8.9 Pro';
}

export function incrementAppVersion(): string {
  const current = getAppVersion();
  const match = current.match(/v(\d+)\.(\d+)\.(\d+)(.*)/);
  if (match) {
    const major = match[1];
    const minor = match[2];
    const patch = parseInt(match[3], 10) + 1;
    const suffix = match[4] || ' Pro';
    const next = `v${major}.${minor}.${patch}${suffix}`;
    localStorage.setItem('wms_app_version', next);
    return next;
  }
  return current;
}

