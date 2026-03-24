// Searchable list of already-translated descriptions with edit capability
import { useState, useCallback } from "react";
import { Search, Pencil, Check, X, BookCheck } from "lucide-react";
import { useTranslated, useTranslate } from "@/hooks/use-translations";
import { EmptyState } from "@/components/shared/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_PAGE_SIZE = 50;

export function TranslatedList() {
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // Debounced search value sent to API
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useTranslated({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    search: debouncedSearch || undefined,
  });
  const translate = useTranslate();

  const groups = data?.groups ?? [];
  const total = data?.total ?? 0;

  const [editingDesc, setEditingDesc] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    setDebounceTimer(timer);
  }

  function startEdit(description: string, currentEnglish: string) {
    setEditingDesc(description);
    setEditValue(currentEnglish);
  }

  function cancelEdit() {
    setEditingDesc(null);
    setEditValue("");
  }

  function saveEdit(description: string) {
    const english = editValue.trim();
    if (!english) return;
    translate.mutate(
      { hebrew: description, english },
      {
        onSuccess: () => cancelEdit(),
      }
    );
  }

  const handlePageChange = useCallback((p: number) => setPage(p), []);
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  if (isLoading && !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!debouncedSearch && total === 0) {
    return (
      <EmptyState
        icon={<BookCheck />}
        title="No translations yet"
        description="Translations will appear here after you translate descriptions."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Translated Descriptions</h3>
        <Badge variant="secondary">{total} total</Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search translations..."
          className="pl-9"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hebrew</TableHead>
            <TableHead>English</TableHead>
            <TableHead className="text-right w-16">Count</TableHead>
            <TableHead className="w-20">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <TableRow key={group.description}>
              <TableCell dir="rtl" className="font-medium text-right">
                {group.description}
              </TableCell>
              <TableCell>
                {editingDesc === group.description ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(group.description);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="h-8"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => saveEdit(group.description)}
                      disabled={!editValue.trim() || translate.isPending}
                      aria-label="Save"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={cancelEdit}
                      aria-label="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  group.descriptionEn
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {group.count}
              </TableCell>
              <TableCell>
                {editingDesc !== group.description && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      startEdit(group.description, group.descriptionEn)
                    }
                    aria-label={`Edit translation for ${group.descriptionEn}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {groups.length === 0 && debouncedSearch && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No translations match &quot;{debouncedSearch}&quot;
        </p>
      )}

      <Pagination
        total={total}
        pageSize={pageSize}
        currentPage={page}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
}
