import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityLog, SecurityLog } from "@shared/schema";
import { DashboardStats, VoteLog, VoteResult } from "@/types";
import { downloadBlob } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { FileDown, Printer, Shield, ClipboardList } from "lucide-react";

export default function Reports() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 30000,
  });

  const { data: voteResults = [] } = useQuery<VoteResult[]>({
    queryKey: ["/api/votes/results"],
  });

  const { data: voteLogs = [] } = useQuery<VoteLog[]>({
    queryKey: ["/api/votes/logs?limit=200"],
  });

  const { data: activityLogs = [] } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs?limit=100"],
  });

  const { data: securityLogs = [] } = useQuery<SecurityLog[]>({
    queryKey: ["/api/security-logs"],
  });

  const totalVotes = stats?.votesCast ?? voteResults.reduce((acc, result) => acc + result.count, 0);

  const candidateSummary = useMemo(() => {
    return voteResults.map((result) => ({
      name: result.candidate.name,
      party: result.candidate.party,
      votes: result.count,
      percentage: totalVotes > 0 ? (result.count / totalVotes) * 100 : 0,
    }));
  }, [voteResults, totalVotes]);

  const handleExportVotesCSV = () => {
    if (voteLogs.length === 0) {
      downloadBlob(
        `securevote_votes_${new Date().toISOString().split("T")[0]}.csv`,
        "id,voterId,candidate,device,timestamp\n",
        "text/csv",
      );
      return;
    }

    const csvRows = voteLogs.map((vote) =>
      [
        vote.id,
        vote.voterId,
        vote.candidateName,
        vote.deviceName ?? vote.deviceId ?? "",
        vote.timestamp,
      ].join(","),
    );

    const header = "id,voterId,candidate,device,timestamp";
    downloadBlob(
      `securevote_votes_${new Date().toISOString().split("T")[0]}.csv`,
      [header, ...csvRows].join("\n"),
      "text/csv",
    );
  };

  const handleExportSecurityCSV = () => {
    const header = "id,type,severity,deviceId,timestamp,resolved,description";
    const csvRows = securityLogs.map((log) =>
      [
        log.id,
        log.type,
        log.severity,
        log.deviceId ?? "",
        log.timestamp ?? "",
        log.resolved,
        log.description.replace(/,/g, ";"),
      ].join(","),
    );

    downloadBlob(
      `securevote_security_${new Date().toISOString().split("T")[0]}.csv`,
      [header, ...csvRows].join("\n"),
      "text/csv",
    );
  };

  const handleExportJSON = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      stats,
      candidates: candidateSummary,
      votes: voteLogs,
      securityLogs,
      activityLogs,
    };

    downloadBlob(
      `securevote_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
  };

  const handleGeneratePDF = () => {
    if (typeof window === "undefined") return;
    const reportWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!reportWindow) return;

    const summaryRows = candidateSummary
      .map((candidate) => `
        <tr>
          <td style="padding:6px 12px;border:1px solid #ddd;">${candidate.name}</td>
          <td style="padding:6px 12px;border:1px solid #ddd;">${candidate.party}</td>
          <td style="padding:6px 12px;border:1px solid #ddd;">${candidate.votes}</td>
          <td style="padding:6px 12px;border:1px solid #ddd;">${candidate.percentage.toFixed(1)}%</td>
        </tr>
      `)
      .join("");

    reportWindow.document.write(`
      <html>
        <head>
          <title>SecureVote Election Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin-bottom: 4px; }
            h2 { margin-top: 24px; }
            table { border-collapse: collapse; width: 100%; margin-top: 12px; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>SecureVote Election Report</h1>
          <p>Generated ${new Date().toLocaleString()}</p>
          <h2>Summary</h2>
          <ul>
            <li>Total registered voters: ${stats?.registeredVoters ?? 0}</li>
            <li>Votes cast: ${stats?.votesCast ?? totalVotes}</li>
            <li>Turnout rate: ${(stats?.turnoutRate ?? 0).toFixed(1)}%</li>
            <li>Active devices: ${stats?.activeDevices ?? 0}</li>
          </ul>
          <h2>Candidate Results</h2>
          <table>
            <thead>
              <tr>
                <th style="padding:6px 12px;border:1px solid #ddd;">Candidate</th>
                <th style="padding:6px 12px;border:1px solid #ddd;">Party</th>
                <th style="padding:6px 12px;border:1px solid #ddd;">Votes</th>
                <th style="padding:6px 12px;border:1px solid #ddd;">Share</th>
              </tr>
            </thead>
            <tbody>${summaryRows}</tbody>
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  return (
    <>
      <Header
        title="Reports"
        subtitle="Generate election reports and audit trails"
        showExportButton={true}
        onExport={handleGeneratePDF}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Registered Voters</CardDescription>
              <CardTitle className="text-3xl">{(stats?.registeredVoters ?? 0).toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Supabase master voter roll
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Votes Cast</CardDescription>
              <CardTitle className="text-3xl">{(stats?.votesCast ?? totalVotes).toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Includes test votes marked as verified
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Turnout</CardDescription>
              <CardTitle className="text-3xl">{(stats?.turnoutRate ?? 0).toFixed(1)}%</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Percentage of registered voters who voted
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Devices</CardDescription>
              <CardTitle className="text-3xl">{stats?.activeDevices ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Devices synchronized within the last polling window
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Candidate Performance</CardTitle>
              <CardDescription>Comprehensive vote tally by candidate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border" data-testid="candidate-summary">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead className="text-right">Votes</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidateSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No votes recorded yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      candidateSummary.map((candidate) => (
                        <TableRow key={candidate.name}>
                          <TableCell className="font-medium">{candidate.name}</TableCell>
                          <TableCell>{candidate.party}</TableCell>
                          <TableCell className="text-right">{candidate.votes.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{candidate.percentage.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export Center</CardTitle>
              <CardDescription>Download formatted election data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" onClick={handleExportVotesCSV} data-testid="export-votes">
                <FileDown className="h-4 w-4 mr-2" />
                Download Votes (CSV)
              </Button>
              <Button className="w-full justify-start" onClick={handleExportSecurityCSV} data-testid="export-security">
                <Shield className="h-4 w-4 mr-2" />
                Security Alerts (CSV)
              </Button>
              <Button className="w-full justify-start" onClick={handleExportJSON} data-testid="export-json">
                <ClipboardList className="h-4 w-4 mr-2" />
                Comprehensive JSON Report
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={handleGeneratePDF} data-testid="export-pdf">
                <Printer className="h-4 w-4 mr-2" />
                Printable Summary (PDF)
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>Chronological activity records</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLogs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No activity records available yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1" data-testid="audit-trail">
                  {activityLogs.slice(0, 12).map((activity) => (
                    <div key={activity.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{activity.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(activity.timestamp!), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Incidents</CardTitle>
              <CardDescription>Alerts impacting certification</CardDescription>
            </CardHeader>
            <CardContent>
              {securityLogs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No security alerts have been raised.
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1" data-testid="report-security">
                  {securityLogs.slice(0, 12).map((log) => (
                    <div key={log.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{log.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{formatDistanceToNow(new Date(log.timestamp!), { addSuffix: true })}</div>
                          <Badge variant={log.resolved ? "secondary" : "destructive"}>
                            {log.resolved ? "Resolved" : "Active"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
