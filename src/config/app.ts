const DEFAULT_APP_URL = 'https://gladiator-admin-lemon.vercel.app';

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

export const APP_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_APP_URL || DEFAULT_APP_URL,
);

export function buildAppUrl(path = '/') {
  return new URL(path, `${APP_BASE_URL}/`).toString();
}
