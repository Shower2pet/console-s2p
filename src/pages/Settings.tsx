import { useState } from "react";
import { Palette, Upload, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Settings = () => {
  const [brandName, setBrandName] = useState('PetShop Roma');
  const [primaryColor, setPrimaryColor] = useState('#005596');
  const [secondaryColor, setSecondaryColor] = useState('#79BDE8');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          <Palette className="inline mr-2 h-6 w-6 text-primary" />
          Impostazioni Brand
        </h1>
        <p className="text-muted-foreground">Personalizza l'aspetto delle tue stazioni</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Identità Brand</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome Brand</Label>
              <Input value={brandName} onChange={e => setBrandName(e.target.value)} />
            </div>
            <div>
              <Label>Logo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <Button variant="outline" size="sm">Carica Logo</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Colori</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Colore Primario</Label>
              <div className="flex items-center gap-3 mt-2">
                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded cursor-pointer border-0" />
                <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="font-mono" />
              </div>
            </div>
            <div>
              <Label>Colore Secondario</Label>
              <div className="flex items-center gap-3 mt-2">
                <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="h-10 w-14 rounded cursor-pointer border-0" />
                <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="font-mono" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Anteprima</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl p-6 text-center" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
            <h2 className="text-2xl font-heading font-bold" style={{ color: 'white' }}>{brandName}</h2>
            <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Stazione di lavaggio per animali</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="gap-2">
          <Save className="h-4 w-4" /> Salva Impostazioni
        </Button>
      </div>
    </div>
  );
};

export default Settings;
