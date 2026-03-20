// Side-by-side duplicate transaction comparison card
import type { DuplicateCandidateApi } from "@/types/api";
import { formatDate, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DuplicatePairCardProps {
  candidate: DuplicateCandidateApi;
  onKeepLeft: () => void;
  onKeepRight: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

function scoreBadgeVariant(score: number) {
  if (score >= 0.8) return "destructive" as const;
  if (score >= 0.6) return "secondary" as const;
  return "outline" as const;
}

function scoreLabel(score: number) {
  if (score >= 0.8) return "High match";
  if (score >= 0.6) return "Moderate";
  return "Low";
}

function TxColumn({ tx, side }: { tx: DuplicateCandidateApi["txA"]; side: "A" | "B" }) {
  return (
    <div className="flex-1 min-w-0 space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
        Transaction {side}
      </p>
      <div className="space-y-1.5 text-[13px]">
        <div>
          <span className="text-muted-foreground text-xs">Date</span>
          <p className="font-medium">{formatDate(tx.date)}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Amount</span>
          <p className="font-medium tabular-nums">
            {formatCurrency(tx.chargedAmount, tx.chargedCurrency ?? "ILS")}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Description</span>
          <p className="font-medium truncate" title={tx.description}>
            {tx.descriptionEn || tx.description}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Account</span>
          <p className="font-medium text-xs">
            {tx.providerAlias} &middot; {tx.accountNumber}
          </p>
        </div>
        {tx.category && (
          <div>
            <span className="text-muted-foreground text-xs">Category</span>
            <p className="font-medium text-xs">{tx.category}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function DuplicatePairCard({
  candidate,
  onKeepLeft,
  onKeepRight,
  onDismiss,
  isLoading,
}: DuplicatePairCardProps) {
  const { txA, txB, score, amountDiff, dateDiffDays } = candidate;

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        {/* Score + diff badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={scoreBadgeVariant(score)}>
            {scoreLabel(score)} &middot; {(score * 100).toFixed(0)}%
          </Badge>
          {amountDiff > 0 && (
            <Badge variant="outline" className="text-xs">
              {formatCurrency(amountDiff)} diff
            </Badge>
          )}
          {dateDiffDays > 0 && (
            <Badge variant="outline" className="text-xs">
              {dateDiffDays}d apart
            </Badge>
          )}
          {candidate.sameAccount && (
            <Badge variant="outline" className="text-xs">
              Same account
            </Badge>
          )}
        </div>

        {/* Side-by-side comparison */}
        <div className="flex gap-4">
          <TxColumn tx={txA} side="A" />
          <div className="w-px bg-border shrink-0" />
          <TxColumn tx={txB} side="B" />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="default"
            onClick={onKeepLeft}
            disabled={isLoading}
            className="flex-1"
          >
            Keep A
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={onKeepRight}
            disabled={isLoading}
            className="flex-1"
          >
            Keep B
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDismiss}
            disabled={isLoading}
            className="flex-1"
          >
            Not a Duplicate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
