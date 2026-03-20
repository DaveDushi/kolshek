// Dialog for updating a provider's credentials
import { useState, useCallback } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useProviderFields, useUpdateAuth } from "@/hooks/use-providers";
import type { ProviderCard } from "@/types/api";

// Human-readable field name from API field key
const FIELD_LABELS: Record<string, string> = {
  username: "Username",
  userCode: "User Code",
  password: "Password",
  id: "ID Number",
  num: "Card Number",
  nationalID: "National ID",
  card5Digits: "Last 5 Digits",
  card6Digits: "Last 6 Digits",
  otpCodeReturnRecipient: "OTP Code Return Recipient",
};

const PASSWORD_FIELDS = new Set(["password", "nationalID", "id"]);

interface UpdateAuthDialogProps {
  provider: ProviderCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateAuthDialog({
  provider,
  open,
  onOpenChange,
}: UpdateAuthDialogProps) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const updateAuth = useUpdateAuth();

  const { data: fieldsData, isLoading: fieldsLoading } = useProviderFields(
    provider?.companyId ?? ""
  );
  const loginFields = fieldsData?.loginFields ?? [];

  const allFilled = loginFields.every(
    (f) => credentials[f] && credentials[f].trim() !== ""
  );

  const resetMutation = updateAuth.reset;
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setTimeout(() => {
          setCredentials({});
          resetMutation();
        }, 200);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, resetMutation]
  );

  const handleSubmit = useCallback(() => {
    if (!provider || !allFilled) return;
    updateAuth.mutate(
      { id: provider.id, credentials },
      { onSuccess: () => handleOpenChange(false) }
    );
  }, [provider, allFilled, credentials, updateAuth, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Update Credentials</DialogTitle>
          <DialogDescription>
            Enter new login credentials for{" "}
            <span className="font-medium">{provider?.displayName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="flex items-start gap-2 border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="text-xs">
              Credentials are stored securely in your system keychain and are
              never transmitted to external servers.
            </p>
          </Alert>

          {fieldsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : loginFields.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No credential fields found for this provider.
            </p>
          ) : (
            loginFields.map((field) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={`auth-${field}`}>
                  {FIELD_LABELS[field] ||
                    field.charAt(0).toUpperCase() + field.slice(1)}
                </Label>
                <Input
                  id={`auth-${field}`}
                  type={PASSWORD_FIELDS.has(field) ? "password" : "text"}
                  value={credentials[field] || ""}
                  onChange={(e) =>
                    setCredentials((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    }))
                  }
                  autoComplete="off"
                />
              </div>
            ))
          )}

          {updateAuth.isError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">
                {updateAuth.error instanceof Error
                  ? updateAuth.error.message
                  : "Failed to update credentials"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!allFilled || updateAuth.isPending}
          >
            {updateAuth.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Credentials"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
