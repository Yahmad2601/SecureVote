import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Monitoring() {
  return (
    <>
      <Header
        title="Live Monitoring"
        subtitle="Real-time vote tracking and analysis"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Vote Monitoring</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Real-time monitoring dashboard will be implemented here.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
