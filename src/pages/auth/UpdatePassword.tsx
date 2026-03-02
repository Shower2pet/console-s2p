import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { handleAppError } from "@/lib/globalErrorHandler";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logoHorizontal from "@/assets/logo-horizontal.png";
import logoVertical from "@/assets/logo-vertical.png";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";

const schema = z
  .object({
    password: z.string().min(6, "La password deve avere almeno 6 caratteri"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

const UpdatePassword = () => {
  const navigate = useNavigate();
  const { user, loading, clearPasswordRecovery } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) throw error;
      clearPasswordRecovery();
      toast.success("Password aggiornata con successo!");
      navigate("/", { replace: true });
    } catch (error: any) {
      handleAppError(error, "UpdatePassword: impostazione password");
    } finally {
      setSubmitting(false);
    }
  };

  // Show loader while auth is initializing
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If there's no session at all (e.g., direct navigation without token), 
  // show an informative message instead of redirecting to login
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-md border-0 shadow-lg">
          <CardContent className="p-8 text-center space-y-4">
            <h2 className="text-xl font-heading font-bold text-foreground">Link non valido o scaduto</h2>
            <p className="text-sm text-muted-foreground">
              Il link di recupero password potrebbe essere scaduto o già utilizzato.
              Richiedi un nuovo link dalla pagina di login.
            </p>
            <Button onClick={() => navigate("/login", { replace: true })} className="w-full">
              Torna al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel - brand */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ background: "linear-gradient(135deg, #005596 0%, #79BDE8 100%)" }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-[10%] left-[15%] w-32 h-32 rounded-full border-2 border-white" />
          <div className="absolute top-[30%] right-[10%] w-48 h-48 rounded-full border-2 border-white" />
          <div className="absolute bottom-[20%] left-[20%] w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute bottom-[10%] right-[25%] w-40 h-40 rounded-full border border-white" />
        </div>
        <div className="relative z-10 text-center px-12">
          <div className="w-44 h-44 mx-auto rounded-3xl bg-white/95 shadow-2xl flex items-center justify-center">
            <img src={logoVertical} alt="Shower2Pet Logo" className="w-32 h-32 object-contain" />
          </div>
          <p className="mt-6 text-lg font-body max-w-md mx-auto text-white/85">
            La piattaforma intelligente per gestire le tue stazioni di lavaggio per animali.
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <img src={logoHorizontal} alt="Shower2Pet" className="h-12 object-contain" />
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-heading font-bold text-foreground">
                  Imposta la nuova password
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Inserisci una password sicura per il tuo account
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nuova Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" disabled={submitting} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conferma Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" disabled={submitting} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full h-11 text-base font-heading" disabled={submitting}>
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Aggiorna Password"}
                  </Button>
                </form>
              </Form>

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

export default UpdatePassword;
