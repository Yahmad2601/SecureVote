import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Devices() {
  return (
    <>
      <Header
        title="Device Management"
        subtitle="Monitor and control voting devices"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Device Control Panel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Device management interface will be implemented here.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
