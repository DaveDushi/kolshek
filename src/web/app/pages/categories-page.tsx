// Full categories management page with sidebar + main panel
import { useState } from "react";
import { useSearchParams } from "react-router";
import { Tags, Plus } from "lucide-react";
import {
  useCategorySummary,
  useApplyCategoryRules,
  useClassificationMap,
} from "@/hooks/use-categories";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CategorySidebar } from "@/components/categories/category-sidebar";
import { TriageInbox } from "@/components/categories/triage-inbox";
import { RulesTable } from "@/components/categories/rules-table";
import { RuleBuilder } from "@/components/categories/rule-builder";
import { ClassificationPanel } from "@/components/categories/classification-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function CategoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("cat");
  const [ruleBuilderOpen, setRuleBuilderOpen] = useState(false);

  const { data: categories, isLoading } = useCategorySummary();
  const { data: classificationMap } = useClassificationMap();
  const applyRules = useApplyCategoryRules();

  function handleSelectCategory(cat: string) {
    setSearchParams({ cat });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Categories" description="Organize and categorize your transactions">
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyRules.mutate()}
          disabled={applyRules.isPending}
        >
          {applyRules.isPending ? "Applying..." : "Apply Rules"}
        </Button>
      </PageHeader>

      {isLoading && (
        <div className="flex gap-6">
          <Skeleton className="h-[500px] w-[250px] shrink-0" />
          <Skeleton className="h-[500px] flex-1" />
        </div>
      )}

      {!isLoading && (!categories || categories.length === 0) && (
        <EmptyState
          icon={<Tags />}
          title="No categories yet"
          description="Categories will appear once transactions are categorized."
        />
      )}

      {!isLoading && categories && categories.length > 0 && (
        <div className="flex gap-6">
          {/* Sidebar */}
          <Card className="w-[250px] shrink-0 overflow-hidden">
            <CategorySidebar
              categories={categories}
              activeCategory={activeCategory}
              onSelect={handleSelectCategory}
              classificationMap={classificationMap}
            />
          </Card>

          {/* Main panel */}
          <div className="flex-1 space-y-8">
            {/* Category detail when selected */}
            {activeCategory ? (
              <>
                <Card className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{activeCategory}</h3>
                    <ClassificationPanel category={activeCategory} />
                  </div>
                </Card>
                <Card className="p-6">
                  <TriageInbox category={activeCategory} />
                </Card>
              </>
            ) : (
              <EmptyState
                icon={<Tags />}
                title="Select a category"
                description="Choose a category from the sidebar to view and re-categorize its transactions."
              />
            )}

            <Separator />

            {/* Rules section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div />
                <Button
                  size="sm"
                  onClick={() => setRuleBuilderOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Rule
                </Button>
              </div>
              <RulesTable />
            </div>
          </div>
        </div>
      )}

      <RuleBuilder
        open={ruleBuilderOpen}
        onClose={() => setRuleBuilderOpen(false)}
      />
    </div>
  );
}
