import { Button } from "@/components/ui/button";
import { Bell, Download } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showExportButton?: boolean;
  onExport?: () => void;
  alertCount?: number;
}

export default function Header({ 
  title, 
  subtitle, 
  showExportButton = false, 
  onExport,
  alertCount = 0 
}: HeaderProps) {
  return (
    <header className="bg-card shadow-sm border-b border-border p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-foreground" data-testid="page-title">
            {title}
          </h2>
          {subtitle && (
            <p className="text-muted-foreground" data-testid="page-subtitle">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {/* Real-time Status */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground">Live</span>
          </div>
          
          {/* Alert Badge */}
          <div className="relative">
            <Button
              variant="secondary"
              size="icon"
              data-testid="button-alerts"
            >
              <Bell className="h-4 w-4" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {alertCount}
                </span>
              )}
            </Button>
          </div>
          
          {/* Export Button */}
          {showExportButton && (
            <Button
              onClick={onExport}
              data-testid="button-export"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
