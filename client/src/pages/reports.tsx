import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Reports() {
  const handleExport = () => {
    console.log("Export reports");
  };

  return (
    <>
      <Header
        title="Reports"
        subtitle="Generate election reports and audit trails"
        showExportButton={true}
        onExport={handleExport}
      />
      
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Election Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Report generation functionality will be implemented here.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
