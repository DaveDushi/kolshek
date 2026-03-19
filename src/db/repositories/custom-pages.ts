// CRUD operations for custom dashboard pages.

import { getDatabase } from "../database.js";

export interface CustomPageMeta {
  id: string;
  title: string;
  icon: string;
  description: string | null;
  sortOrder: number;
}

export interface CustomPageFull extends CustomPageMeta {
  definition: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface CustomPageRow {
  id: string;
  title: string;
  icon: string;
  description: string | null;
  definition: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function rowToMeta(row: CustomPageRow): CustomPageMeta {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

function rowToFull(row: CustomPageRow): CustomPageFull {
  return {
    ...rowToMeta(row),
    definition: JSON.parse(row.definition),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreatePageInput {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  definition: Record<string, unknown>;
}

export interface UpdatePageInput {
  title?: string;
  icon?: string;
  description?: string | null;
  definition?: Record<string, unknown>;
}

// List all pages (metadata only, for sidebar)
export function listCustomPages(): CustomPageMeta[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      "SELECT id, title, icon, description, definition, sort_order, created_at, updated_at FROM custom_pages ORDER BY sort_order, created_at",
    )
    .all() as CustomPageRow[];
  return rows.map(rowToMeta);
}

// Get a single page with full definition
export function getCustomPage(id: string): CustomPageFull | null {
  const db = getDatabase();
  const row = db
    .prepare(
      "SELECT id, title, icon, description, definition, sort_order, created_at, updated_at FROM custom_pages WHERE id = $id",
    )
    .get({ $id: id }) as CustomPageRow | null;
  return row ? rowToFull(row) : null;
}

// Create a new page
export function createCustomPage(input: CreatePageInput): CustomPageFull {
  const db = getDatabase();

  // Set sort_order to max + 1
  const maxRow = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM custom_pages")
    .get() as { max_order: number };

  db.prepare(
    `INSERT INTO custom_pages (id, title, icon, description, definition, sort_order)
     VALUES ($id, $title, $icon, $description, $definition, $sortOrder)`,
  ).run({
    $id: input.id,
    $title: input.title,
    $icon: input.icon ?? "file-text",
    $description: input.description ?? null,
    $definition: JSON.stringify(input.definition),
    $sortOrder: maxRow.max_order + 1,
  });

  return getCustomPage(input.id)!;
}

// Update an existing page
export function updateCustomPage(
  id: string,
  updates: UpdatePageInput,
): CustomPageFull | null {
  const db = getDatabase();
  const existing = getCustomPage(id);
  if (!existing) return null;

  const sets: string[] = ["updated_at = datetime('now')"];
  const params: Record<string, string | number | null> = { $id: id };

  if (updates.title !== undefined) {
    sets.push("title = $title");
    params.$title = updates.title;
  }
  if (updates.icon !== undefined) {
    sets.push("icon = $icon");
    params.$icon = updates.icon;
  }
  if (updates.description !== undefined) {
    sets.push("description = $description");
    params.$description = updates.description;
  }
  if (updates.definition !== undefined) {
    sets.push("definition = $definition");
    params.$definition = JSON.stringify(updates.definition);
  }

  db.prepare(`UPDATE custom_pages SET ${sets.join(", ")} WHERE id = $id`).run(params);
  return getCustomPage(id);
}

// Delete a page
export function deleteCustomPage(id: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare("DELETE FROM custom_pages WHERE id = $id")
    .run({ $id: id });
  return result.changes > 0;
}

// Reorder pages by providing ordered id array
export function reorderCustomPages(ids: string[]): void {
  const db = getDatabase();
  const stmt = db.prepare(
    "UPDATE custom_pages SET sort_order = $order, updated_at = datetime('now') WHERE id = $id",
  );
  for (let i = 0; i < ids.length; i++) {
    stmt.run({ $id: ids[i], $order: i });
  }
}
