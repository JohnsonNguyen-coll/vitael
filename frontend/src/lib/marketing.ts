/** Public app origin used by every marketing CTA. Do not append a trailing slash. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export function appHref(path = ""): string {
  return `${APP_URL}${path}`;
}
