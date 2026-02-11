import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeletePartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerName: string;
  onConfirm: () => Promise<void>;
}

const DeletePartnerDialog = ({ open, onOpenChange, partnerName, onConfirm }: DeletePartnerDialogProps) => {
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isMatch = confirmation.trim().toLowerCase() === partnerName.trim().toLowerCase();

  const handleConfirm = async () => {
    if (!isMatch) return;
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
      setConfirmation("");
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) setConfirmation("");
    onOpenChange(val);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Elimina Partner
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              Questa azione è <strong className="text-destructive">irreversibile</strong>. Verranno eliminati l'account, il profilo e tutti i dati associati a questo partner.
            </span>
            <span className="block">
              Per confermare, scrivi il nome esatto del partner: <strong className="text-foreground">{partnerName}</strong>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-name">Nome del partner</Label>
          <Input
            id="confirm-name"
            placeholder={partnerName}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!isMatch || isDeleting}
            onClick={handleConfirm}
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Elimina Definitivamente
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeletePartnerDialog;
