import { useQuery } from "@tanstack/react-query";
import { ActivityLog } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function RecentActivity() {
  const { data: activities = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const getActivityIcon = (type: string) => {
    const iconMap: { [key: string]: string } = {
      vote_cast: "w-2 h-2 bg-green-500 rounded-full",
      voter_registered: "w-2 h-2 bg-blue-500 rounded-full",
      device_sync: "w-2 h-2 bg-orange-500 rounded-full",
      user_login: "w-2 h-2 bg-purple-500 rounded-full",
    };
    return iconMap[type] || "w-2 h-2 bg-gray-500 rounded-full";
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
        
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start space-x-3 p-3 hover:bg-secondary rounded-lg">
                <div className="w-2 h-2 bg-muted rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
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
      <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
      
      <div className="space-y-4" data-testid="recent-activity">
        {activities.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">No recent activity</p>
          </div>
        ) : (
          activities.slice(0, 5).map((activity) => (
            <div
              key={activity.id}
              className="flex items-start space-x-3 p-3 hover:bg-secondary rounded-lg transition-colors cursor-pointer"
              data-testid={`activity-${activity.type}-${activity.id}`}
            >
              <div className={`${getActivityIcon(activity.type)} mt-2 flex-shrink-0`}></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{activity.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(activity.timestamp!), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      
      {activities.length > 5 && (
        <button
          className="w-full mt-4 text-sm text-primary hover:text-primary/80 font-medium py-2 transition-colors"
          data-testid="button-view-all-activity"
        >
          View All Activity
        </button>
      )}
    </div>
  );
}
