import { z } from "zod";

export const walletAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address")
  .transform(value => value.toLowerCase());

export const positiveLimitSchema = z.coerce.number().int().min(1).max(100).default(20);

export function sanitizedFileExtension(mimeType: string): string | null {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return extensions[mimeType] ?? null;
}
