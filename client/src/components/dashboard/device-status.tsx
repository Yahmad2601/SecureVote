import { useQuery } from "@tanstack/react-query";
import { Device } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DeviceStatus() {
  const { toast } = useToast();
  
  const { data: devices = [], isLoading, refetch } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      online: "bg-green-500",
      offline: "bg-red-500",
      warning: "bg-orange-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const getStatusTextColor = (status: string) => {
    const colors: { [key: string]: string } = {
      online: "text-green-600",
      offline: "text-red-600",
      warning: "text-orange-600",
    };
    return colors[status] || "text-gray-600";
  };

  const getBorderColor = (status: string) => {
    if (status === "warning") return "border-2 border-orange-200";
    if (status === "offline") return "border-2 border-red-200";
    return "";
  };

  const handleSyncAll = async () => {
    try {
      // Here you would make API calls to sync all online devices
      await refetch();
      toast({
        title: "Sync initiated",
        description: "All online devices are being synchronized",
      });
    } catch (error) {
      toast({
        title: "Sync failed",
        description: "Failed to sync devices",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Device Status Overview</h3>
          <div className="animate-pulse">
            <div className="h-9 w-32 bg-muted rounded-lg"></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-secondary rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="w-2 h-2 bg-muted rounded-full"></div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 bg-muted rounded w-10"></div>
                    <div className="h-3 bg-muted rounded w-12"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-muted rounded w-12"></div>
                    <div className="h-3 bg-muted rounded w-8"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-3 bg-muted rounded w-14"></div>
                    <div className="h-3 bg-muted rounded w-10"></div>
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
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Device Status Overview</h3>
        <Button onClick={handleSyncAll} data-testid="button-sync-all">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync All Devices
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {devices.map((device) => (
          <div
            key={device.id}
            className={`bg-secondary rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${getBorderColor(device.status)}`}
            data-testid={`device-${device.deviceId}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">
                {device.name}
              </span>
              <div className={`w-2 h-2 ${getStatusColor(device.status)} rounded-full`}></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium capitalize ${getStatusTextColor(device.status)}`}>
                  {device.status}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Battery</span>
                <span className={`text-foreground ${device.batteryLevel !== null && device.batteryLevel < 20 ? 'text-orange-600' : ''}`}>
                  {device.batteryLevel !== null ? `${device.batteryLevel}%` : "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Last Sync</span>
                <span className="text-foreground">
                  {device.lastSync 
                    ? formatDistanceToNow(new Date(device.lastSync), { addSuffix: true }) 
                    : "Never"
                  }
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {devices.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No devices found</p>
        </div>
      )}
    </div>
  );
}
