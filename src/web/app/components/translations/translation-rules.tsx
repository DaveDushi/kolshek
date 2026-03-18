// Table of translation rules with add and delete actions
import { useState } from "react";
import { Trash2, Plus, Play, BookOpen } from "lucide-react";
import {
  useTranslationRules,
  useAddTranslationRule,
  useRemoveTranslationRule,
  useApplyTranslationRules,
} from "@/hooks/use-translations";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function TranslationRules() {
  const { data: rules, isLoading } = useTranslationRules();
  const addRule = useAddTranslationRule();
  const removeRule = useRemoveTranslationRule();
  const applyRules = useApplyTranslationRules();

  // Inline add form state
  const [showForm, setShowForm] = useState(false);
  const [hebrewPattern, setHebrewPattern] = useState("");
  const [englishName, setEnglishName] = useState("");

  function handleAdd() {
    const hebrew = hebrewPattern.trim();
    const english = englishName.trim();
    if (!hebrew || !english) return;

    addRule.mutate(
      { matchPattern: hebrew, englishName: english },
      {
        onSuccess: () => {
          setHebrewPattern("");
          setEnglishName("");
          setShowForm(false);
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Translation Rules</h3>
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
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="rounded-md border bg-muted/50 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Hebrew Pattern
              </Label>
              <Input
                value={hebrewPattern}
                onChange={(e) => setHebrewPattern(e.target.value)}
                placeholder="Hebrew text"
                dir="rtl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                English Name
              </Label>
              <Input
                value={englishName}
                onChange={(e) => setEnglishName(e.target.value)}
                placeholder="English translation"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={
                !hebrewPattern.trim() ||
                !englishName.trim() ||
                addRule.isPending
              }
            >
              {addRule.isPending ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>
      )}

      {(!rules || rules.length === 0) && (
        <EmptyState
          icon={<BookOpen />}
          title="No translation rules"
          description="Create rules to automatically translate Hebrew descriptions."
        />
      )}

      {rules && rules.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hebrew Pattern</TableHead>
              <TableHead>English Name</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell dir="rtl" className="font-medium text-right">
                  {rule.matchPattern}
                </TableCell>
                <TableCell>{rule.englishName}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRule.mutate(rule.id)}
                    disabled={removeRule.isPending}
                    aria-label={`Delete rule for ${rule.englishName}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
