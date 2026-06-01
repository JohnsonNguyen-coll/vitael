"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Renders children only after mount — avoids SSR/client mismatch (wallet UI, etc.). */
export default function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return fallback;
  return children;
}
