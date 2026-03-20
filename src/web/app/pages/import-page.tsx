// CSV Import page — upload, preview, confirm wizard
import { useState, useCallback, useRef } from "react";
import { Upload, FileUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useImportPreview, useImportConfirm } from "@/hooks/use-import";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CsvImportPreview, CsvImportResult } from "@/types/api";

type Step = "upload" | "preview" | "result";

export function ImportPage() {
  useDocumentTitle("Import");
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preview = useImportPreview();
  const confirm = useImportConfirm();

  const handleFile = useCallback(
    (f: File) => {
      setFile(f);
      preview.mutate(f, {
        onSuccess: () => setStep("preview"),
      });
    },
    [preview]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f && f.name.endsWith(".csv")) handleFile(f);
    },
    [handleFile]
  );

  const handleConfirm = useCallback(
    (skipErrors = false) => {
      if (!file) return;
      confirm.mutate(
        { file, skipErrors },
        { onSuccess: () => setStep("result") }
      );
    },
    [file, confirm]
  );

  const handleReset = useCallback(() => {
    setStep("upload");
    setFile(null);
    preview.reset();
    confirm.reset();
  }, [preview, confirm]);

  return (
    <div className="space-y-5">
      <PageHeader title="Import" description="Import transactions from a CSV file" />

      {step === "upload" && (
        <UploadStep
          onFile={handleFile}
          onDrop={handleDrop}
          fileInputRef={fileInputRef}
          isLoading={preview.isPending}
          error={preview.error?.message}
        />
      )}

      {step === "preview" && preview.data && (
        <PreviewStep
          data={preview.data}
          fileName={file?.name ?? ""}
          onConfirm={handleConfirm}
          onCancel={handleReset}
          isConfirming={confirm.isPending}
        />
      )}

      {step === "result" && confirm.data && (
        <ResultStep data={confirm.data} onReset={handleReset} />
      )}
    </div>
  );
}

// -- Upload Step --

function UploadStep({
  onFile,
  onDrop,
  fileInputRef,
  isLoading,
  error,
}: {
  onFile: (f: File) => void;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isLoading: boolean;
  error?: string;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          onDrop(e);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/40"
        )}
      >
        <Upload className="h-10 w-10 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">
            {isLoading ? "Parsing CSV..." : "Drop a CSV file here, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Required columns: date, description, charged_amount, provider, account_number
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </div>

      {error && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">CSV Format</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            The CSV must have a header row. Required columns:
            <code className="ml-1 px-1 py-0.5 rounded bg-muted text-foreground">date</code>,
            <code className="ml-1 px-1 py-0.5 rounded bg-muted text-foreground">description</code>,
            <code className="ml-1 px-1 py-0.5 rounded bg-muted text-foreground">charged_amount</code>,
            <code className="ml-1 px-1 py-0.5 rounded bg-muted text-foreground">provider</code>,
            <code className="ml-1 px-1 py-0.5 rounded bg-muted text-foreground">account_number</code>
          </p>
          <p>
            Optional columns: charged_currency, original_amount, original_currency, processed_date,
            status, type, memo, category, description_en, identifier, installment_number, installment_total
          </p>
          <p>
            The <code className="px-1 py-0.5 rounded bg-muted text-foreground">kolshek tx export csv</code> output
            is compatible with this format.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// -- Preview Step --

function PreviewStep({
  data,
  fileName,
  onConfirm,
  onCancel,
  isConfirming,
}: {
  data: CsvImportPreview;
  fileName: string;
  onConfirm: (skipErrors?: boolean) => void;
  onCancel: () => void;
  isConfirming: boolean;
}) {
  const hasErrors = data.errors.length > 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total Rows" value={data.totalRows} />
        <SummaryCard label="Valid" value={data.valid} variant="success" />
        <SummaryCard label="Errors" value={data.errors.length} variant={hasErrors ? "error" : undefined} />
        <SummaryCard
          label="Duplicates"
          value={data.preview.filter((r) => r.isDuplicate).length}
        />
      </div>

      {/* Errors */}
      {hasErrors && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Validation Errors ({data.errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-y-auto space-y-1 text-[13px]">
              {data.errors.slice(0, 20).map((err, i) => (
                <p key={i} className="text-destructive">
                  Row {err.row}{err.column ? ` (${err.column})` : ""}: {err.message}
                </p>
              ))}
              {data.errors.length > 20 && (
                <p className="text-muted-foreground">
                  ...and {data.errors.length - 20} more errors
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview table */}
      {data.preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Preview ({data.preview.length} rows)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.preview.map((row, i) => (
                    <TableRow
                      key={i}
                      className={cn(row.isDuplicate && "opacity-50")}
                    >
                      <TableCell className="text-[13px]">{row.date}</TableCell>
                      <TableCell className="text-[13px] max-w-[200px] truncate">
                        {row.description}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-[13px]">
                        {formatCurrency(row.chargedAmount, row.chargedCurrency)}
                      </TableCell>
                      <TableCell className="text-[13px]">{row.provider}</TableCell>
                      <TableCell className="text-[13px]">{row.accountNumber}</TableCell>
                      <TableCell>
                        {row.isDuplicate ? (
                          <Badge variant="secondary" className="text-[10px]">Duplicate</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button onClick={() => onConfirm(false)} disabled={isConfirming || data.valid === 0}>
          {isConfirming ? "Importing..." : `Import ${data.valid} transactions`}
        </Button>
        {hasErrors && data.valid > 0 && (
          <Button variant="outline" onClick={() => onConfirm(true)} disabled={isConfirming}>
            Import valid only (skip errors)
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel} disabled={isConfirming}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// -- Result Step --

function ResultStep({
  data,
  onReset,
}: {
  data: CsvImportResult;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-col items-center text-center gap-3">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold">Import Complete</h3>
          <div className="grid grid-cols-3 gap-6 text-[13px] mt-2">
            <div>
              <p className="text-muted-foreground text-xs">Imported</p>
              <p className="font-semibold text-lg tabular-nums">{data.imported}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Updated</p>
              <p className="font-semibold text-lg tabular-nums">{data.updated}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Duplicates</p>
              <p className="font-semibold text-lg tabular-nums">{data.duplicates}</p>
            </div>
          </div>

          {data.errors.length > 0 && (
            <div className="mt-2 text-left w-full">
              <p className="text-sm font-medium text-destructive mb-1">
                {data.errors.length} error(s):
              </p>
              <div className="max-h-32 overflow-y-auto text-xs text-destructive space-y-0.5">
                {data.errors.map((err, i) => (
                  <p key={i}>Row {err.row}: {err.message}</p>
                ))}
              </div>
            </div>
          )}

          <Button onClick={onReset} className="mt-4">
            Import Another File
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// -- Summary card helper --

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "success" | "error";
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            variant === "success" && "text-green-600 dark:text-green-400",
            variant === "error" && value > 0 && "text-destructive"
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
