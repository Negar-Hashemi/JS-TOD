#!/usr/bin/env node
"use strict";

/**
 * JS-TOD project cleaner
 *
 * Removes:
 *   • Reordered test files listed in any testPaths.txt
 *   • Result folders:
 *       ___extracted results describes___
 *       ___extracted results test files___
 *       ___extracted results___
 *   • The default-order folder: __default order run__
 *
 * Options:
 *   --project_path <path>   (required)
 *   --dry-run               Show what would be deleted, make no changes
 *   --levels <csv>          describe,suite,test (default: all)
 *   --keep-results          Keep result folders (only delete generated test files)
 */

const fs = require("fs");
const path = require("path");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");

const LEGACY_DIRS = [
  { level: "describe", re: /___extracted results describes___$/ },
  { level: "suite",    re: /___extracted results test files___$/ },
  { level: "test",     re: /___extracted results___$/ }
];

const argv = yargs(hideBin(process.argv))
  .option("project_path", { type: "string", demandOption: true, describe: "Path to project root" })
  .option("dry-run",      { type: "boolean", default: false, describe: "Show what would be deleted" })
  .option("levels",       { type: "string", describe: "Comma-separated subset of levels: describe,suite,test" })
  .option("keep-results", { type: "boolean", default: false, describe: "Keep result folders; only delete generated tests" })
  .strict()
  .help()
  .parse();

const projectRoot = path.resolve(argv.project_path);
const DRY = argv["dry-run"] === true;
const KEEP_RESULTS = argv["keep-results"] === true;
const LEVEL_FILTER = parseLevels(argv.levels);

// ------------ helpers ------------

function parseLevels(s) {
  if (!s) return null;
  const set = new Set(
    s.split(",").map(x => x.trim().toLowerCase())
     .filter(x => ["describe","suite","test"].includes(x))
  );
  return set.size ? set : null;
}

function inProject(p) {
  const abs = path.resolve(p);
  return abs.startsWith(projectRoot + path.sep) || abs === projectRoot;
}

function rmFile(p) {
  if (!inProject(p)) return { ok: false, reason: "outside project" };
  try {
    if (DRY) return { ok: true, dry: true };
    fs.rmSync(p, { force: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function rmDirRecursive(p) {
  if (!inProject(p)) return { ok: false, reason: "outside project" };
  try {
    if (DRY) return { ok: true, dry: true };
    fs.rmSync(p, { recursive: true, force: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch { return null; }
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

function walkDirs(start) {
  const out = [];
  const q = [start];
  while (q.length) {
    const d = q.shift();
    let list;
    try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const ent of list) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        out.push(p);
        q.push(p);
      }
    }
  }
  return out;
}

function listCandidateResultDirs(projectRoot) {
  const dirs = walkDirs(projectRoot);
  const hits = [];
  for (const d of dirs) {
    const matchesLegacy = LEGACY_DIRS.some(({ re }) => re.test(d));
    const hasManifest = fs.existsSync(path.join(d, "manifest.json"));
    if (matchesLegacy || hasManifest) hits.push(d);
  }
  return Array.from(new Set(hits)).sort();
}

function readTestPathsFiles(dir) {
  const candidates = [path.join(dir, "testPaths.txt"), path.join(dir, "TESTPATHS.TXT")];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const lines = fs.readFileSync(p, "utf8")
          .split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        return { file: p, paths: lines };
      } catch {}
    }
  }
  return null;
}

function filterByLevel(dirs) {
  if (!LEVEL_FILTER) return dirs;
  return dirs.filter(d => LEVEL_FILTER.has(detectLevel(d)));
}

// ------------ main ------------

(function main() {
  console.log(`JS-TOD cleaner starting in: ${projectRoot}`);
  if (DRY) console.log("DRY-RUN mode: no files or folders will be deleted.");

  const allCandidates = listCandidateResultDirs(projectRoot);
  const candidates = filterByLevel(allCandidates);

  if (candidates.length === 0) {
    console.log("No JS-TOD result directories found.");
  }

  let totalFiles = 0;
  let deletedFiles = 0;

  for (const dir of candidates) {
    const level = detectLevel(dir);
    console.log(`\n> Found results dir [${level}]: ${path.relative(projectRoot, dir)}`);

    // Delete generated test files
    const tp = readTestPathsFiles(dir);
    if (tp && tp.paths.length) {
      console.log(`  - testPaths.txt: ${path.relative(projectRoot, tp.file)} (${tp.paths.length} file(s))`);
      for (const p of tp.paths) {
        const abs = path.resolve(p);
        totalFiles++;
        if (!fs.existsSync(abs)) {
          console.log(`    • (skip) not found: ${path.relative(projectRoot, abs)}`);
          continue;
        }
        const res = rmFile(abs);
        if (res.ok && res.dry) {
          console.log(`    • (dry-run) delete file: ${path.relative(projectRoot, abs)}`);
          deletedFiles++;
        } else if (res.ok) {
          console.log(`    • deleted file: ${path.relative(projectRoot, abs)}`);
          deletedFiles++;
        } else {
          console.log(`    • (error) ${path.relative(projectRoot, abs)} — ${res.reason}`);
        }
      }
    } else {
      console.log("  - No testPaths.txt found (nothing to delete safely here).");
    }

    // Delete results directory itself
    if (KEEP_RESULTS) {
      console.log("  - Skipping results folder removal (--keep-results set).");
    } else {
      const res = rmDirRecursive(dir);
      if (res.ok && res.dry) {
        console.log(`  - (dry-run) remove folder: ${path.relative(projectRoot, dir)}`);
      } else if (res.ok) {
        console.log(`  - removed folder: ${path.relative(projectRoot, dir)}`);
      } else {
        console.log(`  - (error) removing folder: ${path.relative(projectRoot, dir)} — ${res.reason}`);
      }
    }
  }

  // --- Also remove __default order run__ ---
  const defaultOrderDir = path.join(projectRoot, "___default order run___");
  if (fs.existsSync(defaultOrderDir)) {
    console.log(`\n> Found "___default order run___" folder.`);
    const res = rmDirRecursive(defaultOrderDir);
    if (res.ok && res.dry) {
      console.log(`  - (dry-run) would remove: ${path.relative(projectRoot, defaultOrderDir)}`);
    } else if (res.ok) {
      console.log(`  - removed folder: ${path.relative(projectRoot, defaultOrderDir)}`);
    } else {
      console.log(`  - (error) removing "___default order run___": ${res.reason}`);
    }
  }

  console.log(`\nDone. Targeted files listed: ${totalFiles}. ` +
              `${DRY ? "Would delete" : "Deleted"}: ${deletedFiles}.`);
})();
