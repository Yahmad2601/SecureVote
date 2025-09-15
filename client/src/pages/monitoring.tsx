import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { ActivityLog } from "@shared/schema";
import { DashboardStats, VoteLog, VoteResult } from "@/types";

export default function Monitoring() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 15000,
  });

  const { data: voteLogs = [], isLoading: votesLoading } = useQuery<VoteLog[]>({
    queryKey: ["/api/votes/logs"],
    refetchInterval: 5000,
  });

  const { data: voteResults = [], isLoading: resultsLoading } = useQuery<VoteResult[]>({
    queryKey: ["/api/votes/results"],
    refetchInterval: 5000,
  });

  const { data: activities = [] } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
    refetchInterval: 15000,
  });

  const uniqueDevices = useMemo(
    () => new Set(voteLogs.map((log) => log.deviceId ?? "unknown")).size,
    [voteLogs],
  );

  const lastVote = voteLogs[0];
  const lastVoteTime = lastVote
    ? formatDistanceToNow(new Date(lastVote.timestamp), { addSuffix: true })
    : "No votes received";

  const turnoutData = useMemo(() => {
    if (voteLogs.length === 0) {
      return [];
    }

    const sortedLogs = [...voteLogs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    let runningTotal = 0;
    const dataMap = new Map<string, { time: string; totalVotes: number; index: number }>();

    sortedLogs.forEach((log, index) => {
      runningTotal += 1;
      const label = format(new Date(log.timestamp), "HH:mm");
      dataMap.set(label, { time: label, totalVotes: runningTotal, index });
    });

    return Array.from(dataMap.values())
      .sort((a, b) => a.index - b.index)
      .map(({ index, ...value }) => value);
  }, [voteLogs]);

  const candidateChartData = useMemo(() => {
    if (voteResults.length === 0) {
      return [];
    }

    return voteResults.map((result) => ({
      name: result.candidate.name,
      votes: result.count,
      party: result.candidate.party,
    }));
  }, [voteResults]);

  const monitoringSummary = {
    totalVotes: stats?.votesCast ?? voteLogs.length,
    registeredVoters: stats?.registeredVoters ?? 0,
    turnoutRate: stats?.turnoutRate ?? 0,
    activeDevices: stats?.activeDevices ?? uniqueDevices,
  };

  return (
    <>
      <Header
        title="Live Monitoring"
        subtitle="Real-time vote tracking and analysis"
        alertCount={0}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Votes Cast</CardDescription>
              <CardTitle className="text-3xl">
                {monitoringSummary.totalVotes.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Turnout {monitoringSummary.turnoutRate.toFixed(1)}% of registered voters
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Registered Voters</CardDescription>
              <CardTitle className="text-3xl">
                {monitoringSummary.registeredVoters.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Database synchronized with ESP32 devices
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Live Voting Devices</CardDescription>
              <CardTitle className="text-3xl">{monitoringSummary.activeDevices}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Unique devices submitting votes in this session
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last Vote Received</CardDescription>
              <CardTitle className="text-xl">{lastVoteTime}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {lastVote && lastVote.deviceName ? `Device ${lastVote.deviceName}` : "Awaiting first vote"}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Turnout Over Time</CardTitle>
              <CardDescription>Running total of verified votes received</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {turnoutData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Waiting for the first vote to be recorded
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={turnoutData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="time" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => [value as number, "Votes"]} />
                    <Legend />
                    <Line type="monotone" dataKey="totalVotes" stroke="#2563eb" strokeWidth={2} dot={false} name="Votes" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Votes by Candidate</CardTitle>
              <CardDescription>Live tally grouped by candidate</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {resultsLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Loading candidate results…
                </div>
              ) : candidateChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No votes have been cast yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={candidateChartData}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="votes" fill="#22c55e" radius={[4, 4, 0, 0]} name="Votes" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Live Vote Feed</CardTitle>
              <CardDescription>Chronological log of biometric votes received</CardDescription>
            </CardHeader>
            <CardContent>
              {votesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((index) => (
                    <div key={index} className="animate-pulse border border-border rounded-lg p-3">
                      <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : voteLogs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No votes have been recorded yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1" data-testid="vote-feed">
                  {voteLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border border-border rounded-lg p-3 flex items-start justify-between gap-3"
                      data-testid={`vote-log-${log.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{log.candidateName}</span>
                          {log.candidateParty && (
                            <Badge variant="secondary">{log.candidateParty}</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Voter {log.maskedVoterId}
                          {log.deviceId && (
                            <span>
                              {" "}• Device {log.deviceName ?? log.deviceId}
                              {log.deviceLocation ? ` (${log.deviceLocation})` : ""}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground/80">
                          Fingerprint {log.verified ? "verified" : "pending verification"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right whitespace-nowrap">
                        {format(new Date(log.timestamp), "PPpp")}
                        <div>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Activity</CardTitle>
              <CardDescription>Latest biometric events and device actions</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  Activity logs will appear as the election progresses.
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1" data-testid="monitoring-activity">
                  {activities.slice(0, 8).map((activity) => (
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
        </div>
      </div>
    </>
  );
}
