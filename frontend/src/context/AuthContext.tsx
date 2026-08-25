import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getErrorMessage } from "../lib/api";
import type { Role, User } from "../types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// The cookie is httpOnly so we can't read it here. Keep a small flag in
// localStorage so a logged-out visitor doesn't fire a /auth/me call that's
// always going to 401. /auth/me is still the source of truth.
const SESSION_HINT_KEY = "sf_has_session";

function readSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return true; // storage blocked — just check anyway
  }
}

function writeSessionHint(hasSession: boolean) {
  try {
    if (hasSession) localStorage.setItem(SESSION_HINT_KEY, "1");
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => readSessionHint());

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: User }>("/auth/me");
      setUser(data.user);
      writeSessionHint(true);
    } catch {
      setUser(null);
      writeSessionHint(false);
    }
  }, []);

  useEffect(() => {
    if (!readSessionHint()) {
      setIsLoading(false);
      return;
    }
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post<{ user: User }>("/auth/login", { email, password });
      setUser(data.user);
      writeSessionHint(true);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: Role) => {
    try {
      const { data } = await api.post<{ user: User }>("/auth/register", { name, email, password, role });
      setUser(data.user);
      writeSessionHint(true);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => undefined);
    setUser(null);
    writeSessionHint(false);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, refreshUser, setUser }),
    [user, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
