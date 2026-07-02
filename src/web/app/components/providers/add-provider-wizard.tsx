// Multi-step wizard dialog for adding a new bank/credit-card provider
// Step 1: Choose type (bank / credit-card)
// Step 2: Choose provider from PROVIDER_LIST
// Step 3: Enter credentials (dynamic fields from API)
// Step 4: Optional alias
import { useState, useCallback, useMemo } from "react";
import {
  Building2,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { useProviderFields, useCreateProvider, useUpdateAuth } from "@/hooks/use-providers";
import { cn } from "@/lib/utils";

// Well-known Israeli financial providers
const PROVIDER_LIST = [
  { companyId: "hapoalim", displayName: "Bank Hapoalim", type: "bank" },
  { companyId: "leumi", displayName: "Bank Leumi", type: "bank" },
  { companyId: "discount", displayName: "Bank Discount", type: "bank" },
  { companyId: "mizrahi", displayName: "Bank Mizrahi", type: "bank" },
  { companyId: "mercantile", displayName: "Bank Mercantile", type: "bank" },
  { companyId: "beinleumi", displayName: "First International", type: "bank" },
  { companyId: "massad", displayName: "Bank Massad", type: "bank" },
  { companyId: "yahav", displayName: "Bank Yahav", type: "bank" },
  {
    companyId: "beyahadBishworuk",
    displayName: "Beyond (Beyhad Bishuq)",
    type: "bank",
  },
  { companyId: "oneZero", displayName: "One Zero Bank", type: "bank" },
  { companyId: "union", displayName: "Union Bank", type: "bank" },
  { companyId: "visaCal", displayName: "Visa Cal", type: "credit-card" },
  { companyId: "max", displayName: "Max", type: "credit-card" },
  { companyId: "isracard", displayName: "Isracard", type: "credit-card" },
  { companyId: "amex", displayName: "Amex", type: "credit-card" },
  { companyId: "behatsdaa", displayName: "Behatsdaa", type: "credit-card" },
  { companyId: "external_deposit", displayName: "External Deposit", type: "bank" },
] as const;

type ProviderType = "bank" | "credit-card";

interface AddProviderWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSync?: (options?: { providerId?: number; visible?: boolean }) => void;
}

export function AddProviderWizard({
  open,
  onOpenChange,
  onSync,
}: AddProviderWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<ProviderType | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [alias, setAlias] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [pendingProviderId, setPendingProviderId] = useState<number | null>(null);
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  // External deposit fields
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState("");

  const createProvider = useCreateProvider();
  const updateAuth = useUpdateAuth();

  // Fetch login fields for the selected provider
  const { data: fieldsData, isLoading: fieldsLoading } =
    useProviderFields(selectedCompanyId);
  const loginFields = fieldsData?.loginFields ?? [];

  // Filtered list based on selected type
  const filteredProviders = useMemo(
    () =>
      selectedType
        ? PROVIDER_LIST.filter((p) => p.type === selectedType)
        : [],
    [selectedType]
  );

  // Reset state on close
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        // Reset after animation completes
        setTimeout(() => {
          setStep(1);
          setSelectedType(null);
          setSelectedCompanyId("");
          setCredentials({});
          setAlias("");
          setOtpCode("");
          setPendingProviderId(null);
          setAwaitingOtp(false);
          createProvider.reset();
          updateAuth.reset();
        }, 200);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, createProvider, updateAuth]
  );

  // Navigation
  const canNext = useMemo(() => {
    switch (step) {
      case 1:
        return selectedType !== null;
      case 2:
        return selectedCompanyId !== "";
      case 3:
        // External deposit uses amount field instead of login fields
        if (selectedCompanyId === "external_deposit") {
          return depositAmount.trim() !== "" && !isNaN(Number(depositAmount));
        }
        // All login fields must be filled
        return loginFields.every(
          (f) => credentials[f] && credentials[f].trim() !== ""
        );
      case 4:
        return true;
      case 5:
        return otpCode.trim() !== "";
      default:
        return false;
    }
  }, [step, selectedType, selectedCompanyId, loginFields, credentials, otpCode]);

  const handleNext = useCallback(() => {
    if (step < 4) {
      setStep((s) => s + 1);
    }
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleSubmit = useCallback(async () => {
    if (!selectedCompanyId) return;

    const selectedProvider = PROVIDER_LIST.find(
      (p) => p.companyId === selectedCompanyId
    );

    const bodyCredentials = selectedCompanyId === "external_deposit"
      ? { amount: depositAmount, date: depositDate }
      : credentials;

    createProvider.mutate(
      {
        companyId: selectedCompanyId,
        alias: alias || selectedProvider?.displayName || selectedCompanyId,
        credentials: bodyCredentials,
      },
      {
        onSuccess: (res) => {
          if (res.requiresOtp) {
            setPendingProviderId(res.id);
            setAwaitingOtp(true);
            setOtpCode("");
            updateAuth.reset();
            setStep(5);
            return;
          }

          handleOpenChange(false);
          if (onSync && res.id) {
            onSync({ providerId: res.id });
          }
        },
      }
    );
  }, [
    selectedCompanyId,
    alias,
    credentials,
    createProvider,
    handleOpenChange,
    updateAuth,
  ]);

  const handleOtpSubmit = useCallback(() => {
    if (!pendingProviderId || !otpCode.trim()) return;

    updateAuth.mutate(
      { id: pendingProviderId, otpCode: otpCode.trim(), credentials: credentials },
      {
        onSuccess: () => {
          const providerId = pendingProviderId;
          handleOpenChange(false);
          if (onSync && providerId) {
            onSync({ providerId });
          }
        },
      }
    );
  }, [pendingProviderId, otpCode, updateAuth, handleOpenChange, onSync, credentials]); // Add credentials to dependencies

  // Update a single credential field
  const setCredentialField = useCallback(
    (field: string, value: string) => {
      setCredentials((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Human-readable field name from API field key
  const fieldLabel = useCallback((field: string): string => {
    const labels: Record<string, string> = {
      username: "Username",
      userCode: "User Code",
      password: "Password",
      id: "ID Number",
      num: "Card Number",
      nationalID: "National ID",
      card5Digits: "Last 5 Digits",
      card6Digits: "Last 6 Digits",
      otpCodeReturnRecipient: "OTP Code Return Recipient",
      phoneNumber: "Phone Number",
    };
    return labels[field] || field.charAt(0).toUpperCase() + field.slice(1);
  }, []);

  // Whether a field should be password-masked
  const isPasswordField = useCallback((field: string): boolean => {
    const passwordFields = ["password", "nationalID", "id"];
    return passwordFields.includes(field);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Connection</DialogTitle>
          <DialogDescription>
            {step === 1 && "Choose the type of financial institution."}
            {step === 2 && "Select your bank or credit card provider."}
            {step === 3 && "Enter your login credentials."}
            {step === 4 && "Set an optional alias for this connection."}
            {step === 5 && "Enter the OTP code sent to your phone."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 py-2">
          {Array.from({ length: awaitingOtp ? 5 : 4 }, (_, index) => index + 1).map((s) => (
            <div
              key={s}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                s === step
                  ? "bg-primary"
                  : s < step
                    ? "bg-primary/40"
                    : "bg-muted"
              )}
            />
          ))}
        </div>

        <div className="min-h-[200px]">
          {/* Step 1: Choose type */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-colors",
                  selectedType === "bank"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/50"
                )}
                onClick={() => setSelectedType("bank")}
              >
                <Building2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium">Bank Account</span>
              </button>
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center gap-3 rounded-lg border-2 p-6 transition-colors",
                  selectedType === "credit-card"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/50"
                )}
                onClick={() => setSelectedType("credit-card")}
              >
                <CreditCard className="h-10 w-10 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium">Credit Card</span>
              </button>
            </div>
          )}

          {/* Step 2: Choose provider */}
          {step === 2 && (
            <div className="space-y-4">
              <Select
                value={selectedCompanyId}
                onValueChange={(val) => {
                  setSelectedCompanyId(val);
                  setCredentials({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredProviders.map((p) => (
                    <SelectItem key={p.companyId} value={p.companyId}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 3: Credentials or External Deposit */}
          {step === 3 && (
            <div className="space-y-4">
              {selectedCompanyId === "external_deposit" ? (
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
                    <p className="text-xs text-muted-foreground">
                      Enter the fixed amount to add as an external deposit.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="deposit-date">Date</Label>
                    <Input
                      id="deposit-date"
                      type="date"
                      value={depositDate}
                      onChange={(e) => setDepositDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      The date of the deposit. Leave blank to use today.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Alert className="flex items-start gap-2 border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                    <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p className="text-xs">
                      Credentials are stored securely in your system keychain and
                      are never transmitted to external servers.
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
                        <Label htmlFor={`cred-${field}`}>
                          {fieldLabel(field)}
                        </Label>
                        <Input
                          id={`cred-${field}`}
                          type={isPasswordField(field) ? "password" : "text"}
                          value={credentials[field] || ""}
                          onChange={(e) =>
                            setCredentialField(field, e.target.value)
                          }
                          autoComplete="off"
                        />
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4: Alias */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="provider-alias">
                  Alias (optional)
                </Label>
                <Input
                  id="provider-alias"
                  placeholder={
                    PROVIDER_LIST.find(
                      (p) => p.companyId === selectedCompanyId
                    )?.displayName || "My Bank"
                  }
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  A friendly name to identify this connection. Leave blank to
                  use the default provider name.
                </p>
              </div>

              {createProvider.isError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">
                    {createProvider.error instanceof Error
                      ? createProvider.error.message
                      : "Failed to create provider"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 5: OTP */}
          {step === 5 && (
            <div className="space-y-4">
              <Alert className="flex items-start gap-2 border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p className="text-xs">
                  Enter the OTP code sent to the phone number you provided for One Zero.
                </p>
              </Alert>

              <div className="space-y-1.5">
                <Label htmlFor="provider-otp">OTP Code</Label>
                <Input
                  id="provider-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
              </div>

              {updateAuth.isError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">
                    {updateAuth.error instanceof Error
                      ? updateAuth.error.message
                      : "Failed to verify OTP"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step > 1 && step < 5 && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={createProvider.isPending || updateAuth.isPending}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={handleNext} disabled={!canNext}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : step === 5 ? (
            <Button
              onClick={handleOtpSubmit}
              disabled={!canNext || updateAuth.isPending}
            >
              {updateAuth.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify OTP"
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={createProvider.isPending}
            >
              {createProvider.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Add Connection"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}