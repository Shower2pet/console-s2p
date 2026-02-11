import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminSettings = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          <Settings className="inline mr-2 h-6 w-6 text-primary" />
          Impostazioni Sistema
        </h1>
        <p className="text-muted-foreground">Configurazione globale della piattaforma</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Configurazione Generale</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Le impostazioni di sistema saranno disponibili in una versione futura.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettings;
