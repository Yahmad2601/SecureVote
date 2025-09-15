import { useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { isSameDay } from "date-fns";
import { Voter } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { downloadBlob } from "@/lib/utils";

export default function VoterRegistrationCard() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: voters = [] } = useQuery<Voter[]>({
    queryKey: ["/api/voters"],
  });

  const todaysRegistrations = useMemo(() => {
    const today = new Date();
    return voters.filter((voter) =>
      voter.createdAt ? isSameDay(new Date(voter.createdAt), today) : false
    ).length;
  }, [voters]);

  const pendingApprovals = useMemo(
    () => voters.filter((voter) => !voter.hasVoted).length,
    [voters],
  );

  const bulkImportMutation = useMutation({
    mutationFn: async (importedVoters: Pick<Voter, "voterId" | "fullName" | "fingerprintHash">[]) => {
      const response = await apiRequest("POST", "/api/voters/bulk", { voters: importedVoters });
      return response.json();
    },
    onSuccess: (data: Voter[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/voters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Import complete",
        description: `${data.length} voters imported successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Import failed",
        description: "Unable to import the selected CSV file",
        variant: "destructive",
      });
    },
  });

  const handleAddVoter = () => {
    setLocation("/voters?create=1");
  };

  const handleBulkImport = () => {
    if (!hasPermission("voters")) return;
    fileInputRef.current?.click();
  };

  const handleExportVoters = () => {
    if (voters.length === 0) {
      toast({
        title: "No voters to export",
        description: "Register voters before exporting a CSV report",
      });
      return;
    }

    const csvContent = [
      "voterId,fullName,fingerprintHash,hasVoted,createdAt",
      ...voters.map((voter) =>
        `${voter.voterId},${voter.fullName},${voter.fingerprintHash},${voter.hasVoted},${voter.createdAt}`
      ),
    ].join("\n");

    downloadBlob(
      `securevote_voters_${new Date().toISOString().split("T")[0]}.csv`,
      csvContent,
      "text/csv",
    );
  };

  const handleSyncWithDevices = () => {
    setLocation("/devices");
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const [headerRow, ...rows] = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const headers = headerRow.split(",").map((header) => header.trim());
      const requiredHeaders = ["voterId", "fullName", "fingerprintHash"];
      const hasAllHeaders = requiredHeaders.every((header) => headers.includes(header));

      if (!hasAllHeaders) {
        toast({
          title: "Invalid CSV format",
          description: "CSV must include voterId, fullName and fingerprintHash columns",
          variant: "destructive",
        });
        return;
      }

      const mappedVoters = rows.map((row) => {
        const values = row.split(",").map((value) => value.trim());
        const voter: any = {};
        headers.forEach((header, index) => {
          voter[header] = values[index] ?? "";
        });
        return voter;
      });

      bulkImportMutation.mutate(mappedVoters);
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Unable to read the selected CSV file",
        variant: "destructive",
      });
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
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

      <div className="text-sm text-muted-foreground mb-4" data-testid="total-registered">
        Total registered voters: <span className="text-foreground font-medium">{voters.length}</span>
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

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelected}
        />

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
