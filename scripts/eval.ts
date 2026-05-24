#!/usr/bin/env bun
/**
 * RAG Evaluation CLI
 *
 * Usage:
 *   bun eval --dataset ./eval-dataset.json [--output report.md] [--api-url http://localhost:7392] [--format markdown|json|table] [--no-answer]
 *
 * Reads an EvalDataset JSON file, runs queries against the RAG API,
 * and outputs a formatted report.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { EvalRunner } from '../src/lib/eval/runner';
import { formatReportAsJson, formatReportAsMarkdown, formatReportAsTable } from '../src/lib/eval/reporter';
import type { EvalDataset } from '../src/lib/eval/types';

// =============================================================================
// Argument parsing
// =============================================================================

interface CliArgs {
  dataset: string;
  output?: string;
  apiUrl: string;
  apiKey?: string;
  format: 'markdown' | 'json' | 'table';
  includeAnswer: boolean;
  ci: boolean;
  minPrecision: number;
  minRecall: number;
  minF1: number;
  maxLatencyMs: number;
  maxFailureRate: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dataset: '',
    apiUrl: 'http://localhost:7392',
    format: 'markdown',
    includeAnswer: true,
    ci: false,
    minPrecision: 0.7,
    minRecall: 0.6,
    minF1: 0.65,
    maxLatencyMs: 5000,
    maxFailureRate: 0.1,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--dataset':
      case '-d':
        args.dataset = argv[++i];
        break;
      case '--output':
      case '-o':
        args.output = argv[++i];
        break;
      case '--api-url':
        args.apiUrl = argv[++i];
        break;
      case '--api-key':
        args.apiKey = argv[++i];
        break;
      case '--format':
        args.format = argv[++i] as CliArgs['format'];
        break;
      case '--no-answer':
        args.includeAnswer = false;
        break;
      case '--ci':
        args.ci = true;
        break;
      case '--min-precision':
        args.minPrecision = Number.parseFloat(argv[++i]);
        break;
      case '--min-recall':
        args.minRecall = Number.parseFloat(argv[++i]);
        break;
      case '--min-f1':
        args.minF1 = Number.parseFloat(argv[++i]);
        break;
      case '--max-latency':
        args.maxLatencyMs = Number.parseInt(argv[++i], 10);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  if (!args.dataset) {
    console.error('Error: --dataset is required');
    printHelp();
    process.exit(1);
  }

  return args;
}

function printHelp(): void {
  console.log(`
RAG Evaluation CLI

Usage:
  bun eval --dataset <path> [options]

Options:
  --dataset, -d <path>       Path to eval dataset JSON file (required)
  --output, -o <path>        Output file path (default: stdout)
  --api-url <url>            Base URL of the RAG API (default: http://localhost:7392)
  --api-key <key>            API key for authentication
  --format <fmt>             Output format: markdown, json, table (default: markdown)
  --no-answer                Skip answer generation, only evaluate retrieval
  --ci                       CI mode: exit with error code on quality regression
  --min-precision <0-1>      Minimum precision threshold (default: 0.7)
  --min-recall <0-1>         Minimum recall threshold (default: 0.6)
  --min-f1 <0-1>             Minimum F1 threshold (default: 0.65)
  --max-latency <ms>         Maximum average latency in ms (default: 5000)
  --help, -h                 Show this help message

Examples:
  bun eval --dataset ./eval-data.json
  bun eval -d ./eval-data.json -o report.md --format markdown
  bun eval -d ./eval-data.json --api-url http://localhost:7393 --no-answer
`);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Read dataset
  const datasetPath = resolve(args.dataset);
  if (!existsSync(datasetPath)) {
    console.error(`Error: Dataset file not found: ${datasetPath}`);
    process.exit(1);
  }

  let dataset: EvalDataset;
  try {
    const raw = readFileSync(datasetPath, 'utf-8');
    dataset = JSON.parse(raw) as EvalDataset;
  } catch (err) {
    console.error(`Error: Failed to read dataset: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // Validate dataset
  if (!dataset.name || !Array.isArray(dataset.queries) || dataset.queries.length === 0) {
    console.error('Error: Dataset must have a name and at least one query');
    process.exit(1);
  }

  console.log(`Running evaluation: "${dataset.name}" (${dataset.queries.length} queries)`);
  console.log(`API: ${args.apiUrl}`);
  console.log(`Answer generation: ${args.includeAnswer ? 'enabled' : 'disabled'}`);
  console.log('');

  // Run evaluation
  const runner = new EvalRunner({
    apiBaseUrl: args.apiUrl,
    apiKey: args.apiKey,
    includeAnswer: args.includeAnswer,
  });

  const report = await runner.run(dataset);

  // Format output
  let output: string;
  switch (args.format) {
    case 'json':
      output = formatReportAsJson(report);
      break;
    case 'table':
      output = formatReportAsTable(report);
      break;
    case 'markdown':
    default:
      output = formatReportAsMarkdown(report);
      break;
  }

  // Write or print
  if (args.output) {
    const outputPath = resolve(args.output);
    const dir = resolve(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(outputPath, output, 'utf-8');
    console.log(`Report written to: ${outputPath}`);
  } else {
    console.log(output);
  }

  // Save report to eval data directory for admin UI
  const evalDataDir = resolve(process.cwd(), 'eval-results');
  if (!existsSync(evalDataDir)) {
    mkdirSync(evalDataDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFileName = `${dataset.name.replace(/\s+/g, '-')}-${timestamp}.json`;
  const reportPath = resolve(evalDataDir, reportFileName);
  writeFileSync(reportPath, formatReportAsJson(report), 'utf-8');

  // Print summary
  console.log('');
  console.log(`  Successful: ${report.successfulQueries}/${report.totalQueries}`);
  console.log(`  Avg Precision: ${(report.avgRetrievalMetrics.precision * 100).toFixed(1)}%`);
  console.log(`  Avg Recall:    ${(report.avgRetrievalMetrics.recall * 100).toFixed(1)}%`);
  console.log(`  Avg F1:        ${(report.avgRetrievalMetrics.f1 * 100).toFixed(1)}%`);
  console.log(`  Avg Latency:   ${report.avgLatencyMs.toFixed(0)}ms`);

  if (report.failedQueries > 0) {
    console.log('');
    console.warn(`  WARNING: ${report.failedQueries} queries failed.`);
    for (const r of report.results.filter((r) => r.error)) {
      console.warn(`    - [${r.queryId}] ${r.error}`);
    }
  }

  // CI mode: check quality thresholds
  if (args.ci) {
    const failures: string[] = [];
    const precision = report.avgRetrievalMetrics.precision;
    const recall = report.avgRetrievalMetrics.recall;
    const f1 = report.avgRetrievalMetrics.f1;
    const failureRate = report.totalQueries > 0 ? report.failedQueries / report.totalQueries : 1;

    if (precision < args.minPrecision) {
      failures.push(`Precision ${precision.toFixed(3)} below threshold ${args.minPrecision}`);
    }
    if (recall < args.minRecall) {
      failures.push(`Recall ${recall.toFixed(3)} below threshold ${args.minRecall}`);
    }
    if (f1 < args.minF1) {
      failures.push(`F1 ${f1.toFixed(3)} below threshold ${args.minF1}`);
    }
    if (report.avgLatencyMs > args.maxLatencyMs) {
      failures.push(`Avg latency ${report.avgLatencyMs.toFixed(0)}ms exceeds ${args.maxLatencyMs}ms`);
    }
    if (failureRate > args.maxFailureRate) {
      failures.push(`Failure rate ${(failureRate * 100).toFixed(1)}% exceeds ${(args.maxFailureRate * 100).toFixed(1)}%`);
    }

    if (failures.length > 0) {
      console.error('\n  CI QUALITY GATES FAILED:');
      for (const f of failures) {
        console.error(`    - ${f}`);
      }
      process.exit(1);
    } else {
      console.log('\n  CI quality gates PASSED');
    }
  }
}

main().catch((err) => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
