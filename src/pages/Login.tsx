import logoHorizontal from "@/assets/logo-horizontal.png";
import logoVertical from "@/assets/logo-vertical.png";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = login(email, password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Errore di login');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - brand */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #005596 0%, #79BDE8 100%)' }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-[10%] left-[15%] w-32 h-32 rounded-full border-2 border-white" />
          <div className="absolute top-[30%] right-[10%] w-48 h-48 rounded-full border-2 border-white" />
          <div className="absolute bottom-[20%] left-[20%] w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute bottom-[10%] right-[25%] w-40 h-40 rounded-full border border-white" />
        </div>
        <div className="relative z-10 text-center px-12">
          <img src={logoVertical} alt="Shower2Pet Logo" className="w-40 h-40 mx-auto object-contain" />
          <p className="mt-6 text-lg font-body max-w-md mx-auto text-white/85">
            La piattaforma intelligente per gestire le tue stazioni di lavaggio per animali.
          </p>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex flex-1 items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <img src={logoHorizontal} alt="Shower2Pet" className="h-12 object-contain" />
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-heading font-bold text-foreground">Accedi alla Console</h1>
                <p className="text-sm text-muted-foreground mt-1">Inserisci le tue credenziali per continuare</p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@test.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <Button type="submit" className="w-full h-11 text-base font-heading">
                  Accedi
                </Button>
              </form>

              <div className="mt-6 p-4 rounded-lg bg-muted text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Account demo:</p>
                <p><span className="font-mono">admin@test.com</span> → Admin</p>
                <p><span className="font-mono">client@test.com</span> → Partner</p>
                <p className="text-[10px] mt-1">Password: qualsiasi valore</p>
              </div>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                © 2026 Shower2Pet — Tutti i diritti riservati
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
