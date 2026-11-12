import "server-only";

/** Rate limit in-memory (best effort per warm serverless instance). */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);

  // Eviction jika ukuran map melebihi ambang batas
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      const active = v.filter((t) => now - t < windowMs);
      if (active.length === 0) {
        hits.delete(k);
      } else {
        hits.set(k, active);
      }
    }
  }
  return true;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Rate limiter per nomor telepon peserta (default: 3 percobaan / 10 menit). */
export function rateLimitPhone(phone: string, max = 3, windowMs = 10 * 60 * 1000): boolean {
  return rateLimit(`absen:tel:${phone}`, max, windowMs);
}

/** Rate limiter per IP address untuk fallback shared Wi-Fi / CGNAT (default: 1200 request / 10 menit untuk 500-800 peserta). */
export function rateLimitIp(ip: string, max = 1200, windowMs = 10 * 60 * 1000): boolean {
  return rateLimit(`absen:ip:${ip}`, max, windowMs);
}

/** Reset in-memory rate limit map (berguna untuk pengujian beban / unit test). */
export function resetRateLimits(): void {
  hits.clear();
}
