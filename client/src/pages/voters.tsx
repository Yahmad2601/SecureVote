import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Voter, insertVoterSchema } from "@shared/schema";
import { Plus, Upload, Download, Search, CheckCircle, XCircle, Users, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { formatDistanceToNow } from "date-fns";

export default function Voters() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showFingerprintHashes, setShowFingerprintHashes] = useState(false);

  const { data: voters = [], isLoading, refetch } = useQuery<Voter[]>({
    queryKey: ["/api/voters"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const form = useForm({
    resolver: zodResolver(insertVoterSchema),
    defaultValues: {
      voterId: "",
      fullName: "",
      fingerprintHash: "",
    },
  });

  const addVoterMutation = useMutation({
    mutationFn: async (data: { voterId: string; fullName: string; fingerprintHash: string }) => {
      const response = await apiRequest("POST", "/api/voters", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Voter registered",
        description: "New voter has been registered successfully",
      });
      setShowAddDialog(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Registration failed",
        description: "Failed to register voter",
        variant: "destructive",
      });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (voters: any[]) => {
      const response = await apiRequest("POST", "/api/voters/bulk", { voters });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/voters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Import successful",
        description: `${data.length} voters imported successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Import failed",
        description: "Failed to import voters",
        variant: "destructive",
      });
    },
  });

  const filteredVoters = voters.filter(voter =>
    voter.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    voter.voterId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onSubmit = (data: any) => {
    addVoterMutation.mutate(data);
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    if (!headers.includes('voterId') || !headers.includes('fullName') || !headers.includes('fingerprintHash')) {
      toast({
        title: "Invalid CSV format",
        description: "CSV must contain columns: voterId, fullName, fingerprintHash",
        variant: "destructive",
      });
      return;
    }

    const voterData = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const voter: any = {};
      headers.forEach((header, index) => {
        voter[header] = values[index] || '';
      });
      return voter;
    });

    bulkImportMutation.mutate(voterData);
    event.target.value = '';
  };

  const handleCSVExport = () => {
    const csvContent = [
      'voterId,fullName,fingerprintHash,hasVoted,createdAt',
      ...voters.map(voter => 
        `${voter.voterId},${voter.fullName},${voter.fingerprintHash},${voter.hasVoted},${voter.createdAt}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voters_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateSampleCSV = () => {
    const sampleData = [
      'voterId,fullName,fingerprintHash',
      'V001,John Doe,a1b2c3d4e5f6g7h8i9j0',
      'V002,Jane Smith,b2c3d4e5f6g7h8i9j0a1',
      'V003,Bob Johnson,c3d4e5f6g7h8i9j0a1b2'
    ].join('\n');

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_voters_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const stats = {
    total: voters.length,
    voted: voters.filter(v => v.hasVoted).length,
    pending: voters.filter(v => !v.hasVoted).length,
  };

  if (isLoading) {
    return (
      <>
        <Header
          title="Voter Registration"
          subtitle="Manage voter database and registrations"
        />
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Voter Registration"
        subtitle="Manage voter database and registrations"
      />
      
      <div className="p-6 space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Total Registered</span>
                <span className="text-lg font-semibold ml-auto" data-testid="total-voters-count">
                  {stats.total}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Voted</span>
                <span className="text-lg font-semibold ml-auto" data-testid="voted-count">
                  {stats.voted}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <XCircle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Pending</span>
                <span className="text-lg font-semibold ml-auto" data-testid="pending-voters-count">
                  {stats.pending}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Voter Management</CardTitle>
              <div className="flex space-x-2">
                <Button onClick={generateSampleCSV} variant="outline" data-testid="button-download-template">
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  className="hidden"
                  id="csv-import"
                />
                <Button 
                  onClick={() => document.getElementById('csv-import')?.click()}
                  variant="outline"
                  disabled={bulkImportMutation.isPending}
                  data-testid="button-import-csv"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
                <Button 
                  onClick={handleCSVExport}
                  variant="outline"
                  disabled={voters.length === 0}
                  data-testid="button-export-csv"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-voter">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Voter
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Register New Voter</DialogTitle>
                      <DialogDescription>
                        Enter the voter's information to register them in the system.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="voterId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Voter ID</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., V12345" {...field} data-testid="input-voter-id" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., John Doe" {...field} data-testid="input-full-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="fingerprintHash"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fingerprint Hash</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., a1b2c3d4..." {...field} data-testid="input-fingerprint-hash" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={addVoterMutation.isPending}
                            data-testid="button-register-voter"
                          >
                            {addVoterMutation.isPending ? "Registering..." : "Register Voter"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="flex items-center space-x-4 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search voters..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-voters"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFingerprintHashes(!showFingerprintHashes)}
                data-testid="button-toggle-fingerprints"
              >
                {showFingerprintHashes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showFingerprintHashes ? "Hide" : "Show"} Fingerprints
              </Button>
            </div>

            {/* Voter Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voter ID</TableHead>
                    <TableHead>Full Name</TableHead>
                    {showFingerprintHashes && <TableHead>Fingerprint Hash</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVoters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showFingerprintHashes ? 5 : 4} className="text-center py-8">
                        {searchTerm ? "No voters found matching your search." : "No voters registered yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVoters.map((voter) => (
                      <TableRow key={voter.id} data-testid={`voter-row-${voter.voterId}`}>
                        <TableCell className="font-medium">{voter.voterId}</TableCell>
                        <TableCell>{voter.fullName}</TableCell>
                        {showFingerprintHashes && (
                          <TableCell className="font-mono text-xs max-w-xs truncate">
                            {voter.fingerprintHash}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant={voter.hasVoted ? "default" : "secondary"}>
                            {voter.hasVoted ? "Voted" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(voter.createdAt!), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {filteredVoters.length > 0 && (
              <div className="mt-4 text-sm text-muted-foreground">
                Showing {filteredVoters.length} of {voters.length} voters
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
