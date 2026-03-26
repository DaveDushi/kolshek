// Grid of provider cards showing connection status, last sync, and actions
import { useState, useCallback } from "react";
import {
  Building2,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  KeyRound,
  Trash2,
  MoreVertical,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToggleAccountExclusion } from "@/hooks/use-accounts";
import type { ProviderCard as ProviderCardType, ProviderAccount } from "@/types/api";

// Mask account number to show only last 4 digits
function maskAccountNumber(num: string): string {
  if (num.length <= 4) return num;
  return "****" + num.slice(-4);
}

interface ProviderGridProps {
  providers: ProviderCardType[];
  onSync: (options?: { providerId?: number; visible?: boolean }) => void;
  onDelete: (id: number) => void;
  onAuth: (id: number) => void;
}

// Confirmation dialog for provider deletion
function DeleteConfirmDialog({
  provider,
  open,
  onOpenChange,
  onConfirm,
}: {
  provider: ProviderCardType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Provider</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">
              {provider?.displayName}
            </span>
            ? This will remove the provider and all its stored credentials.
            Transaction data will be preserved.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Account row with exclusion toggle
function AccountRow({ account }: { account: ProviderAccount }) {
  const toggleExclusion = useToggleAccountExclusion();

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-[13px]",
        account.excluded && "opacity-50"
      )}
    >
      <span className="truncate text-muted-foreground">
        {maskAccountNumber(account.accountNumber)}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {account.balance != null && (
          <span className={cn("text-xs tabular-nums", account.excluded && "line-through")}>
            {account.balance.toLocaleString("en-IL", {
              style: "currency",
              currency: account.currency || "ILS",
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </span>
        )}
        <button
          type="button"
          onClick={() =>
            toggleExclusion.mutate({
              accountId: account.id,
              excluded: !account.excluded,
            })
          }
          className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground transition-colors"
          title={account.excluded ? "Include in syncing" : "Exclude from syncing"}
        >
          {account.excluded ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// Single provider card
function ProviderCardItem({
  provider,
  onAuth,
  onDeleteRequest,
  onSync,
}: {
  provider: ProviderCardType;
  onAuth: (id: number) => void;
  onDeleteRequest: (provider: ProviderCardType) => void;
  onSync: (options?: { providerId?: number; visible?: boolean }) => void;
}) {
  const Icon = provider.type === "bank" ? Building2 : CreditCard;
  const authStatus = provider.authStatus ?? (provider.hasCredentials ? "pending" : "no");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                provider.type === "bank"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">
                {provider.displayName}
              </CardTitle>
              {provider.alias && provider.alias !== provider.displayName && (
                <CardDescription>{provider.alias}</CardDescription>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Actions for ${provider.displayName}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onSync({ providerId: provider.id })}
                disabled={!provider.hasCredentials}
              >
                <RefreshCw className="h-4 w-4" />
                Sync
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSync({ providerId: provider.id, visible: true })}
                disabled={!provider.hasCredentials}
              >
                <Eye className="h-4 w-4" />
                Sync (visible)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onAuth(provider.id)}>
                <KeyRound className="h-4 w-4" />
                Update Auth
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteRequest(provider)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Auth status */}
        <div className="flex items-center gap-2 text-sm">
          {authStatus === "connected" && (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Connected</span>
            </>
          )}
          {authStatus === "pending" && (
            <>
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-yellow-600 dark:text-yellow-400">Pending</span>
            </>
          )}
          {authStatus === "expired" && (
            <>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-orange-600 dark:text-orange-400">Expired</span>
            </>
          )}
          {authStatus === "no" && (
            <>
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-destructive">No credentials</span>
            </>
          )}
        </div>

        {/* Accounts list with exclusion toggles */}
        {provider.accounts.length > 0 ? (
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Accounts</p>
            {provider.accounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Accounts</p>
              <p className="font-medium">0</p>
            </div>
            <div>
              <p className="text-muted-foreground">Transactions</p>
              <p className="font-medium">
                {provider.transactionCount.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Transaction count (when accounts exist) */}
        {provider.accounts.length > 0 && (
          <div className="text-sm">
            <span className="text-muted-foreground">
              {provider.transactionCount.toLocaleString()} transactions
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        {provider.lastSyncedAt ? (
          <span>Last synced {formatRelativeTime(provider.lastSyncedAt)}</span>
        ) : (
          <span>Never synced</span>
        )}
      </CardFooter>
    </Card>
  );
}

export function ProviderGrid({
  providers,
  onSync,
  onDelete,
  onAuth,
}: ProviderGridProps) {
  const [deleteTarget, setDeleteTarget] = useState<ProviderCardType | null>(
    null
  );

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, onDelete]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => (
          <ProviderCardItem
            key={provider.id}
            provider={provider}
            onAuth={onAuth}
            onDeleteRequest={setDeleteTarget}
            onSync={onSync}
          />
        ))}
      </div>

      <DeleteConfirmDialog
        provider={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
