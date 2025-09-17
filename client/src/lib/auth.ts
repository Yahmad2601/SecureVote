import type { User } from "@shared/schema";

export type AuthenticatedUser = Omit<User, "password">;

export interface AuthState {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
}

export const hasPermission = (user: AuthenticatedUser | null, permission: string): boolean => {
  if (!user) return false;

  const permissions = {
    super_admin: ["*"],
    election_officer: ["dashboard", "voters", "monitoring", "reports", "devices"],
    observer: ["dashboard", "monitoring", "reports"]
  };
  
  const userPermissions = permissions[user.role as keyof typeof permissions] || [];
  return userPermissions.includes("*") || userPermissions.includes(permission);
};
