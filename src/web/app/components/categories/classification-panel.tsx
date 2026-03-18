// Classification management for the active category
import { useState, useRef, useEffect } from "react";
import { useClassificationMap, useSetClassification } from "@/hooks/use-categories";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuiltinClassification } from "@/types/api";

const BUILTIN: { value: BuiltinClassification; label: string; color: string }[] = [
  { value: "expense", label: "Expense", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "income", label: "Income", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { value: "cc_billing", label: "CC Billing", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  { value: "transfer", label: "Transfer", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "investment", label: "Investment", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { value: "debt", label: "Debt", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { value: "savings", label: "Savings", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
];

const CUSTOM_SENTINEL = "__custom__";

// Extra color palette for custom classifications — deterministic by name hash
const CUSTOM_COLORS: { bg: string; text: string; dot: string }[] = [
  { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500" },
  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  { bg: "bg-lime-100 dark:bg-lime-900/30", text: "text-lime-700 dark:text-lime-400", dot: "bg-lime-500" },
  { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-700 dark:text-teal-400", dot: "bg-teal-500" },
  { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-400", dot: "bg-sky-500" },
  { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  { bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30", text: "text-fuchsia-700 dark:text-fuchsia-400", dot: "bg-fuchsia-500" },
  { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-400", dot: "bg-pink-500" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-400", dot: "bg-indigo-500" },
  { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function customColor(name: string): { bg: string; text: string; dot: string } {
  return CUSTOM_COLORS[hashString(name) % CUSTOM_COLORS.length];
}

export function classificationColor(classification: string): string {
  const builtin = BUILTIN.find((b) => b.value === classification);
  if (builtin) return builtin.color;
  const c = customColor(classification);
  return `${c.bg} ${c.text}`;
}

export function classificationDot(classification: string): string {
  const builtin = BUILTIN.find((b) => b.value === classification);
  if (builtin) return builtin.color.split(" ")[0];
  return customColor(classification).dot;
}

export function classificationLabel(classification: string): string {
  return BUILTIN.find((b) => b.value === classification)?.label ?? classification;
}

// Validate: lowercase alphanumeric + underscores, starts with letter
function isValidName(v: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(v) && v.length <= 50;
}

interface ClassificationPanelProps {
  category: string;
}

export function ClassificationPanel({ category }: ClassificationPanelProps) {
  const { data: classMap } = useClassificationMap();
  const setClassification = useSetClassification();
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const current = classMap?.[category] ?? "expense";

  // Collect any custom classifications already in use (not in BUILTIN)
  const builtinValues = new Set(BUILTIN.map((b) => b.value));
  const customValues = classMap
    ? [...new Set(Object.values(classMap))].filter((v) => !builtinValues.has(v)).sort()
    : [];

  useEffect(() => {
    if (customMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [customMode]);

  // Reset custom mode when category changes
  useEffect(() => {
    setCustomMode(false);
    setCustomName("");
  }, [category]);

  function handleChange(value: string) {
    if (value === CUSTOM_SENTINEL) {
      setCustomMode(true);
      return;
    }
    if (value === current) return;
    setClassification.mutate({ name: category, classification: value });
  }

  function handleCustomSubmit() {
    const trimmed = customName.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed || !isValidName(trimmed)) return;
    setClassification.mutate(
      { name: category, classification: trimmed },
      { onSuccess: () => { setCustomMode(false); setCustomName(""); } }
    );
  }

  if (customMode) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-muted-foreground shrink-0">Classification</span>
        <Input
          ref={inputRef}
          value={customName}
          onChange={(e) => setCustomName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          placeholder="e.g. charity"
          className="h-8 w-[140px] text-[13px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCustomSubmit();
            if (e.key === "Escape") { setCustomMode(false); setCustomName(""); }
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={!customName.trim() || !isValidName(customName.trim()) || setClassification.isPending}
          onClick={handleCustomSubmit}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-[13px] text-muted-foreground shrink-0">Classification</span>
      <Select value={current} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-[160px] text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BUILTIN.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              <span className="flex items-center gap-2">
                <span className={cn("inline-block h-2 w-2 rounded-full", classificationDot(item.value))} />
                {item.label}
              </span>
            </SelectItem>
          ))}
          {customValues.length > 0 && (
            <>
              <SelectSeparator />
              {customValues.map((v) => (
                <SelectItem key={v} value={v}>
                  <span className="flex items-center gap-2">
                    <span className={cn("inline-block h-2 w-2 rounded-full", classificationDot(v))} />
                    {classificationLabel(v)}
                  </span>
                </SelectItem>
              ))}
            </>
          )}
          <SelectSeparator />
          <SelectItem value={CUSTOM_SENTINEL}>
            <span className="flex items-center gap-2 text-muted-foreground">
              <Plus className="h-3 w-3" />
              Custom...
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      {setClassification.isPending && (
        <span className="text-xs text-muted-foreground">Saving...</span>
      )}
    </div>
  );
}

// Small badge to show classification in the sidebar
export function ClassificationBadge({ classification }: { classification: string }) {
  const colors = classificationColor(classification);
  const label = classificationLabel(classification);
  return (
    <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-4 font-normal", colors)}>
      {label}
    </Badge>
  );
}
