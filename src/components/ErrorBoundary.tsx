import React, { Component, ErrorInfo, ReactNode } from "react";
import { logErrorToDb } from "@/services/errorLogService";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logErrorToDb({
      error_message: error.message,
      error_stack: error.stack ?? undefined,
      error_context: `ComponentStack: ${errorInfo.componentStack}`,
      component: "ErrorBoundary",
      severity: "critical",
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">
            Si è verificato un errore imprevisto
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            L'errore è stato registrato automaticamente. Prova a ricaricare la pagina.
          </p>
          <Button onClick={() => window.location.reload()}>
            Ricarica pagina
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
