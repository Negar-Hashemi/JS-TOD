#!/usr/bin/env node
"use strict";

/**
 * Robust results parser:
 * - Supports legacy custom schema: { suite_name, order_id, permutations, reruns, results:[{passed,failed}] }
 * - Supports Jest --json output: { numPassedTests, numFailedTests, testResults:[{name,...}], ... }
 * - Reads manifest.json (if present) for level/permutations/reruns
 * - Emits CSV to "<results-dir>/output_parsing/summary.csv"
 */

const fs = require("fs");
const path = require("path");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");

// Directories we consider results roots (preserves your legacy locations)
const LEGACY_DIRS = [
  { level: "describe", re: /___extracted results describes___$/ },
  { level: "suite",    re: /___extracted results test files___$/ },
  { level: "test",     re: /___extracted results___$/ }
];

const argv = yargs(hideBin(process.argv))
  .option("project_path", { type: "string", demandOption: true, describe: "Path to project root" })
  .option("input",        { type: "string", describe: "Optional specific results dir to parse" })
  .strict()
  .help()
  .parse();

const projectRoot = path.resolve(argv.project_path);

// ---------------------- Helpers ----------------------

function walkDirs(start) {
  const out = [];
  const stack = [start];
  while (stack.length) {
    const d = stack.pop();
    let list;
    try { list = fs.readdirSync(d); } catch { continue; }
    for (const name of list) {
      const p = path.join(d, name);
      let st;
      try { st = fs.statSync(p); } catch { continue; }
      if (st.isDirectory()) stack.push(p);
      else if (name === "manifest.json") out.push(path.dirname(p));
    }
  }
  return out;
}

function listCandidateDirs(projectRoot) {
  const manifests = walkDirs(projectRoot);

  const legacy = [];
  const stack = [projectRoot];
  while (stack.length) {
    const d = stack.pop();
    let list;
    try { list = fs.readdirSync(d); } catch { continue; }
    for (const name of list) {
      const p = path.join(d, name);
      let st;
      try { st = fs.statSync(p); } catch { continue; }
      if (!st.isDirectory()) continue;
      if (LEGACY_DIRS.some(({ re }) => re.test(p))) legacy.push(p);
      else stack.push(p);
    }
  }
  // de-duplicate
  return Array.from(new Set([...manifests, ...legacy]));
}

function readJsonSafe(p) {
  try {
    const data = fs.readFileSync(p, "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function detectLevel(dir) {
  const mf = path.join(dir, "manifest.json");
  if (fs.existsSync(mf)) {
    const m = readJsonSafe(mf);
    if (m && m.level) return String(m.level);
  }
  if (/___extracted results describes___$/.test(dir)) return "describe";
  if (/___extracted results test files___$/.test(dir)) return "suite";
  if (/___extracted results___$/.test(dir)) return "test";
  return "unknown";
}

function readManifestFields(dir) {
  const mf = path.join(dir, "manifest.json");
  const base = { permutations: "", reruns: "" };
  const m = readJsonSafe(mf);
  if (!m) return { level: detectLevel(dir), ...base };
  return {
    level: m.level || detectLevel(dir),
    permutations: m.permutations ?? "",
    reruns: m.reruns ?? ""
  };
}

function findJsonFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  for (const name of items) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) files.push(...findJsonFiles(p));
    else if (/^testOutput.*\.json$/i.test(name)) files.push(p);
  }
  return files;
}

function deriveOrderIdFromFilename(filePath) {
  const base = path.basename(filePath, ".json");
  // Examples: testOutput DefaultOrder.json, testOutput_Order_03_Rerun_2.json, testOutput 12.json
  const m = base.match(/\b(order[_\s]*\d+|rerun[_\s]*\d+|\d+)\b/i);
  return m ? m[0].replace(/\s+/g, "_") : base; // fallback to full base if nothing else
}

function toCsv(rows) {
  const headers = ["level","suite_name","passes","fails","source_file"];
  const esc = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(","));
  return lines.join("\n");
}

// ---------------------- Parsers ----------------------

/**
 * Parse legacy custom schema:
 * {
 *   suite_name, order_id, permutations, reruns,
 *   results: [{ passed: <num>, failed: <num> }, ...]
 * }
 */
function parseLegacyAggregate(json) {
  if (!json || typeof json !== "object") return null;
  if (!Array.isArray(json.results)) return null;
  const passes = json.results.reduce((a, r) => a + (r?.passed || 0), 0);
  const fails  = json.results.reduce((a, r) => a + (r?.failed || 0), 0);
  return {
    suite_name: json.suite_name || json.file || json.suite || "",
    passes,
    fails
  };
}

/**
 * Parse Jest --json result schema (single run per file)
 * Typical fields:
 * - numPassedTests, numFailedTests, numTotalTests
 * - testResults: [{ name: <path to test file>, assertionResults: [...], status: "passed"/"failed" }, ...]
 */
function parseJestSingleRun(json) {
  if (!json || typeof json !== "object") return null;
  const hasJestCounts = Number.isInteger(json.numPassedTests) || Number.isInteger(json.numFailedTests);
  const hasTestResults = Array.isArray(json.testResults);
  if (!hasJestCounts && !hasTestResults) return null;

  const passes = Number.isInteger(json.numPassedTests) ? json.numPassedTests : (
    hasTestResults
      ? json.testResults.reduce((a, tr) => {
          const ar = Array.isArray(tr.assertionResults) ? tr.assertionResults : [];
          return a + ar.filter(x => x.status === "passed").length;
        }, 0)
      : 0
  );

  const fails = Number.isInteger(json.numFailedTests) ? json.numFailedTests : (
    hasTestResults
      ? json.testResults.reduce((a, tr) => {
          const ar = Array.isArray(tr.assertionResults) ? tr.assertionResults : [];
          return a + ar.filter(x => x.status === "failed").length;
        }, 0)
      : 0
  );

  // Suite name: first test file path, if available
  let suite_name = "";
  if (hasTestResults && json.testResults.length > 0) {
    const first = json.testResults[0];
    suite_name = first.name || first.testFilePath || "";
  }

  return {
    suite_name,
    // order_id and permutations/reruns will be filled by caller using filename/manifest
    order_id: "",
    permutations: "",
    reruns: "",
    total_runs: 1,
    passes,
    fails
  };
}

// ---------------------- Main per-directory parse ----------------------

function parseResultsDir(dir) {
  const { level, permutations, reruns } = readManifestFields(dir);
  const files = findJsonFiles(dir);
  const rows = [];

  for (const file of files) {
    const data = readJsonSafe(file);
    if (!data) continue;

    // Try legacy aggregate format first
    let parsed = parseLegacyAggregate(data);

    // Else try Jest single-run format
    if (!parsed) parsed = parseJestSingleRun(data);

    // If still nothing, skip
    if (!parsed) continue;

    // Fill in fields from manifest/filename
    const order_id = parsed.order_id || deriveOrderIdFromFilename(file);
    const row = {
      level,
      suite_name: parsed.suite_name || "",
      order_id,
      permutations: parsed.permutations !== "" ? parsed.permutations : permutations,
      reruns: parsed.reruns !== "" ? parsed.reruns : reruns,
      total_runs: parsed.total_runs,
      passes: parsed.passes,
      fails: parsed.fails,
      source_file: path.relative(dir, file)
    };
    rows.push(row);
  }

  // Write CSV
  const outDir = path.join(dir, "output_parsing");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "summary.csv");
  fs.writeFileSync(outPath, toCsv(rows), "utf8");

  // Console preview (first few rows)
  console.log(`\nParsed ${rows.length} result file(s) in: ${dir}`);
  const previewCount = Math.min(rows.length, 10);
  if (previewCount > 0) {
    console.log("Preview (up to 10 rows):");
    for (let i = 0; i < previewCount; i++) {
      const r = rows[i];
      console.log(`- [${r.level}] ${r.suite_name || "(no suite)"}  id=${r.order_id}  runs=${r.total_runs}  ✓${r.passes} ✗${r.fails}`);
    }
    console.log(`CSV written to: ${outPath}`);
  } else {
    console.log("No parsable JSON files found.");
  }
}

// ---------------------- Entry ----------------------

const dirs = argv.input ? [path.resolve(argv.input)] : listCandidateDirs(projectRoot);
if (dirs.length === 0) {
  console.error("No results directories found.");
  process.exit(1);
}
for (const d of dirs) parseResultsDir(d);
