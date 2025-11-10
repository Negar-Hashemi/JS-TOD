#!/usr/bin/env node
// runner.js — single parser using yargs; passes args to level runners via env.
// No other file parses CLI args.

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const argv = require('yargs')
  .options({
    'project_path': {
      describe: 'Path to the projectproject',
      demandOption: true,
      type: 'string'
    },
    'reorder': {
      describe: 'Number of reordering operations',
      type: 'number',
      default: 10
    },
    'rerun': {
      describe: 'Number of rerun operations',
      type: 'number',
      default: 10
    },
    'level': {
      describe: 'Granularity: suite|describe|test|all',
      choices: ['suite', 'describe', 'test', 'all'],
      default: 'all'
    }
  })
  .argv;

const projectPath = argv.project_path;
const reorderNumber = Number.isInteger(argv.reorder) ? argv.reorder : 10;
const rerunNumber = Number.isInteger(argv.rerun) ? argv.rerun : 10;
const level = argv.level;
const absolutePath = path.resolve(projectPath);

main().catch(err => {
  console.error(err);
  process.exit(1);
});

async function main() {
  // 1) Run once in default order
  runningDefaultOrder();

  // 2) Compute test list once and persist to a temp JSON file
  const tests = listTests();
  if (!Array.isArray(tests) || tests.length === 0) {
    console.error('Could not obtain any tests from `jest --listTests`.');
    process.exit(2);
  }
  const listPath = writeListToTempFile(tests);

  // 3) Dispatch to level runners with env that includes the list path
  switch (level) {
    case 'suite':
      run('Reordering and rerunning test SUITES…', 'testSuitesReorderRunner.js', listPath);
      break;
    case 'describe':
      run('Reordering and rerunning DESCRIBE blocks…', 'describeReorderRunner.js', listPath);
      break;
    case 'test':
      run('Reordering and rerunning TESTS…', 'testReorderRunner.js', listPath);
      break;
    case 'all':
    default:
      run('Reordering and rerunning test SUITES…', 'testSuitesReorderRunner.js', listPath);
      run('Reordering and rerunning DESCRIBE blocks…', 'describeReorderRunner.js', listPath);
      run('Reordering and rerunning TESTS…', 'testReorderRunner.js', listPath);
      break;
  }
}

function runningDefaultOrder() {
  const parentFolderPath = path.join(projectPath, "___default order run___");
  const parentFolderAbsolute = path.resolve(parentFolderPath);
  const outputName = `testOutput DefaultOrder.json`;

  try {
    fs.mkdirSync(parentFolderPath, { recursive: true });
  } catch (err) {
    console.error(`Error creating folder: ${err.message}`);
  }

  const outputPath = path.join(parentFolderAbsolute, outputName);
  const commandSequencer = `cd "${absolutePath}" && npx jest test --json --outputFile="${outputPath}"`;

  console.log(commandSequencer);

  try {
      // Execute the command
      const output = execSync(commandSequencer, { encoding: 'utf-8' });
  } catch (error) {
      if (error.message.includes('npx jest not found')) {
          console.error('Jest command not found. Make sure Jest is installed.');
      } else {
          console.error('Error executing the Jest test command:', error);
      }
  }
}

function listTests(projectPath) {
  try {
    const cmd = `cd "${absolutePath}" && npx jest --listTests`;
    const output = execSync(cmd, { encoding: 'utf-8' });

    // Some Jest versions might return plain newline-separated paths; others may return JSON if wrapped.
    // Parse robustly: try JSON first, then fallback to splitting lines.
    const parsed = tryParseJsonArray(output);
    if (parsed) return parsed;

    return output
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  } catch (err) {
    console.error('Failed to run `jest --listTests`:', err.message || err);
    return [];
  }
}

function tryParseJsonArray(str) {
  // Accept arrays possibly surrounded by whitespace
  const trimmed = (str || '').trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  try {
    const j = JSON.parse(trimmed);
    return Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

function writeListToTempFile(tests) {
  const listPath = path.join(os.tmpdir(), `js-tod-test-list-${Date.now()}.json`);
  fs.writeFileSync(listPath, JSON.stringify(tests, null, 2), 'utf-8');
  return listPath;
}

function run(label, script, listPath) {
  try {
    console.log(label);
    const env = {
      ...process.env,
      JS_TOD_PROJECT_PATH: projectPath,
      JS_TOD_REORDER: String(reorderNumber),
      JS_TOD_RERUN: String(rerunNumber),
      JS_TOD_TEST_LIST_PATH: listPath  // << pass the file path to children
    };
    const cmd = ['node', path.join(__dirname, 'lib', 'runners', script)].join(' ');
    execSync(cmd, { stdio: 'inherit', env });
  } catch (err) {
    console.error(`Failed to run ${script}: ${err.message || err}`);
  }
}

