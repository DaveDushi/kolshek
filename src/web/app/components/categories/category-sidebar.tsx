// Left sidebar listing all categories with counts and create button
import { useState } from "react";
import { Plus } from "lucide-react";
import type { CategorySummary } from "@/types/api";
import { useCreateCategory } from "@/hooks/use-categories";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CategorySidebarProps {
  categories: CategorySummary[];
  activeCategory: string | null;
  onSelect: (cat: string) => void;
}

export function CategorySidebar({
  categories,
  activeCategory,
  onSelect,
}: CategorySidebarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const createCategory = useCreateCategory();

  function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createCategory.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setNewName("");
          setDialogOpen(false);
        },
      }
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.category;
            const isUncategorized = cat.category === "Uncategorized";

            return (
              <button
                key={cat.category}
                onClick={() => onSelect(cat.category)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground font-medium"
                )}
              >
                <span className="truncate">{cat.category}</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-2 tabular-nums",
                    isUncategorized &&
                      cat.transactionCount > 0 &&
                      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                  )}
                >
                  {cat.transactionCount}
                </Badge>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Category
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>Enter a name for the new category.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || createCategory.isPending}
            >
              {createCategory.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
