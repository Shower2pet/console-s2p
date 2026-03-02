import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";
import logoHorizontal from "@/assets/logo-horizontal.png";

const AccessDenied = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        <img src={logoHorizontal} alt="Shower2Pet" className="h-10 mx-auto mb-8 object-contain" />
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Accesso non autorizzato</h1>
        <p className="text-muted-foreground mb-8">
          Il tuo account non ha i permessi per accedere alla Console di gestione. 
          Questa area è riservata ad amministratori, partner e gestori.
        </p>
        <Button onClick={handleLogout} variant="outline" className="w-full">
          Torna al login
        </Button>
      </div>
    </div>
  );
};

export default AccessDenied;
