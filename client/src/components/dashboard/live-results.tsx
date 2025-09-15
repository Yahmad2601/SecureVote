import { useQuery } from "@tanstack/react-query";
import { Candidate } from "@shared/schema";

interface VoteResult {
  candidateId: string;
  count: number;
  candidate: Candidate;
}

export default function LiveResults() {
  const { data: results = [], isLoading } = useQuery<VoteResult[]>({
    queryKey: ["/api/votes/results"],
    refetchInterval: 5000, // Refetch every 5 seconds for live updates
  });

  const totalVotes = results.reduce((sum, result) => sum + result.count, 0);

  const getPartyColor = (party: string) => {
    const colors: { [key: string]: string } = {
      "Democratic Party": "bg-blue-500",
      "Republican Party": "bg-red-500",
      "Independent": "bg-green-500",
      "Green Party": "bg-emerald-500",
      "Libertarian Party": "bg-yellow-500",
    };
    return colors[party] || "bg-gray-500";
  };

  const getPartyTextColor = (party: string) => {
    const colors: { [key: string]: string } = {
      "Democratic Party": "text-blue-600",
      "Republican Party": "text-red-600",
      "Independent": "text-green-600",
      "Green Party": "text-emerald-600",
      "Libertarian Party": "text-yellow-600",
    };
    return colors[party] || "text-gray-600";
  };

  if (isLoading) {
    return (
      <div className="lg:col-span-2 bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Live Election Results</h3>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
            <span>Loading...</span>
          </div>
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-muted rounded-full"></div>
                  <div>
                    <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-16"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-5 bg-muted rounded w-12 mb-2"></div>
                  <div className="h-4 bg-muted rounded w-8"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="lg:col-span-2 bg-card rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Live Election Results</h3>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Updated seconds ago</span>
        </div>
      </div>
      
      <div className="space-y-4" data-testid="live-results">
        {results.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No votes cast yet</p>
          </div>
        ) : (
          results.map((result) => {
            const percentage = totalVotes > 0 ? (result.count / totalVotes) * 100 : 0;
            
            return (
              <div
                key={result.candidateId}
                className="flex items-center justify-between p-4 bg-secondary rounded-lg"
                data-testid={`candidate-result-${result.candidateId}`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 ${getPartyColor(result.candidate.party)} rounded-full flex items-center justify-center`}>
                    <span className="text-white font-semibold text-sm">
                      {result.candidate.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {result.candidate.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {result.candidate.party}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">
                    {result.count.toLocaleString()}
                  </p>
                  <p className={`text-sm font-medium ${getPartyTextColor(result.candidate.party)}`}>
                    {percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalVotes > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Votes Cast:</span>
            <span className="font-medium text-foreground" data-testid="total-votes">
              {totalVotes.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
