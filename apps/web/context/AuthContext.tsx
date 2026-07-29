"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { client } from "@repo/api-client";
import { ENGINE_BASE_URL } from "@/lib/api";

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  is_verified: boolean;
  free_credits: number;
  created_at: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (email: string, password: string, fullName?: string) => Promise<UserProfile>;
  verifyEmail: (email: string, token: string) => Promise<UserProfile>;
  resendVerificationCode: (email: string) => Promise<void>;
  logout: () => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Configure bearer token header on openapi client and sync cookie for middleware
  const setAuthToken = (newToken: string | null) => {
    setToken(newToken);
    if (newToken) {
      localStorage.setItem("access_token", newToken);
      document.cookie = `access_token=${newToken}; path=/; max-age=86400; SameSite=Lax`;
      client.setConfig({
        baseUrl: ENGINE_BASE_URL,
        headers: { Authorization: `Bearer ${newToken}` },
      });
    } else {
      localStorage.removeItem("access_token");
      document.cookie = "access_token=; path=/; max-age=0;";
      client.setConfig({
        baseUrl: ENGINE_BASE_URL,
        headers: {},
      });
    }
  };

  const refetchUser = async () => {
    const savedToken = localStorage.getItem("access_token");
    if (!savedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setAuthToken(savedToken);
      const res = await fetch(`${ENGINE_BASE_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        setAuthToken(null);
        setUser(null);
      }
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refetchUser();
  }, []);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const res = await fetch(`${ENGINE_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Invalid login credentials.");
    }

    const data = await res.json();
    setAuthToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (email: string, password: string, fullName?: string): Promise<UserProfile> => {
    const res = await fetch(`${ENGINE_BASE_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Registration failed.");
    }

    return await res.json();
  };

  const verifyEmail = async (email: string, verificationToken: string): Promise<UserProfile> => {
    const res = await fetch(`${ENGINE_BASE_URL}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token: verificationToken }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Verification failed.");
    }

    return await res.json();
  };

  const resendVerificationCode = async (email: string): Promise<void> => {
    const res = await fetch(`${ENGINE_BASE_URL}/api/v1/auth/resend-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to resend verification code.");
    }
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        verifyEmail,
        resendVerificationCode,
        logout,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
