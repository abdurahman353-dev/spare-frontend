"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import api from "@/lib/axios";
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
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (data: any) => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        try {
          const res = await api.get("/user");
          setUser(res.data);
        } catch (err) {
          localStorage.removeItem("auth_token");
          delete api.defaults.headers.common["Authorization"];
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (credentials: any) => {
    const res = await api.post("/login", credentials);
    const { user, token } = res.data;
    localStorage.setItem("auth_token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser(user);
    
    if (user.must_change_password) {
      router.push("/change-password");
    } else if (user.role === "admin" || user.role === "superadmin") {
      router.push("/dashboard");
    } else {
      router.push("/products");
    }
  };

  const register = async (data: any) => {
    const res = await api.post("/register", data);
    const { user, token } = res.data;
    localStorage.setItem("auth_token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser(user);
    router.push("/");
  };

  const changePassword = async (data: any) => {
    const res = await api.post("/change-password", data);
    // Refresh user to get updated must_change_password flag
    const userRes = await api.get("/user");
    setUser(userRes.data);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post("/logout");
    } finally {
      localStorage.removeItem("auth_token");
      delete api.defaults.headers.common["Authorization"];
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout,
      changePassword,
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
