import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Device } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, WifiOff, Wifi, AlertTriangle, Battery, MapPin, Fingerprint } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Devices() {
  const { toast } = useToast();

  const { data: devices = [], isLoading, refetch } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 10000, // Refetch every 10 seconds for live status
  });

  const syncMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const response = await apiRequest("POST", `/api/devices/${deviceId}/sync`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      toast({
        title: "Device synchronized",
        description: "Device has been synchronized successfully",
      });
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Failed to synchronize device",
        variant: "destructive",
      });
    },
  });

  const testVoteMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const response = await apiRequest("POST", `/api/devices/${deviceId}/test-vote`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/votes/results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/votes/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/votes/logs?limit=200"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity-logs"] });
      toast({
        title: "Test vote recorded",
        description: data?.voterId
          ? `Vote captured for voter ${String(data.voterId).slice(0, 3)}***`
          : "Test vote submitted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Test vote failed",
        description: error?.message || "Unable to submit a test vote",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <Wifi className="h-4 w-4 text-green-600" />;
      case "offline":
        return <WifiOff className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-100 text-green-800 border-green-200";
      case "offline":
        return "bg-red-100 text-red-800 border-red-200";
      case "warning":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getBatteryColor = (level: number | null) => {
    if (level === null) return "text-gray-400";
    if (level > 50) return "text-green-600";
    if (level > 20) return "text-orange-600";
    return "text-red-600";
  };

  const handleSyncDevice = (deviceId: string) => {
    syncMutation.mutate(deviceId);
  };

  const handleSyncAll = async () => {
    const onlineDevices = devices.filter(d => d.status === "online");
    for (const device of onlineDevices) {
      syncMutation.mutate(device.deviceId);
    }
  };

  const handleTestVote = (deviceId: string) => {
    testVoteMutation.mutate(deviceId);
  };

  if (isLoading) {
    return (
      <>
        <Header
          title="Device Management"
          subtitle="Monitor and control voting devices"
        />
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Device Management"
        subtitle="Monitor and control voting devices"
      />
      
      <div className="p-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Online</span>
                <span className="text-lg font-semibold ml-auto" data-testid="online-devices-count">
                  {devices.filter(d => d.status === "online").length}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <WifiOff className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">Offline</span>
                <span className="text-lg font-semibold ml-auto" data-testid="offline-devices-count">
                  {devices.filter(d => d.status === "offline").length}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Warning</span>
                <span className="text-lg font-semibold ml-auto" data-testid="warning-devices-count">
                  {devices.filter(d => d.status === "warning").length}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <Button 
                  onClick={handleSyncAll}
                  variant="outline"
                  size="sm"
                  disabled={syncMutation.isPending}
                  data-testid="button-sync-all-devices"
                >
                  Sync All
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Device Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <Card key={device.id} className="border-2" data-testid={`device-card-${device.deviceId}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{device.name}</CardTitle>
                  <Badge 
                    variant="outline"
                    className={getStatusColor(device.status)}
                  >
                    {getStatusIcon(device.status)}
                    <span className="ml-1 capitalize">{device.status}</span>
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">ID: {device.deviceId}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Location */}
                {device.location && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{device.location}</span>
                  </div>
                )}

                {/* Battery */}
                <div className="flex items-center space-x-2">
                  <Battery className={`h-4 w-4 ${getBatteryColor(device.batteryLevel)}`} />
                  <span className="text-sm">
                    Battery: {device.batteryLevel !== null ? `${device.batteryLevel}%` : "N/A"}
                  </span>
                </div>

                {/* Firmware */}
                {device.firmwareVersion && (
                  <div className="text-sm text-muted-foreground">
                    Firmware: {device.firmwareVersion}
                  </div>
                )}

                {/* Last Sync */}
                <div className="text-sm text-muted-foreground">
                  Last sync: {device.lastSync 
                    ? formatDistanceToNow(new Date(device.lastSync), { addSuffix: true })
                    : "Never"
                  }
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    onClick={() => handleSyncDevice(device.deviceId)}
                    disabled={device.status === "offline" || syncMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    data-testid={`button-sync-${device.deviceId}`}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Sync
                  </Button>
                  <Button
                    onClick={() => handleTestVote(device.deviceId)}
                    disabled={device.status === "offline" || testVoteMutation.isPending}
                    variant="default"
                    size="sm"
                    className="flex-1"
                    data-testid={`button-test-vote-${device.deviceId}`}
                  >
                    <Fingerprint className="h-3 w-3 mr-1" />
                    Test Vote
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={device.status === "offline"}
                    data-testid={`button-configure-${device.deviceId}`}
                  >
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {devices.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <WifiOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No devices found</h3>
              <p className="text-muted-foreground">
                No voting devices are currently registered in the system.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
