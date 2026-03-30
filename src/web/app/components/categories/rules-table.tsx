// Table displaying all category rules with delete and apply actions
import {
  useCategoryRules,
  useRemoveCategoryRule,
  useApplyCategoryRules,
} from "@/hooks/use-categories";
import { CategoryBadge } from "@/components/shared/category-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Play, Plus, BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CategoryRule, RuleConditions } from "@/types/api";

// Convert rule conditions to a human-readable string
function describeConditions(conditions: RuleConditions): string {
  const parts: string[] = [];

  if (conditions.description) {
    const { mode, pattern } = conditions.description;
    const modeLabel = mode === "substring" ? "contains" : mode === "exact" ? "equals" : "matches";
    parts.push(`description ${modeLabel} "${pattern}"`);
  }

  if (conditions.memo) {
    const { mode, pattern } = conditions.memo;
    const modeLabel = mode === "substring" ? "contains" : mode === "exact" ? "equals" : "matches";
    parts.push(`memo ${modeLabel} "${pattern}"`);
  }

  if (conditions.direction) {
    parts.push(`direction is ${conditions.direction}`);
  }

  if (conditions.account) {
    parts.push(`account is ${conditions.account}`);
  }

  if (conditions.amount) {
    const { min, max, value } = conditions.amount;
    if (value !== undefined) {
      parts.push(`amount = ${value}`);
    } else if (min !== undefined && max !== undefined) {
      parts.push(`amount ${min}-${max}`);
    } else if (min !== undefined) {
      parts.push(`amount >= ${min}`);
    } else if (max !== undefined) {
      parts.push(`amount <= ${max}`);
    }
  }

  return parts.join(" AND ") || "No conditions";
}

export function RulesTable({ onAddRule }: { onAddRule?: () => void }) {
  const { data: rules, isLoading } = useCategoryRules();
  const removeRule = useRemoveCategoryRule();
  const applyRules = useApplyCategoryRules();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen />}
        title="No rules"
        description="Create category rules to automatically organize transactions."
        action={onAddRule ? { label: "Add Rule", onClick: onAddRule } : undefined}
      />
    );
  }

  // Sort by priority descending
  const sorted = rules.toSorted((a, b) => b.priority - a.priority);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Category Rules</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyRules.mutate()}
            disabled={applyRules.isPending}
          >
            <Play className="h-4 w-4" />
            {applyRules.isPending ? "Applying..." : "Apply Rules"}
          </Button>
          {onAddRule && (
            <Button size="sm" onClick={onAddRule}>
              <Plus className="h-4 w-4" />
              Add Rule
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Priority</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Conditions</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="tabular-nums font-medium">
                  {rule.priority}
                </TableCell>
                <TableCell>
                  <CategoryBadge category={rule.category} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {describeConditions(rule.conditions)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRule.mutate(rule.id)}
                    disabled={removeRule.isPending}
                    aria-label={`Delete rule for ${rule.category}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
