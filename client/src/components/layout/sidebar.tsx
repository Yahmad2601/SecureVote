import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  VoteIcon,
  LayoutDashboard,
  Users,
  BarChart3,
  Cpu,
  FileText,
  Shield,
  LogOut,
} from "lucide-react";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout, hasPermission } = useAuth();

  const navigation = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      permission: "dashboard",
    },
    {
      name: "Voter Registration",
      href: "/voters",
      icon: Users,
      permission: "voters",
    },
    {
      name: "Live Monitoring",
      href: "/monitoring",
      icon: BarChart3,
      permission: "monitoring",
    },
    {
      name: "Device Management",
      href: "/devices",
      icon: Cpu,
      permission: "devices",
    },
    {
      name: "Reports",
      href: "/reports",
      icon: FileText,
      permission: "reports",
    },
    {
      name: "Security Logs",
      href: "/security",
      icon: Shield,
      permission: "security",
    },
  ];

  const getRoleDisplay = (role: string) => {
    const roleMap: { [key: string]: string } = {
      super_admin: "Super Admin",
      election_officer: "Election Officer",
      observer: "Observer",
    };
    return roleMap[role] || role;
  };

  return (
    <aside className="relative flex h-full w-64 flex-col bg-card shadow-lg border-r border-border">
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <VoteIcon className="text-primary-foreground text-sm" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">SecureVote</h1>
            <p className="text-xs text-muted-foreground">Admin Dashboard</p>
          </div>
        </div>
      </div>

      {/* User Role Indicator */}
      <div className="px-6 pb-4">
        <div className="bg-secondary rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-foreground">
              {getRoleDisplay(user?.role || "")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {user?.fullName}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          if (!hasPermission(item.permission)) return null;
          
          const isActive = location === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.name} href={item.href}>
              <div
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4 px-4 pb-6">
        {/* Security Status */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <Shield className="text-green-600 w-4 h-4" />
            <span className="text-sm font-medium text-green-800">System Secure</span>
          </div>
          <p className="text-xs text-green-600 mt-1">All devices synchronized</p>
        </div>

        {/* Logout Button */}
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
