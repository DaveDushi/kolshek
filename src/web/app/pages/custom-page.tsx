// Custom page view -- renders a user-defined dashboard page by its ID
import { useParams } from "react-router";
import { FileQuestion } from "lucide-react";
import { useCustomPage } from "@/hooks/use-custom-pages";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CustomPageRenderer } from "@/components/custom-page/custom-page-renderer";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const { data: page, isLoading, isError, error } = useCustomPage(pageId ?? "");

  useDocumentTitle(page?.title ?? "Custom Page");

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <Skeleton className="h-7 w-48 rounded" />
          <Skeleton className="h-4 w-72 rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Error" />
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load page:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  // Not found
  if (!page) {
    return (
      <div className="space-y-6">
        <PageHeader title="Page Not Found" />
        <EmptyState
          icon={<FileQuestion />}
          title="Page not found"
          description="The custom page you're looking for doesn't exist or has been deleted."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={page.title}
        description={page.description ?? undefined}
      />
      <CustomPageRenderer pageId={page.id} definition={page.definition} />
    </div>
  );
}
