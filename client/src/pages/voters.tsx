import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Voters() {
  return (
    <>
      <Header
        title="Voter Registration"
        subtitle="Manage voter database and registrations"
      />
      
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Voter Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Voter registration functionality will be implemented here.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
