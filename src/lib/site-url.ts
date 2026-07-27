/**
 * Resolves the canonical base URL for the application from environment variables.
 * Throws a clear build-time / runtime error if NEXT_PUBLIC_APP_URL is missing.
 */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;

  if (!url) {
    throw new Error(
      "[Config Error] NEXT_PUBLIC_APP_URL is not defined in environment variables. " +
        "Please specify NEXT_PUBLIC_APP_URL in your .env / .env.local file or deployment configuration."
    );
  }

  return url.replace(/\/$/, "");
}
