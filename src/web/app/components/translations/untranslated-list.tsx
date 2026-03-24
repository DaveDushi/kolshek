// List of untranslated Hebrew description groups with inline translation input
import { useState, useCallback } from "react";
import { Languages } from "lucide-react";
import {
  useUntranslated,
  useTranslate,
} from "@/hooks/use-translations";
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

const DEFAULT_PAGE_SIZE = 25;

// Per-row state for the translation input
interface RowState {
  englishName: string;
  createRule: boolean;
}

export function UntranslatedList() {
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useUntranslated({
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  const translate = useTranslate();

  const groups = data?.groups ?? [];
  const total = data?.total ?? 0;

  // Track input state per description
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const getRowState = useCallback(
    (desc: string): RowState =>
      rowStates[desc] ?? { englishName: "", createRule: false },
    [rowStates]
  );

  function updateRow(desc: string, updates: Partial<RowState>) {
    setRowStates((prev) => ({
      ...prev,
      [desc]: { ...getRowState(desc), ...updates },
    }));
  }

  function handleSave(description: string) {
    const state = getRowState(description);
    const english = state.englishName.trim();
    if (!english) return;

    translate.mutate(
      { hebrew: description, english, createRule: state.createRule },
      {
        onSuccess: () => {
          // Clear the row state
          setRowStates((prev) => {
            const next = { ...prev };
            delete next[description];
            return next;
          });
        },
      }
    );
  }

  const handlePageChange = useCallback((p: number) => setPage(p), []);
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <EmptyState
        icon={<Languages />}
        title="All translated"
        description="All transaction descriptions have English translations."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Untranslated Descriptions</h3>
        <Badge variant="secondary">{total} remaining</Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hebrew Description</TableHead>
            <TableHead className="text-right w-16">Count</TableHead>
            <TableHead>English Name</TableHead>
            <TableHead className="w-24">Rule</TableHead>
            <TableHead className="w-20">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const state = getRowState(group.description);
            return (
              <TableRow key={group.description}>
                <TableCell dir="rtl" className="font-medium text-right">
                  {group.description}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {group.count}
                </TableCell>
                <TableCell>
                  <Input
                    value={state.englishName}
                    onChange={(e) =>
                      updateRow(group.description, {
                        englishName: e.target.value,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave(group.description);
                    }}
                    placeholder="English name"
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.createRule}
                      onChange={(e) =>
                        updateRow(group.description, {
                          createRule: e.target.checked,
                        })
                      }
                      className="h-3.5 w-3.5 rounded border-input"
                    />
                    <span className="text-xs text-muted-foreground">Auto</span>
                  </label>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSave(group.description)}
                    disabled={
                      !state.englishName.trim() || translate.isPending
                    }
                  >
                    Save
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

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
