import { normalizeHttpUrl } from "./url";

export function normalizeFaviconUrl(siteUrl: string) {
  const normalized = normalizeHttpUrl(siteUrl);
  try {
    const u = new URL(normalized);
    return `${u.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

export function faviconServiceUrl(siteUrl: string, size = 64) {
  const normalized = normalizeHttpUrl(siteUrl);
  try {
    const u = new URL(normalized);
    const host = u.hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
  } catch {
    return "";
  }
}

