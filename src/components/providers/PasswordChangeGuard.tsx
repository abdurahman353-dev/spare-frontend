"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * PasswordChangeGuard
 *
 * A global route guard that sits at the root layout level.
 * If the authenticated user has `must_change_password === true` and they
 * are NOT already on the /change-password page, they are immediately
 * redirected there — no matter which URL they try to navigate to.
 *
 * This makes it impossible to skip the forced-password-change flow by
 * manually typing a URL, clicking a browser link, or pressing the back button.
 */

// Routes that are always allowed regardless of must_change_password status
const EXEMPT_ROUTES = ["/change-password", "/login", "/register", "/forgot-password", "/reset-password"];

export default function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wait until auth state is resolved before acting
    if (loading) return;

    // If the user is logged in and must change their password…
    if (user && user.must_change_password) {
      // …and they are NOT already on an exempt route, redirect them.
      const isExempt = EXEMPT_ROUTES.some((route) => pathname.startsWith(route));
      if (!isExempt) {
        router.replace("/change-password");
      }
    }
  }, [user, loading, pathname, router]);

  // While we know the user needs to change password and they're not on the
  // change-password page, render nothing to avoid a flash of the protected page.
  if (!loading && user && user.must_change_password) {
    const isExempt = EXEMPT_ROUTES.some((route) => pathname.startsWith(route));
    if (!isExempt) {
      return null;
    }
  }

  return <>{children}</>;
}
