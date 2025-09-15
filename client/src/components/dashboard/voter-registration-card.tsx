import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function VoterRegistrationCard() {
  const { hasPermission } = useAuth();
  const { data: voters = [] } = useQuery({
    queryKey: ["/api/voters"],
  });

  // Calculate today's registrations (mock for now since we don't have date filtering)
  const todaysRegistrations = Math.floor(Math.random() * 50) + 100;
  const pendingApprovals = Math.floor(Math.random() * 30) + 10;

  const handleAddVoter = () => {
    console.log("Add voter clicked");
  };

  const handleBulkImport = () => {
    console.log("Bulk import clicked");
  };

  const handleExportVoters = () => {
    console.log("Export voters clicked");
  };

  const handleSyncWithDevices = () => {
    console.log("Sync with devices clicked");
  };

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Voter Registration</h3>
        {hasPermission("voters") && (
          <Button onClick={handleAddVoter} data-testid="button-add-voter">
            <Plus className="mr-2 h-4 w-4" />
            Add Voter
          </Button>
        )}
      </div>

      {/* Registration Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-secondary rounded-lg">
          <p className="text-2xl font-semibold text-foreground" data-testid="registrations-today">
            {todaysRegistrations}
          </p>
          <p className="text-sm text-muted-foreground">Registered Today</p>
        </div>
        <div className="text-center p-4 bg-secondary rounded-lg">
          <p className="text-2xl font-semibold text-foreground" data-testid="pending-approvals">
            {pendingApprovals}
          </p>
          <p className="text-sm text-muted-foreground">Pending Approval</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        {hasPermission("voters") && (
          <button
            onClick={handleBulkImport}
            className="w-full flex items-center justify-between p-3 bg-secondary hover:bg-accent rounded-lg transition-colors"
            data-testid="button-bulk-import"
          >
            <div className="flex items-center space-x-3">
              <Upload className="text-muted-foreground h-5 w-5" />
              <span className="text-foreground font-medium">Bulk CSV Import</span>
            </div>
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        
        <button
          onClick={handleExportVoters}
          className="w-full flex items-center justify-between p-3 bg-secondary hover:bg-accent rounded-lg transition-colors"
          data-testid="button-export-voters"
        >
          <div className="flex items-center space-x-3">
            <Download className="text-muted-foreground h-5 w-5" />
            <span className="text-foreground font-medium">Export Voter List</span>
          </div>
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        {hasPermission("devices") && (
          <button
            onClick={handleSyncWithDevices}
            className="w-full flex items-center justify-between p-3 bg-secondary hover:bg-accent rounded-lg transition-colors"
            data-testid="button-sync-devices"
          >
            <div className="flex items-center space-x-3">
              <RefreshCw className="text-muted-foreground h-5 w-5" />
              <span className="text-foreground font-medium">Sync with Devices</span>
            </div>
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
