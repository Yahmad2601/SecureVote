import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import OverviewStats from "@/components/dashboard/overview-stats";
import LiveResults from "@/components/dashboard/live-results";
import RecentActivity from "@/components/dashboard/recent-activity";
import DeviceStatus from "@/components/dashboard/device-status";
import VoterRegistrationCard from "@/components/dashboard/voter-registration-card";
import SecurityAlerts from "@/components/dashboard/security-alerts";
import { SecurityLog } from "@shared/schema";
import { DashboardStats } from "@/types";

export default function Dashboard() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 5000, // Refetch every 5 seconds for live updates
  });

  const { data: securityLogs = [] } = useQuery<SecurityLog[]>({
    queryKey: ["/api/security-logs"],
  });

  const activeAlerts = securityLogs.filter(log => !log.resolved).length;

  const handleExport = () => {
    console.log("Export report");
    // Implementation for report export
  };

  const defaultStats = {
    registeredVoters: 0,
    votesCast: 0,
    turnoutRate: 0,
    activeDevices: 0,
    totalDevices: 0,
  };

  return (
    <>
      <Header
        title="Election Dashboard"
        subtitle="Presidential Election 2024 - Live Monitoring"
        showExportButton={true}
        onExport={handleExport}
        alertCount={activeAlerts}
      />
      
      <div className="p-6 space-y-6">
        <OverviewStats stats={stats || defaultStats} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LiveResults />
          <RecentActivity />
        </div>

        <DeviceStatus />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VoterRegistrationCard />
          <SecurityAlerts />
        </div>
      </div>
    </>
  );
}
