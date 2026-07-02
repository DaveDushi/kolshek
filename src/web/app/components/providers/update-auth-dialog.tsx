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
  const [otpCode, setOtpCode] = useState("");
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState("");
  const updateAuth = useUpdateAuth();
  const isTwoFactor = provider?.companyId === "oneZero";
  const isExternal = provider?.companyId === "external_deposit";

  const { data: fieldsData, isLoading: fieldsLoading } = useProviderFields(
    provider?.companyId ?? ""
  );
  const loginFields = fieldsData?.loginFields ?? [];

  const allFilled = loginFields.every(
    (f) => credentials[f] && credentials[f].trim() !== ""
  );
  const otpFilled = otpCode.trim() !== "";
  const depositValid = depositAmount.trim() !== "" && !isNaN(Number(depositAmount));

  const resetMutation = updateAuth.reset;
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setTimeout(() => {
          setCredentials({});
          setOtpCode("");
          setAwaitingOtp(false);
          resetMutation();
        }, 200);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, resetMutation]
  );

  const handleSubmit = useCallback(() => {
    if (!provider) return;

    if (isExternal) {
      if (!depositValid) return;
      updateAuth.mutate(
        { id: provider.id, credentials: { amount: depositAmount, date: depositDate } },
        { onSuccess: () => handleOpenChange(false) }
      );
      return;
    }

    if (awaitingOtp) {
      if (!otpFilled) return;
      updateAuth.mutate(
        { id: provider.id, otpCode: otpCode.trim(), credentials: credentials },
        { onSuccess: () => handleOpenChange(false) }
      );
      return;
    }

    if (!allFilled) return;
    updateAuth.mutate(
      { id: provider.id, credentials },
      {
        onSuccess: (res: any) => {
          if (isTwoFactor && res?.requiresOtp) {
            setAwaitingOtp(true);
            setOtpCode("");
            updateAuth.reset();
            return;
          }
          handleOpenChange(false);
        },
      }
    );
  }, [
    provider,
    allFilled,
    otpFilled,
    awaitingOtp,
    otpCode,
    credentials,
    isTwoFactor,
    updateAuth,
    handleOpenChange,
    isExternal,
    depositAmount,
    depositDate,
    depositValid,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Update Credentials</DialogTitle>
          <DialogDescription>
            {awaitingOtp ? (
              <>
                Enter the OTP code sent to{" "}
                <span className="font-medium">{provider?.displayName}</span>.
              </>
            ) : (
              <>
                Enter new login credentials for{" "}
                <span className="font-medium">{provider?.displayName}</span>.
              </>
            )}
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
          ) : isExternal ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="deposit-amount">Amount</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  inputMode="decimal"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deposit-date">Date</Label>
                <Input
                  id="deposit-date"
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                />
              </div>
            </div>
          ) : awaitingOtp ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="auth-otp">OTP Code</Label>
                <Input
                  id="auth-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
              </div>
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
            disabled={isExternal ? !depositValid || updateAuth.isPending : awaitingOtp ? !otpFilled || updateAuth.isPending : !allFilled || updateAuth.isPending}
          >
            {updateAuth.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isExternal ? "Saving..." : awaitingOtp ? "Verifying..." : "Saving..."}
              </>
            ) : (
              isExternal ? "Save" : awaitingOtp ? "Verify OTP" : "Save Credentials"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}