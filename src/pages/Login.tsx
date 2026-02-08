import { S2PLogo } from "@/components/S2PLogo";
import logo3d from "@/assets/logo-3d-mockup.jpg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel - brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #005596 0%, #79BDE8 100%)' }}>
        <div className="absolute inset-0 opacity-10">
          {/* Decorative bubbles */}
          <div className="absolute top-[10%] left-[15%] w-32 h-32 rounded-full border-2 border-current" style={{ color: 'white' }} />
          <div className="absolute top-[30%] right-[10%] w-48 h-48 rounded-full border-2 border-current" style={{ color: 'white' }} />
          <div className="absolute bottom-[20%] left-[20%] w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="absolute bottom-[10%] right-[25%] w-40 h-40 rounded-full border border-current" style={{ color: 'white' }} />
          <div className="absolute top-[60%] left-[5%] w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>
        <div className="relative z-10 text-center px-12">
          <S2PLogo variant="full" size={60} light />
          <p className="mt-6 text-lg font-body max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.85)' }}>
            La piattaforma intelligente per gestire le tue stazioni di lavaggio per animali.
          </p>
          <div className="mt-10 rounded-2xl overflow-hidden shadow-2xl max-w-sm mx-auto border-4" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
            <img src={logo3d} alt="Shower2Pet brand" className="w-full h-auto" />
          </div>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex flex-1 items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <S2PLogo variant="full" size={40} />
          </div>
          
          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-heading font-bold text-foreground">Accedi alla Console</h1>
                <p className="text-sm text-muted-foreground mt-1">Inserisci le tue credenziali per continuare</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@azienda.it"
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

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-input" />
                    <span className="text-muted-foreground">Ricordami</span>
                  </label>
                  <a href="#" className="text-primary hover:underline font-medium">Password dimenticata?</a>
                </div>

                <Button type="submit" className="w-full h-11 text-base font-heading">
                  Accedi
                </Button>
              </form>

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
