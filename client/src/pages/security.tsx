import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Security() {
  return (
    <>
      <Header
        title="Security Logs"
        subtitle="Monitor security events and alerts"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Security Events</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Security monitoring dashboard will be implemented here.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
