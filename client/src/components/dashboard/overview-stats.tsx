import { Users, VoteIcon, PieChart, Cpu, TrendingUp } from "lucide-react";

interface OverviewStatsProps {
  stats: {
    registeredVoters: number;
    votesCast: number;
    turnoutRate: number;
    activeDevices: number;
    totalDevices: number;
  };
}

export default function OverviewStats({ stats }: OverviewStatsProps) {
  const statCards = [
    {
      title: "Registered Voters",
      value: stats.registeredVoters.toLocaleString(),
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      trend: "+12%",
      trendText: "from yesterday",
      trendUp: true,
      testId: "stat-registered-voters",
    },
    {
      title: "Votes Cast",
      value: stats.votesCast.toLocaleString(),
      icon: VoteIcon,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      trend: "Live",
      trendText: "Real-time count",
      trendUp: null,
      testId: "stat-votes-cast",
    },
    {
      title: "Turnout Rate",
      value: `${stats.turnoutRate.toFixed(1)}%`,
      icon: PieChart,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      progress: stats.turnoutRate,
      testId: "stat-turnout-rate",
    },
    {
      title: "Active Devices",
      value: `${stats.activeDevices}/${stats.totalDevices}`,
      icon: Cpu,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      trend: `${Math.round((stats.activeDevices / stats.totalDevices) * 100)}% operational`,
      trendText: "",
      trendUp: null,
      testId: "stat-active-devices",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((card) => {
        const Icon = card.icon;
        
        return (
          <div
            key={card.title}
            className="bg-card rounded-xl shadow-sm border border-border p-6"
            data-testid={card.testId}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">
                  {card.title}
                </p>
                <p className="text-3xl font-semibold text-foreground mt-2">
                  {card.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${card.iconBg} rounded-xl flex items-center justify-center`}>
                <Icon className={`${card.iconColor} text-xl w-6 h-6`} />
              </div>
            </div>
            
            <div className="mt-4">
              {card.progress !== undefined ? (
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(card.progress, 100)}%` }}
                  />
                </div>
              ) : (
                <div className="flex items-center text-sm">
                  {card.trendUp === true && (
                    <TrendingUp className="text-green-500 mr-1 w-4 h-4" />
                  )}
                  <span
                    className={
                      card.trendUp === true
                        ? "text-green-600 font-medium"
                        : card.trendUp === false
                        ? "text-red-600 font-medium"
                        : "text-green-600 font-medium"
                    }
                  >
                    {card.trend}
                  </span>
                  {card.trendText && (
                    <span className="text-muted-foreground ml-2">
                      {card.trendText}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
