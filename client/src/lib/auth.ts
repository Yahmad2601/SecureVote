import { User } from "@shared/schema";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export const getStoredUser = (): User | null => {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: User | null): void => {
  if (typeof window === "undefined") return;
  
  if (user) {
    localStorage.setItem("auth_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("auth_user");
  }
};

export const hasPermission = (user: User | null, permission: string): boolean => {
  if (!user) return false;
  
  const permissions = {
    super_admin: ["*"],
    election_officer: ["dashboard", "voters", "monitoring", "reports", "devices"],
    observer: ["dashboard", "monitoring", "reports"]
  };
  
  const userPermissions = permissions[user.role as keyof typeof permissions] || [];
  return userPermissions.includes("*") || userPermissions.includes(permission);
};
