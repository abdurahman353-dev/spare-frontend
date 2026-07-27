/**
 * Resolves the canonical base URL for the application.
 * Checks NEXT_PUBLIC_APP_URL, VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL,
 * or defaults to http://localhost:3000.
 */
export function getSiteUrl(): string {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  if (rawUrl) {
    const formatted = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    return formatted.replace(/\/$/, "");
  }

  // Default fallback for builds where no environment domain is specified
  return "http://localhost:3000";
}
