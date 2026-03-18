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
import {
  BUILTIN,
  classificationColor,
  classificationDot,
  classificationLabel,
} from "@/lib/classification";

const CUSTOM_SENTINEL = "__custom__";

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
