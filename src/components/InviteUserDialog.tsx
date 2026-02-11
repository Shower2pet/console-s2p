import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const inviteSchema = z.object({
  firstName: z.string().trim().min(1, "Nome obbligatorio").max(50),
  lastName: z.string().trim().min(1, "Cognome obbligatorio").max(50),
  email: z.string().trim().email("Email non valida").max(255),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: "partner" | "manager";
  structureId?: string;
  onSuccess?: () => void;
  title: string;
  description?: string;
}

const InviteUserDialog = ({ open, onOpenChange, role, structureId, onSuccess, title, description }: InviteUserDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { firstName: "", lastName: "", email: "" },
  });

  const onSubmit = async (values: InviteFormValues) => {
    setIsSubmitting(true);
    try {
      const body: Record<string, string> = {
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        role,
      };
      if (role === "manager" && structureId) {
        body.structureId = structureId;
      }

      const { data, error } = await supabase.functions.invoke("invite-user", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Invito inviato correttamente", description: `Un invito è stato inviato a ${values.email}` });
      reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message ?? "Impossibile inviare l'invito", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">Nome</Label>
            <Input id="firstName" placeholder="Mario" {...register("firstName")} />
            {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Cognome</Label>
            <Input id="lastName" placeholder="Rossi" {...register("lastName")} />
            {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="mario@esempio.it" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Annulla
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Invia Invito
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InviteUserDialog;
