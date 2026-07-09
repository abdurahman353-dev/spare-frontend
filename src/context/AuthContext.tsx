"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  must_change_password: boolean;
  country?: string;
  city?: string;
  address?: string;
  phone?: string | null;
  total_spent?: number;
  vehicle_plate?: string | null;
  license_number?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: any, redirectUrl?: string) => Promise<void>;
  register: (data: any, redirectUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (data: any) => Promise<void>;
  /** Re-fetch live user profile (total_spent, etc.) from /user */
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const setCookie = (name: string, value: string, days = 7) => {
  if (typeof window !== "undefined") {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax; Secure`;
  }
};

const deleteCookie = (name: string) => {
  if (typeof window !== "undefined") {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax; Secure`;
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /** Re-fetch user profile (including live total_spent) from /user */
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get(API_ENDPOINTS.auth.user);
      setUser(res.data);
    } catch {
      // silently ignore — session may have expired
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        try {
          const res = await api.get(API_ENDPOINTS.auth.user);
          setUser(res.data);
          // Refresh/extend the cookie
          setCookie("auth_token", token);
        } catch (err) {
          localStorage.removeItem("auth_token");
          deleteCookie("auth_token");
          delete api.defaults.headers.common["Authorization"];
        }
      } else {
        // Double check if cookie is present but localStorage is not (e.g. page refreshed/restored)
        const match = document.cookie.match(new RegExp('(^| )auth_token=([^;]+)'));
        if (match && match[2]) {
          const cookieToken = decodeURIComponent(match[2]);
          localStorage.setItem("auth_token", cookieToken);
          api.defaults.headers.common["Authorization"] = `Bearer ${cookieToken}`;
          try {
            const res = await api.get(API_ENDPOINTS.auth.user);
            setUser(res.data);
          } catch (err) {
            localStorage.removeItem("auth_token");
            deleteCookie("auth_token");
            delete api.defaults.headers.common["Authorization"];
          }
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (credentials: any, redirectUrl?: string) => {
    const res = await api.post(API_ENDPOINTS.auth.login, credentials);
    const { user: loginUser, token } = res.data;
    localStorage.setItem("auth_token", token);

    const days = credentials.remember ? 30 : 7;
    setCookie("auth_token", token, days);

    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    // Set from login response immediately (already contains total_spent from backend)
    setUser(loginUser);
    // Also fire a background re-fetch so total_spent is always live real-time
    api.get(API_ENDPOINTS.auth.user).then(r => setUser(r.data)).catch(() => { });

    if (loginUser.must_change_password) {
      router.push("/change-password");
    } else if (loginUser.role === "admin" || loginUser.role === "superadmin") {
      router.push("/dashboard");
    } else if (loginUser.role === "delivery") {
      router.push("/delivery");
    } else if (redirectUrl) {
      router.push(redirectUrl);
    } else {
      router.push("/products");
    }
  };

  const register = async (data: any, redirectUrl?: string) => {
    const res = await api.post(API_ENDPOINTS.auth.register, data);
    const { user: regUser, token } = res.data;
    localStorage.setItem("auth_token", token);
    setCookie("auth_token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser(regUser);
    if (redirectUrl) {
      router.push(redirectUrl);
    } else {
      router.push("/");
    }
  };

  const changePassword = async (data: any) => {
    const res = await api.post(API_ENDPOINTS.auth.changePassword, data);
    // Refresh user to get updated must_change_password flag and total_spent
    const userRes = await api.get(API_ENDPOINTS.auth.user);
    setUser(userRes.data);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post(API_ENDPOINTS.auth.logout);
    } finally {
      localStorage.removeItem("auth_token");
      deleteCookie("auth_token");
      delete api.defaults.headers.common["Authorization"];
      setUser(null);
      window.location.href = "/login";
    }
  };

  /**
   * Session Inactivity Watcher (30 Minutes)
   * Automatically logs the user out after 30 minutes of no interaction.
   */
  useEffect(() => {
    if (!user) return;

    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        // Trigger local logout first for instant UI response
        localStorage.removeItem("auth_token");
        deleteCookie("auth_token");
        delete api.defaults.headers.common["Authorization"];
        setUser(null);
        window.location.href = "/login?expired=1";
      }, 30 * 60 * 1000); // 30 minutes
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    const handleActivity = () => resetTimer();

    events.forEach((name) => document.addEventListener(name, handleActivity));
    resetTimer();

    return () => {
      events.forEach((name) => document.removeEventListener(name, handleActivity));
      clearTimeout(timeout);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      changePassword,
      refreshUser,
      isAuthenticated: !!user,
      isAdmin: user?.role === "admin" || user?.role === "superadmin"
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
