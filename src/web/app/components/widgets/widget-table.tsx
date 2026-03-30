// Widget: table -- data table with configurable columns and formatting
import { formatCurrency, formatDate, formatFullDate } from "@/lib/format";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { WidgetProps } from "./widget-registry.js";

// Column definition from the widget config
interface ColumnDef {
  key: string;
  label: string;
  format?: "currency" | "date" | "fullDate" | "number" | "percent";
  align?: "left" | "center" | "right";
  currency?: string;
}

// Format a cell value based on column format
function formatCell(value: unknown, column: ColumnDef): string {
  if (value == null) return "--";

  switch (column.format) {
    case "currency":
      return formatCurrency(Number(value), column.currency || "ILS");
    case "date":
      return formatDate(String(value));
    case "fullDate":
      return formatFullDate(String(value));
    case "number":
      return typeof value === "number"
        ? value.toLocaleString()
        : String(value);
    case "percent":
      return `${Number(value).toFixed(1)}%`;
    default:
      return String(value);
  }
}

// Resolve nested value with dot notation
function resolveKey(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex gap-4">
            {Array.from({ length: columns }, (_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
          {Array.from({ length: 5 }, (_, row) => (
            <div key={row} className="flex gap-4">
              {Array.from({ length: columns }, (_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function WidgetTable({ config, data }: WidgetProps) {
  const title = config.title as string | undefined;
  const columns = (config.columns as ColumnDef[]) || [];

  // Loading state
  if (data === undefined) {
    return <TableSkeleton columns={Math.max(columns.length, 3)} />;
  }

  const rows = Array.isArray(data) ? data : [];

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No data available.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : undefined
                    }
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: Record<string, unknown>, rowIndex: number) => (
                <TableRow key={rowIndex}>
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={
                        col.align === "right"
                          ? "text-right tabular-nums"
                          : col.align === "center"
                            ? "text-center"
                            : col.format === "currency" || col.format === "number" || col.format === "percent"
                              ? "tabular-nums"
                              : undefined
                      }
                    >
                      {formatCell(resolveKey(row, col.key), col)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
