// Full translations page: untranslated, rules, and already translated
import { useState } from "react";
import { Languages, ChevronDown, ChevronRight } from "lucide-react";
import { useApplyTranslationRules } from "@/hooks/use-translations";
import { PageHeader } from "@/components/shared/page-header";
import { UntranslatedList } from "@/components/translations/untranslated-list";
import { TranslationRules } from "@/components/translations/translation-rules";
import { TranslatedList } from "@/components/translations/translated-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function TranslationsPage() {
  const applyAllRules = useApplyTranslationRules();
  const [translatedOpen, setTranslatedOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Translations"
        description="Translate Hebrew transaction descriptions to English"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyAllRules.mutate()}
          disabled={applyAllRules.isPending}
        >
          <Languages className="h-4 w-4" />
          {applyAllRules.isPending ? "Applying..." : "Apply All Rules"}
        </Button>
      </PageHeader>

      {/* Untranslated section */}
      <Card>
        <CardContent className="pt-6">
          <UntranslatedList />
        </CardContent>
      </Card>

      <Separator />

      {/* Translation rules section */}
      <Card>
        <CardContent className="pt-6">
          <TranslationRules />
        </CardContent>
      </Card>

      <Separator />

      {/* Already translated - collapsible */}
      <Card>
        <CardContent className="pt-6">
          <button
            onClick={() => setTranslatedOpen(!translatedOpen)}
            className="flex w-full items-center gap-2 text-left"
          >
            {translatedOpen ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            <h3 className="text-lg font-semibold">Already Translated</h3>
          </button>
          {translatedOpen && (
            <div className="mt-4">
              <TranslatedList />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
