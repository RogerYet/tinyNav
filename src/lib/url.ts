export function normalizeHttpUrl(input: string) {
  const s = input.trim();
  if (!s) return s;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) return s;
  return `https://${s}`;
}

export function isHttpOrHttpsUrl(input: string) {
  try {
    const u = new URL(input);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

