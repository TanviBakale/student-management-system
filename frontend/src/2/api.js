/**
 * Frontend API client for Student Management System.
 * Automatically resolves API base URL between local development (localhost:5000),
 * direct Render backend, and same-origin Vercel reverse proxy (/api rewrite).
 */

const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0'
);

const configuredUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

// On local development, default to 'http://localhost:5000'.
// On deployed environments (e.g. Vercel), default to '' (same-origin relative URL) so
// requests seamlessly route through Vercel's /api rewrite without CORS blockers.
const defaultBaseUrl = isLocalhost ? (configuredUrl || 'http://localhost:5000') : (configuredUrl || '');

export async function request(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers
  };

  const fetchOptions = {
    ...options,
    headers
  };

  let response;
  let lastError;

  // Determine URLs to try in order of priority:
  // 1. Direct configured URL (if any)
  // 2. Fallback relative path (uses Vercel reverse proxy to Render)
  // 3. Fallback direct Render URL
  const urlsToTry = [];
  if (defaultBaseUrl) {
    urlsToTry.push(`${defaultBaseUrl}${normalizedPath}`);
    if (/^https?:\/\//i.test(defaultBaseUrl) && !isLocalhost) {
      // If direct cross-origin call might fail due to CORS, provide relative proxy fallback
      urlsToTry.push(normalizedPath);
    }
  } else {
    urlsToTry.push(normalizedPath);
    urlsToTry.push(`https://student-management-system-orzx.onrender.com${normalizedPath}`);
  }

  for (const url of urlsToTry) {
    try {
      response = await fetch(url, fetchOptions);
      if (response) {
        break;
      }
    } catch (err) {
      lastError = err;
      // Network/CORS failure — proceed to next fallback candidate
    }
  }

  if (!response) {
    throw new Error(
      `Unable to reach the API. Check that the backend is running and CORS is configured. (${lastError?.message || 'Network request failed'})`
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Request failed (${response.status}).`);
  }

  return payload;
}
