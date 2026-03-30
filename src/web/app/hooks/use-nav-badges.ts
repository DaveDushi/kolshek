// Shared hook for computing navigation badge counts.
// Used by both Sidebar (desktop) and MobileNav (mobile).
import { useInsights } from "./use-insights";
import { useCategorySummary } from "./use-categories";
import { useUntranslated } from "./use-translations";

export function useNavBadges() {
  const { data: insights } = useInsights();
  const { data: categories } = useCategorySummary();
  const { data: untranslated } = useUntranslated();

  const alertCount = insights?.filter((i) => i.severity === "alert").length ?? 0;

  const uncategorizedCount =
    categories?.find((c) => c.category === "" || c.category === "uncategorized")
      ?.count ?? 0;

  const untranslatedCount = untranslated?.length ?? 0;

  return { alertCount, uncategorizedCount, untranslatedCount };
}
