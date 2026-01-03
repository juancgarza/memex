# Clerk Authentication Implementation Plan

## Overview

Add Clerk authentication to Memex to protect the app and prepare for future subscription features. This phase focuses only on auth - multi-tenant data isolation will be deferred.

## Current State Analysis

- **No authentication** - all data is globally accessible
- Convex backend with ConvexProvider in `providers.tsx`
- 7 API routes unprotected
- No middleware exists

### Key Files:
- `src/app/providers.tsx` - ConvexProvider setup
- `src/app/layout.tsx` - Root layout with Providers wrapper
- `src/app/page.tsx` - Main app component
- `src/app/api/*/route.ts` - 7 API routes

## Desired End State

- Users must sign in to access the app
- Sign-in/sign-up pages at `/sign-in` and `/sign-up`
- UserButton in header showing account menu
- All API routes protected (return 401 if not authenticated)
- Public routes: sign-in, sign-up only

## What We're NOT Doing

- Multi-tenant data isolation (userId on tables)
- Convex auth integration (using Clerk directly)
- Subscription/billing checks
- User profile pages

## Implementation Approach

Use Clerk's Next.js SDK with middleware-based protection. Keep it simple - wrap app in ClerkProvider, add middleware, protect API routes.

---

## Phase 1: Install & Configure Clerk

### Overview
Install Clerk package and set up environment variables.

### Changes Required:

#### 1. Install Package
```bash
pnpm add @clerk/nextjs
```

#### 2. Environment Variables
**File**: `.env.local`
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### Success Criteria:

#### Automated Verification:
- [x] Package installed: `pnpm list @clerk/nextjs`
- [x] Build passes: `pnpm build`

#### Manual Verification:
- [x] Environment variables set in `.env.local`

---

## Phase 2: Add ClerkProvider

### Overview
Wrap the app in ClerkProvider for auth context.

### Changes Required:

#### 1. Update Providers
**File**: `src/app/providers.tsx`
**Changes**: Wrap with ClerkProvider

```typescript
"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL as string;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <ClerkProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider>
      <ConvexProvider client={convex}>
        <ThemeProvider>{children}</ThemeProvider>
      </ConvexProvider>
    </ClerkProvider>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build` (requires Clerk keys)
- [x] No TypeScript errors

#### Manual Verification:
- [ ] App loads without errors

---

## Phase 3: Create Middleware

### Overview
Add Next.js middleware to protect routes and redirect unauthenticated users.

### Changes Required:

#### 1. Create Middleware
**File**: `src/middleware.ts` (NEW)

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build` (requires Clerk keys)

#### Manual Verification:
- [ ] Unauthenticated users redirected to sign-in
- [ ] API routes return 401 when not authenticated

---

## Phase 4: Create Auth Pages

### Overview
Add sign-in and sign-up pages using Clerk's pre-built components.

### Changes Required:

#### 1. Sign-In Page
**File**: `src/app/sign-in/[[...sign-in]]/page.tsx` (NEW)

```typescript
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn />
    </div>
  );
}
```

#### 2. Sign-Up Page
**File**: `src/app/sign-up/[[...sign-up]]/page.tsx` (NEW)

```typescript
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignUp />
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build` (requires Clerk keys)

#### Manual Verification:
- [ ] `/sign-in` shows Clerk sign-in UI
- [ ] `/sign-up` shows Clerk sign-up UI
- [ ] Sign-in redirects to main app
- [ ] Sign-up creates account and redirects

---

## Phase 5: Add UserButton to Header

### Overview
Add user account button to the app header for sign-out and account management.

### Changes Required:

#### 1. Update Page Header
**File**: `src/app/page.tsx`
**Changes**: Import UserButton, add to header

```typescript
import { UserButton } from "@clerk/nextjs";

// In the header section, add:
<UserButton afterSignOutUrl="/sign-in" />
```

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build` (requires Clerk keys)

#### Manual Verification:
- [ ] UserButton appears in header
- [ ] Clicking shows account menu
- [ ] Sign out works and redirects to sign-in

---

## Phase 6: Protect API Routes (Optional Enhancement)

### Overview
Add explicit auth checks to API routes for defense in depth.

### Changes Required:

#### 1. Update API Routes
**File**: `src/app/api/chat/route.ts` (and others)

```typescript
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... rest of handler
}
```

Apply to all 7 API routes:
- `src/app/api/chat/route.ts`
- `src/app/api/transcribe/route.ts`
- `src/app/api/embed/route.ts`
- `src/app/api/extract-concepts/route.ts`
- `src/app/api/import/url/route.ts`
- `src/app/api/import/youtube/route.ts`
- `src/app/api/import/readwise/route.ts`

### Success Criteria:

#### Automated Verification:
- [x] Build passes: `pnpm build` (requires Clerk keys)

#### Manual Verification:
- [ ] API routes return 401 when called without auth
- [ ] API routes work normally when authenticated

---

## Testing Strategy

### Manual Testing Steps:
1. Open app in incognito - should redirect to `/sign-in`
2. Sign up with new account - should create and redirect to app
3. Sign out - should redirect to sign-in
4. Sign in with existing account - should work
5. Test API route without auth (curl) - should get 401

---

## Environment Setup Required

Before implementation, user must:
1. Create Clerk account at https://clerk.com
2. Create new application in Clerk dashboard
3. Copy API keys to `.env.local`:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

---

## References

- Clerk Next.js Quickstart: https://clerk.com/docs/quickstarts/nextjs
- Clerk Middleware: https://clerk.com/docs/references/nextjs/clerk-middleware
