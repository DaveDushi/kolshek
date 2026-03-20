// kolshek reconcile — Detect fuzzy duplicates and check account balances.

import type { Command } from "commander";
import { subDays, formatISO } from "date-fns";
import { computeFuzzyScore, rankDuplicates } from "../../core/reconcile.js";
import {
  findFuzzyDuplicateCandidates,
  recordReconciliationDecision,
  mergeDuplicate,
  listReconciliationDecisions,
  computeAccountBalance,
} from "../../db/repositories/reconciliation.js";
import { getBalanceReport } from "../../db/repositories/reports.js";
import { getDatabase } from "../../db/database.js";
import type {
  FuzzyMatchConfig,
  DuplicateCandidate,
  ReconciliationDecision,
} from "../../types/index.js";
import {
  isJsonMode,
  printJson,
  jsonSuccess,
  printError,
  info,
  createTable,
  formatCurrency,
  formatDate,
  ExitCode,
  isInteractive,
} from "../output.js";
import { parseDateToString } from "../date-utils.js";

export function registerReconcileCommand(program: Command): void {
  const cmd = program
    .command("reconcile")
    .description("Detect duplicate transactions and reconcile balances");

  // -----------------------------------------------------------------------
  // reconcile duplicates
  // -----------------------------------------------------------------------

  cmd
    .command("duplicates")
    .description("Find potential duplicate transactions using fuzzy matching")
    .option("--from <date>", "Start date for search")
    .option("--to <date>", "End date for search")
    .option("--account <number>", "Filter to specific account")
    .option("--tolerance <amount>", "Amount tolerance in NIS", "1")
    .option("--date-window <days>", "Date window in days", "3")
    .option("--cross-account", "Include cross-account matches", false)
    .option("--min-score <score>", "Minimum score threshold (0-1)", "0.5")
    .option("--dry-run", "Show candidates without prompting for decisions")
    .action(async (opts) => {
      const config: FuzzyMatchConfig = {
        amountTolerance: Number(opts.tolerance),
        dateWindowDays: Number(opts.dateWindow),
        descriptionThreshold: 0.6,
        crossAccount: opts.crossAccount,
      };
      const minScore = Number(opts.minScore);

      // Default date range: last 90 days
      const defaultFrom = formatISO(subDays(new Date(), 90), { representation: "date" });
      const from = opts.from ? parseDateToString(opts.from) : defaultFrom;
      const to = opts.to ? parseDateToString(opts.to) : undefined;

      // Find candidates from DB (pre-filtered by SQL)
      const rawPairs = findFuzzyDuplicateCandidates(config, {
        from: from ?? undefined,
        to: to ?? undefined,
        accountId: opts.account ? findAccountId(opts.account) : undefined,
      });

      // Score with core logic
      const candidates = rankDuplicates(
        rawPairs
          .map((pair) => computeFuzzyScore(pair.txA, pair.txB, config))
          .filter((c): c is DuplicateCandidate => c !== null),
        minScore,
      );

      if (candidates.length === 0) {
        if (isJsonMode()) {
          printJson(jsonSuccess({ candidates: [], count: 0 }));
        } else {
          info("No potential duplicates found.");
        }
        return;
      }

      if (isJsonMode() || opts.dryRun) {
        if (isJsonMode()) {
          printJson(jsonSuccess({
            candidates: candidates.map(candidateToJson),
            count: candidates.length,
          }));
        } else {
          info(`Found ${candidates.length} potential duplicate pair(s):\n`);
          for (const c of candidates) {
            printCandidatePair(c);
          }
        }
        return;
      }

      // Interactive review
      if (!isInteractive()) {
        info(`Found ${candidates.length} potential duplicate pair(s). Use --dry-run or --json to view.`);
        return;
      }

      const { select } = await import("@inquirer/prompts");

      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        console.log(`\n--- Pair ${i + 1}/${candidates.length} (score: ${c.score.toFixed(2)}) ---`);
        printCandidatePair(c);

        const action = await select({
          message: "What would you like to do?",
          choices: [
            { name: `Keep #${c.txA.id} (delete #${c.txB.id})`, value: "keep_a" },
            { name: `Keep #${c.txB.id} (delete #${c.txA.id})`, value: "keep_b" },
            { name: "Not a duplicate (dismiss)", value: "dismiss" },
            { name: "Skip (decide later)", value: "skip" },
          ],
        });

        if (action === "keep_a") {
          mergeDuplicate(c.txA.id, c.txB.id, c.score);
          info(`Merged: kept #${c.txA.id}, deleted #${c.txB.id}`);
        } else if (action === "keep_b") {
          mergeDuplicate(c.txB.id, c.txA.id, c.score);
          info(`Merged: kept #${c.txB.id}, deleted #${c.txA.id}`);
        } else if (action === "dismiss") {
          recordReconciliationDecision(c.txA.id, c.txB.id, "dismissed", c.score);
          info("Dismissed — won't be flagged again.");
        }
        // skip: do nothing
      }

      info("Review complete.");
    });

  // -----------------------------------------------------------------------
  // reconcile balance
  // -----------------------------------------------------------------------

  cmd
    .command("balance")
    .description("Compare computed transaction sum against expected account balance")
    .requiredOption("--account <number>", "Account number")
    .requiredOption("--expected <amount>", "Expected balance")
    .option("--from <date>", "Start date")
    .option("--to <date>", "End date")
    .action((opts) => {
      const accountId = findAccountId(opts.account);
      if (!accountId) {
        printError("NOT_FOUND", `Account '${opts.account}' not found.`);
        process.exit(ExitCode.Error);
      }

      const expected = Number(opts.expected);
      if (isNaN(expected)) {
        printError("BAD_ARGS", "Expected balance must be a number.");
        process.exit(ExitCode.BadArgs);
      }

      const from = opts.from ? parseDateToString(opts.from) ?? undefined : undefined;
      const to = opts.to ? parseDateToString(opts.to) ?? undefined : undefined;

      const result = computeAccountBalance(accountId, from, to);
      const discrepancy = expected - result.sum;

      // Look up account info
      const balanceReport = getBalanceReport();
      const accountInfo = balanceReport.find((r) => {
        // Match by account number substring
        return opts.account.endsWith(r.accountNumber) || r.accountNumber.endsWith(opts.account);
      });

      if (isJsonMode()) {
        printJson(jsonSuccess({
          accountId,
          accountNumber: accountInfo?.accountNumber ?? opts.account,
          providerAlias: accountInfo?.providerAlias ?? "",
          expectedBalance: expected,
          computedBalance: result.sum,
          discrepancy,
          transactionCount: result.count,
          dateRange: { from: result.from, to: result.to },
          currency: accountInfo?.currency ?? "ILS",
        }));
        return;
      }

      console.log(createTable(["", "Value"], [
        ["Account", accountInfo ? `${accountInfo.providerAlias} / ****${accountInfo.accountNumber}` : opts.account],
        ["Expected balance", formatCurrency(expected)],
        ["Computed balance", formatCurrency(result.sum)],
        ["Discrepancy", formatCurrency(discrepancy)],
        ["Transactions", String(result.count)],
        ["Date range", `${formatDate(result.from)} to ${formatDate(result.to)}`],
      ]));

      if (Math.abs(discrepancy) < 0.01) {
        info("Balances match.");
      } else if (discrepancy > 0) {
        info(`Computed balance is ${formatCurrency(Math.abs(discrepancy))} lower than expected.`);
        info("This could indicate missing income transactions.");
      } else {
        info(`Computed balance is ${formatCurrency(Math.abs(discrepancy))} higher than expected.`);
        info("This could indicate phantom or duplicate expenses.");
      }
    });

  // -----------------------------------------------------------------------
  // reconcile history
  // -----------------------------------------------------------------------

  cmd
    .command("history")
    .description("View past reconciliation decisions")
    .option("--decision <type>", "Filter by decision type (merged or dismissed)")
    .option("--limit <n>", "Limit results", "50")
    .action((opts) => {
      const decision = opts.decision as ReconciliationDecision | undefined;
      if (decision && decision !== "merged" && decision !== "dismissed") {
        printError("BAD_ARGS", "Decision must be 'merged' or 'dismissed'.");
        process.exit(ExitCode.BadArgs);
      }

      const records = listReconciliationDecisions({
        decision,
        limit: Number(opts.limit),
      });

      if (isJsonMode()) {
        printJson(jsonSuccess(records));
        return;
      }

      if (records.length === 0) {
        info("No reconciliation decisions recorded yet.");
        return;
      }

      console.log(createTable(
        ["ID", "Tx A", "Tx B", "Decision", "Score", "Date"],
        records.map((r) => [
          String(r.id),
          `#${r.txIdA}`,
          `#${r.txIdB}`,
          r.decision,
          r.score.toFixed(2),
          formatDate(r.decidedAt),
        ]),
      ));
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findAccountId(accountNumber: string): number | undefined {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT id FROM accounts WHERE account_number LIKE '%' || $num ORDER BY id LIMIT 1`,
    )
    .get({ $num: accountNumber }) as { id: number } | null;

  return row?.id;
}

function printCandidatePair(c: DuplicateCandidate): void {
  console.log(createTable(["Field", `Tx #${c.txA.id}`, `Tx #${c.txB.id}`], [
    ["Date", formatDate(c.txA.date), formatDate(c.txB.date)],
    ["Amount", formatCurrency(c.txA.chargedAmount), formatCurrency(c.txB.chargedAmount)],
    ["Description", c.txA.description, c.txB.description],
    ["Account", `${c.txA.providerAlias} / ${c.txA.accountNumber}`, `${c.txB.providerAlias} / ${c.txB.accountNumber}`],
    ["Status", c.txA.status, c.txB.status],
    ["Category", c.txA.category ?? "-", c.txB.category ?? "-"],
  ]));
  console.log(`  Score: ${c.score.toFixed(2)} | Amount diff: ${formatCurrency(c.amountDiff)} | Date diff: ${c.dateDiffDays}d | Desc similarity: ${(c.descriptionSimilarity * 100).toFixed(0)}%`);
}

function candidateToJson(c: DuplicateCandidate) {
  return {
    txA: c.txA,
    txB: c.txB,
    score: Number(c.score.toFixed(3)),
    amountDiff: c.amountDiff,
    dateDiffDays: c.dateDiffDays,
    descriptionSimilarity: Number(c.descriptionSimilarity.toFixed(3)),
    sameAccount: c.sameAccount,
  };
}
