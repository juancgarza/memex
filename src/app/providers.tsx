"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";

// Convex URL - must be set in environment variables
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL as string;

// Create client only if URL is available (prevents build errors)
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: ReactNode }) {
  if (!convex) {
    // During build or if env var is missing, render children without Convex
    // This allows static pages to build
    return (
      <ClerkProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ThemeProvider>{children}</ThemeProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
