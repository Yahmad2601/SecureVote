import { useQuery, useMutation } from "@tanstack/react-query";
import { SecurityLog } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, CheckCircle, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function SecurityAlerts() {
  const { toast } = useToast();
  
  const { data: securityLogs = [], isLoading } = useQuery<SecurityLog[]>({
    queryKey: ["/api/security-logs"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/security-logs/${id}/resolve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to resolve alert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-logs"] });
      toast({
        title: "Alert resolved",
        description: "Security alert has been marked as resolved",
      });
    },
    onError: () => {
      toast({
        title: "Failed to resolve alert",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const activeAlerts = securityLogs.filter(log => !log.resolved);
  const recentLogs = securityLogs.slice(0, 3);

  const getSeverityColor = (severity: string) => {
    const colors: { [key: string]: { bg: string; border: string; text: string } } = {
      critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
      high: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
      medium: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800" },
      low: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800" },
    };
    return colors[severity] || colors.medium;
  };

  const getAlertIcon = (type: string, severity: string) => {
    if (severity === "high" || severity === "critical") {
      return <AlertTriangle className="text-red-600 w-5 h-5" />;
    }
    if (type === "device_tampering") {
      return <Shield className="text-orange-600 w-5 h-5" />;
    }
    return <Shield className="text-orange-600 w-5 h-5" />;
  };

  const handleDismissAlert = (id: string) => {
    resolveMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Security Alerts</h3>
          <div className="animate-pulse">
            <div className="h-6 w-16 bg-muted rounded-full"></div>
          </div>
        </div>

        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="w-5 h-5 bg-muted-foreground rounded mt-1"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted-foreground rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted-foreground rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-muted-foreground rounded w-1/3"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Security Alerts</h3>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            activeAlerts.length > 0 
              ? "bg-red-100 text-red-800" 
              : "bg-green-100 text-green-800"
          }`}
          data-testid="alert-count"
        >
          {activeAlerts.length} Active
        </span>
      </div>

      <div className="space-y-4" data-testid="security-alerts">
        {recentLogs.length === 0 ? (
          <div className="text-center py-8">
            <Shield className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No security alerts</p>
          </div>
        ) : (
          recentLogs.map((log) => {
            const severityStyle = getSeverityColor(log.severity);
            const isResolved = log.resolved;
            
            return (
              <div
                key={log.id}
                className={`p-4 ${isResolved ? 'bg-green-50 border border-green-200' : `${severityStyle.bg} border ${severityStyle.border}`} rounded-lg`}
                data-testid={`security-alert-${log.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {isResolved ? (
                      <CheckCircle className="text-green-600 w-5 h-5 mt-1" />
                    ) : (
                      getAlertIcon(log.type, log.severity)
                    )}
                    <div>
                      <p className={`font-medium ${isResolved ? 'text-green-800' : severityStyle.text}`}>
                        {log.description}
                      </p>
                      <p className={`text-sm mt-1 ${isResolved ? 'text-green-600' : severityStyle.text.replace('800', '600')}`}>
                        {log.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {log.deviceId && ` • Device ${log.deviceId}`}
                      </p>
                      <p className={`text-xs mt-2 ${isResolved ? 'text-green-500' : severityStyle.text.replace('800', '500')}`}>
                        {formatDistanceToNow(new Date(log.timestamp!), { addSuffix: true })}
                        {isResolved && " • Resolved"}
                      </p>
                    </div>
                  </div>
                  {!isResolved && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismissAlert(log.id)}
                      disabled={resolveMutation.isPending}
                      data-testid={`button-dismiss-${log.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        className="w-full mt-4 text-sm text-primary hover:text-primary/80 font-medium py-2 transition-colors"
        data-testid="button-view-security-logs"
      >
        View All Security Logs
      </button>
    </div>
  );
}
