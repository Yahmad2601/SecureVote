import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SecurityLog } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Shield, ShieldAlert, CheckCircle2, Filter, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type SeverityFilter = "all" | "low" | "medium" | "high" | "critical";
type StatusFilter = "all" | "active" | "resolved";

const severityLabels: Record<Exclude<SeverityFilter, "all">, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const severityStyles: Record<Exclude<SeverityFilter, "all">, { badge: string; dot: string }> = {
  low: { badge: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500" },
  medium: { badge: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  high: { badge: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  critical: { badge: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-600" },
};

export default function Security() {
  const { toast } = useToast();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const { data: logs = [], isLoading, refetch } = useQuery<SecurityLog[]>({
    queryKey: ["/api/security-logs"],
    refetchInterval: 5000,
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/security-logs/${id}/resolve`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity-logs"] });
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

  const activeCount = logs.filter((log) => !log.resolved).length;
  const criticalCount = logs.filter((log) => log.severity === "critical" && !log.resolved).length;
  const resolvedCount = logs.filter((log) => log.resolved).length;

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (severityFilter !== "all" && log.severity !== severityFilter) {
        return false;
      }

      if (statusFilter === "active" && log.resolved) {
        return false;
      }

      if (statusFilter === "resolved" && !log.resolved) {
        return false;
      }

      return true;
    });
  }, [logs, severityFilter, statusFilter]);

  const handleResolve = (id: string) => {
    resolveMutation.mutate(id);
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <>
      <Header
        title="Security Logs"
        subtitle="Monitor security events and alerts"
        alertCount={activeCount}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardDescription>Active Alerts</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {activeCount}
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </CardTitle>
              </div>
              <Badge variant="destructive">Live</Badge>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Unresolved alerts from biometric devices
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardDescription>Critical Severity</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {criticalCount}
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                </CardTitle>
              </div>
              <Badge variant="outline">Critical</Badge>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Includes device tampering and fingerprint mismatches
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardDescription>Resolved Alerts</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  {resolvedCount}
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </CardTitle>
              </div>
              <Badge variant="secondary">Audit Trail</Badge>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Stored for compliance and forensic review
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Security Events</CardTitle>
              <CardDescription>Real-time biometric security telemetry</CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || resolveMutation.isPending}
                data-testid="button-refresh-security"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                Severity:
              </div>
              {["all", "low", "medium", "high", "critical"].map((level) => (
                <Button
                  key={level}
                  variant={severityFilter === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSeverityFilter(level as SeverityFilter)}
                  data-testid={`severity-filter-${level}`}
                >
                  {level === "all" ? "All" : severityLabels[level as Exclude<SeverityFilter, "all">]}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-sm text-muted-foreground">Status:</span>
              {["active", "resolved", "all"].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status as StatusFilter)}
                  data-testid={`status-filter-${status}`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="border border-border rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm" data-testid="empty-security-state">
                No security alerts match the selected filters.
              </div>
            ) : (
              <div className="rounded-lg border border-border" data-testid="security-log-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alert</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const severityStyle = severityStyles[(log.severity as Exclude<SeverityFilter, "all">) || "medium"];
                      return (
                        <TableRow key={log.id} data-testid={`security-row-${log.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-start gap-2">
                              <Shield className="h-4 w-4 text-muted-foreground mt-1" />
                              <div>
                                <p className="text-sm text-foreground">{log.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {log.type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${severityStyle?.dot ?? "bg-orange-500"}`}></span>
                              <span className={`text-xs font-medium px-2 py-1 rounded-full border ${severityStyle?.badge ?? "bg-orange-100 text-orange-800 border-orange-200"}`}>
                                {log.severity.charAt(0).toUpperCase() + log.severity.slice(1)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.deviceId ? `Device ${log.deviceId}` : "N/A"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(log.timestamp!), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.resolved ? "secondary" : "destructive"}>
                              {log.resolved ? "Resolved" : "Active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {!log.resolved && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolve(log.id)}
                                disabled={resolveMutation.isPending}
                                data-testid={`resolve-${log.id}`}
                              >
                                Resolve
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
