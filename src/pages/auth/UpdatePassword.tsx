import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
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
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setChecking(false);
      }
    });

    // Also check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setChecking(false);
      } else {
        // Give a moment for the token exchange to happen
        setTimeout(async () => {
          const { data: { session: s } } = await supabase.auth.getSession();
          if (!s) navigate("/login", { replace: true });
          else setChecking(false);
        }, 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setSubmitting(false);

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Password impostata con successo!" });
    navigate("/", { replace: true });
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                  Benvenuto! Imposta la tua password
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Inserisci una password sicura per attivare il tuo account
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
                          <Input
                            type="password"
                            placeholder="••••••••"
                            disabled={submitting}
                            {...field}
                          />
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
                          <Input
                            type="password"
                            placeholder="••••••••"
                            disabled={submitting}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full h-11 text-base font-heading" disabled={submitting}>
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Imposta Password e Accedi"}
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
