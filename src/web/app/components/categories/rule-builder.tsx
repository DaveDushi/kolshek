// Dialog for creating a category rule using sentence-style UI
import { useState, useEffect } from "react";
import { useAddCategoryRule, useCategoryList } from "@/hooks/use-categories";
import { useBalanceReport } from "@/hooks/use-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircleHelp } from "lucide-react";
import type { RuleConditions } from "@/types/api";

interface RuleBuilderProps {
  open: boolean;
  onClose: () => void;
  prefill?: { description?: string };
}

type MatchField = "description" | "memo";
type MatchMode = "substring" | "exact" | "regex";
type Priority = "low" | "normal" | "high";

const PRIORITY_MAP: Record<Priority, number> = {
  low: 0,
  normal: 10,
  high: 100,
};

interface Condition {
  field: MatchField;
  mode: MatchMode;
  pattern: string;
}

export function RuleBuilder({ open, onClose, prefill }: RuleBuilderProps) {
  const { data: categoryList } = useCategoryList();
  const { data: accounts } = useBalanceReport();
  const addRule = useAddCategoryRule();

  // Primary condition
  const [conditions, setConditions] = useState<Condition[]>([
    {
      field: "description",
      mode: "substring",
      pattern: prefill?.description ?? "",
    },
  ]);

  // Sync prefill when dialog opens with new prefill data
  useEffect(() => {
    if (open && prefill?.description) {
      setConditions([{ field: "description", mode: "substring", pattern: prefill.description }]);
    }
  }, [open, prefill?.description]);

  // Additional filters
  const [direction, setDirection] = useState<"" | "debit" | "credit">("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [account, setAccount] = useState("");

  // Target
  const [targetCategory, setTargetCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");

  function updateCondition(index: number, updates: Partial<Condition>) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  }

  function addCondition() {
    setConditions((prev) => [
      ...prev,
      { field: "description", mode: "substring", pattern: "" },
    ]);
  }

  function removeCondition(index: number) {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCreate() {
    const category = newCategory.trim() || targetCategory;
    if (!category) return;

    // Build conditions object
    const conds: RuleConditions = {};

    // Merge text conditions (use first matching field)
    for (const c of conditions) {
      if (c.pattern.trim()) {
        if (c.field === "description") {
          conds.description = { pattern: c.pattern.trim(), mode: c.mode };
        } else {
          conds.memo = { pattern: c.pattern.trim(), mode: c.mode };
        }
      }
    }

    if (direction) {
      conds.direction = direction;
    }

    if (account.trim()) {
      conds.account = account.trim();
    }

    const minVal = amountMin ? Number(amountMin) : undefined;
    const maxVal = amountMax ? Number(amountMax) : undefined;
    if (minVal !== undefined || maxVal !== undefined) {
      conds.amount = {};
      if (minVal !== undefined) conds.amount.min = minVal;
      if (maxVal !== undefined) conds.amount.max = maxVal;
    }

    addRule.mutate(
      {
        category,
        conditions: conds as Record<string, unknown>,
        priority: PRIORITY_MAP[priority],
      },
      {
        onSuccess: () => {
          // Reset form
          setConditions([{ field: "description", mode: "substring", pattern: "" }]);
          setDirection("");
          setAmountMin("");
          setAmountMax("");
          setAccount("");
          setTargetCategory("");
          setNewCategory("");
          setPriority("normal");
          onClose();
        },
      }
    );
  }

  const isValid =
    (newCategory.trim() || targetCategory) &&
    conditions.some((c) => c.pattern.trim());

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Category Rule</DialogTitle>
          <DialogDescription>
            Define conditions to automatically categorize transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sentence-style conditions */}
          {conditions.map((cond, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">
                  {idx === 0 ? "When" : "AND"}
                </span>
                <Select
                  value={cond.field}
                  onValueChange={(v) =>
                    updateCondition(idx, { field: v as MatchField })
                  }
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="description">description</SelectItem>
                    <SelectItem value="memo">memo</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={cond.mode}
                  onValueChange={(v) =>
                    updateCondition(idx, { mode: v as MatchMode })
                  }
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="substring">contains</SelectItem>
                    <SelectItem value="exact">exactly</SelectItem>
                    <SelectItem value="regex">pattern</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={cond.pattern}
                  onChange={(e) =>
                    updateCondition(idx, { pattern: e.target.value })
                  }
                  placeholder="text or pattern"
                  className="flex-1"
                />
                {conditions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(idx)}
                    className="shrink-0 text-muted-foreground"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addCondition}
          >
            + Add condition
          </Button>

          {/* Additional filters */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                Direction
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <CircleHelp className="h-3.5 w-3.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px]">
                      <p>Debit = money out (expenses)</p>
                      <p>Credit = money in (income/refunds)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as "" | "debit" | "credit")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Account</Label>
              <Select
                value={account}
                onValueChange={(v) => setAccount(v === "any" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  {accounts?.map((a) => (
                    <SelectItem key={`${a.providerAlias}-${a.accountNumber}`} value={a.accountNumber}>
                      {a.providerAlias} · {a.accountNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Min Amount</Label>
              <Input
                type="number"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max Amount</Label>
              <Input
                type="number"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="unlimited"
              />
            </div>
          </div>

          {/* Target category */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground shrink-0">categorize as</span>
            <Select value={targetCategory} onValueChange={setTargetCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {(categoryList ?? []).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground">or</span>
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="new category"
              className="flex-1"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              Priority
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CircleHelp className="h-3.5 w-3.5 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px]">
                    Higher priority rules are checked first when multiple rules match
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Priority)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || addRule.isPending}
          >
            {addRule.isPending ? "Creating..." : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
