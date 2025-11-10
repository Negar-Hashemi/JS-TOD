# `JS-TOD`

`JS-TOD` (**J**ava**S**cript - **T**est **O**rder-dependency **D**etector) is a tool to extract and detect order-dependent tests in Jest. `JS-TOD` is designed to reorder and rerun test suites, describe blocks, and individual test cases in JavaScript projects. By automatically shuffling test execution order and running multiple iterations, `JS-TOD` helps you detect hidden dependencies between tests and improve the robustness of your test suite.

---

## Folder Structure

```
JS-TOD/
├── reorderRunner.js               # Main CLI for running JS-TOD
├── parseResults.js                # Parser for summarizing results (JSON → CSV)
├── cleanup-js-tod.js              # Cleanup the related folders and files related to running JS-TOD
├── lib/
│   ├── core/
│   │   └── customSequencer.js     # Custom Jest test sequencer (for test suite-level reordering)
│   ├── runners/
│   │       ├── testReorderRunner.js
│   │       ├── describeReorderRunner.js
│   │       └── testSuitesReorderRunner.js
└── package.json
└── sample-projects/
```

This structure separates core logic (AST parsing, sequencing, reruns) from orchestration layers, improving reproducibility and maintainability.

---

## Installation

`JS-TOD` requires **Node.js ≥ 18.17.0** (Node 20+ recommended).

Clone the repository and install dependencies:

```bash
git clone https://github.com/Negar-Hashemi/js-tod.git
cd js-tod
npm install
```

If running inside a controlled environment (e.g., replication container), verify Node and npm versions:

```bash
node -v # ≥ 18.17.0
npm -v # ≥ 10.2.3
```

---

## Running `JS-TOD`

The main entry point is `reorderRunner.js`.

### Command syntax

```bash
node reorderRunner.js   --project_path="<path_to_project>"   --level="<test|describe|suite|all>"   --reorder=<number_of_permutations>   --rerun=<number_of_reruns_per_permutation>
```

### Arguments

| Argument | Description | Default |
|-----------|-------------|----------|
| `--project_path` | Path to the target project containing Jest tests | *Required* |
| `--level` | Reordering level: `test`, `describe`, `suite`, or `all` (runs all three) | `all` |
| `--reorder` | Number of reordering operations (permutations) | `10` |
| `--rerun` | Number of reruns for each permutation | `10` |

### Output

Each level saves its results in a dedicated folder within the project:

| Level | Folder |
|--------|---------|
| Test | `___extracted results___` |
| Describe | `___extracted results describes___` |
| Suite | `___extracted results test files___` |

Each run produces:
- JSON files named `testOutput-<order>-<rerun>.json`


### Example from a sample project
We provide a sample project with possible order-depedent flaky tests behaviour. To run the ``JS-TOD`` project:

```bash
node reorderRunner.js --project_path="./sample-projects"
```

Run only the suite-level (test file) reordering:

```bash
node reorderRunner.js --project_path="./sample-projects" --level="suite"
```

#### Expected Outcomes

The project intentionally contains **order-dependent** behaviors at three levels:

- **Suite level (test files):** `tests/01-setupState.test.js` must run before `tests/02-consumeState.test.js`.
- **Describe level (within a file):** `tests/03-describe-order.test.js` has two `describe` blocks where the second depends on the first.
- **Test level (within a describe):** `tests/04-test-order.test.js` has a test that depends on a previous test.

After running JS-TOD at different levels (test, suite, or describe), each sample project will contain:

- Generated result folders depending on the selected reordering level:
  - `___extracted results___` → test-level reordering
  - `___extracted results test files___` → suite-level reordering
  - `___extracted results describes___` → describe-block-level reordering
- New test files inside these folders — each representing a reordered variant of the original test suite.
- `testPaths.txt` inside each result folder, listing all generated test files.
- Result JSON files named like  
  ```
  testOutput <testName>_<runIndex>.json
  ```
  These files contain Jest’s `--json` output for every reordered execution and rerun.
- A folder named `__default order run__` containing results of the baseline (non-reordered) test executions.

#### Example Folder Layout

```bash
sample-projects/
├── __default order run__/
│   └── testOutput DefaultOrder.json
├── ___extracted results___/
│   ├── testPaths.txt
│   ├── testOutput example_0.json
│   ├── testOutput example_1.json
│   ├── ...
│   └── output_parsing/
│       └── summary.csv
```

#### Example (console preview):
```
Parsed 12 result file(s) in: ___extracted results___
Preview (up to 10 rows):
- [test] sample.test.js  id=order_01  ✓8 ✗0
- [test] sample.test.js  id=order_02  ✓7 ✗1
CSV written to: ___extracted results___/output_parsing/summary.csv
```

#### Interpretation

- The variation in pass/fail counts across different order files indicates true order-dependent flakiness.

- These differences are expected for the sample projects and demonstrate JS-TOD’s ability to uncover order dependencies that are otherwise invisible in default test runs.

- When using JS-TOD on your own projects, similar patterns point to tests whose outcomes are affected by prior test execution, shared state, or resource ordering.

---

## Custom Sequencer

For test suite-level reordering, `JS-TOD` uses a **custom Jest test sequencer** located at:

```
lib/core/customSequencer.js
```

The sequencer:
- Reads `--order=<comma-separated test paths>` from the command line.
- Reorders test files before Jest executes them.
- Ensures consistent ordering across reruns.

This approach allows `JS-TOD` to manipulate the test suite execution order without modifying project source files.

---

## Parsing and Summarizing Results

After running `JS-TOD`, use the parser to summarize outputs into CSV:

```bash
node parseResults.js --project_path="./sample-projects"
```

This command scans all `___extracted results...___` directories, parses each JSON result, and produces CSV summaries in:
```
output_parsing/summary.csv
```

Each CSV contains:
| Column | Description |
|---------|-------------|
| `level` | Reordering level |
| `suite_name` | Test suite name |
| `passes` | Number of passing tests |
| `fails` | Number of failing tests |
| `source_file` | Original JSON file path |

---
## Cleanup After Running JS-TOD

After using `JS-TOD`, the project directory will contain generated test files and result folders at different levels (test, suite, and describe).  
To restore the project to its original state, you can use the provided cleanup script.

### What the cleanup script does
The cleanup tool safely removes all artifacts created by JS-TOD:
- Reordered test files recorded in `testPaths.txt`
- Result directories:
  - `___extracted results___`  (test level)  
  - `___extracted results test files___`  (suite level)  
  - `___extracted results describes___`  (describe level)
- The default run folder: `__default order run__`

It only deletes files explicitly generated by JS-TOD and **does not touch original source or test files**.

### Usage

```bash
# Preview what will be deleted (safe mode)
node cleanup-js-tod.js --project_path "/path/to/project" --dry-run

# Clean everything (remove all generated tests and result folders)
node cleanup-js-tod.js --project_path "/path/to/project"

# Clean specific levels only (optional)
node cleanup-js-tod.js --project_path "/path/to/project" --levels suite,test

# Keep result folders but remove generated test files
node cleanup-js-tod.js --project_path "/path/to/project" --keep-results
```

### Notes
- Always run the cleanup from the same environment where JS-TOD was executed.  
- `--dry-run` is highly recommended before actual cleanup to review what will be removed.  
- The script ensures that no files outside your specified `--project_path` are touched.

---

## Design Overview

`JS-TOD` operates in two layers:

1. **Orchestration Layer**  
   `reorderRunner.js` — CLI handling, running test suites in default order, extracting the list of test suites, and dispatch to selected level.

2. **Runner Layer (core logic)**  
   `lib/runners/*.js` — Performs actual extraction, AST rewriting, shuffling, rerunning, and result generation.

The modular design preserves separation between reproducibility logic and test manipulation logic, while remaining backward-compatible with the original version of `JS-TOD`.

---
## Docker Usage

`JS-TOD` can be executed inside a pre-configured Docker container to ensure reproducibility across environments.  
The Docker image contains Node.js 20, all required dependencies, and `JS-TOD` itself.

### **Building the Docker Image**

From the root of the `JS-TOD` repository (where the `Dockerfile` is located):

```bash
docker build -t js-tod .
```

This command installs all dependencies, prunes development packages, and produces a lightweight image tagged ``JS-TOD``.

---

### **Running `JS-TOD` in Docker**

To analyze a local JavaScript project with `JS-TOD`:

```bash
docker run --rm -it   -v "/absolute/path/to/project:/work"   js-tod   --project_path="/work"   --level=all   --reorder=10   --rerun=10
```

**Parameters**
| Flag | Description | Default |
|------|--------------|----------|
| `--project_path` | Path to the project under test (mounted inside container) | *Required* |
| `--level` | Reordering granularity: `suite`, `describe`, `test`, or `all` | `all` |
| `--reorder` | Number of reorderings per level | `10` |
| `--rerun` | Number of reruns for each order | `10` |

The project under test must already include Jest and its dependencies.  
If not, you can install them inside the mounted directory:

```bash
docker run --rm -it -v "/absolute/path/to/project:/work" -w /work node:20-slim npm ci
```

---

### **Example**

```bash
docker run --rm -it   -v "$(pwd)/sample-projects:/work"   js-tod   --project_path="/work"   --level=describe   --reorder=5   --rerun=3
```

This runs `JS-TOD` at the **describe-block level** on the sample project and stores the reordered test results inside the mounted project directory.

---

### **Output**

All reordered test files and JSON result summaries will appear under the project’s working directory (e.g.,  
`___extracted results___`, `___extracted results describes___`, `___extracted results test files___`).

---

## Troubleshooting / Common Errors

This section provides solutions for common setup and runtime issues that may occur when running `JS-TOD`.

### **AST Parsing Errors**

**Problem:**  
An error appears during reordering, such as:
```
SyntaxError: Unexpected token ... while parsing project source
```

**Explanation:**  
`JS-TOD` parses project files using Babel’s `@babel/parser`.  
This error usually occurs if the project under test uses newer ECMAScript syntax not supported by the current Babel configuration.

**Solution:**  
- Ensure the project compiles and runs correctly with Jest.  
- Check whether the project includes experimental syntax (e.g., decorators, top-level await).  
- If so, add Babel plugins or presets to the project under test to enable parsing.  
Example:
```bash
npm install --save-dev @babel/preset-env
```
---

## License

Released under the **MIT License** (see `LICENSE`).
