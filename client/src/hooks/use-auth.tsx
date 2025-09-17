import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { hasPermission as checkPermission, type AuthenticatedUser } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { setUnauthorizedHandler } from "@/lib/auth-events";

interface AuthContextType {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const handleUnauthorized = () => {
      if (!isMounted) return;
      setUser(null);
      setIsLoading(false);
      queryClient.clear();
    };

    setUnauthorizedHandler(handleUnauthorized);

    const restoreSession = async () => {
      try {
        const res = await fetch("/api/auth/session", {
          credentials: "include",
        });

        if (!isMounted) {
          return;
        }

        if (res.status === 401) {
          setUser(null);
          return;
        }

        if (!res.ok) {
          throw new Error(`${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        setUser(data.user as AuthenticatedUser);
      } catch (error) {
        console.error("Failed to restore session", error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const login = async (username: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/login", {
      username,
      password,
    });

    const data = await response.json();
    const authenticatedUser = data.user as AuthenticatedUser;

    setUser(authenticatedUser);
    queryClient.clear();
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (error) {
      console.error("Failed to logout", error);
    } finally {
      setUser(null);
      queryClient.clear();
    }
  };

  const hasPermission = (permission: string) => {
    return checkPermission(user, permission);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    hasPermission,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
