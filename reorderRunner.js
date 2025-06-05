const { execSync } = require('child_process');
const path = require('path');


const argv = require('yargs')
    .options({
        'project_path': {
            describe: 'Path to the project',
            demandOption: true, 
            type: 'string' 
        },
        'reorder': {
            describe: 'Number of reordering operations',
            type: 'number' 
        },
        'rerun': {
            describe: 'Number of rerun operations',
            type: 'number' 
        }
    })
    .argv;


const rerunNumber = argv.rerun || 10;
const reorderNumber = argv.reorder || 10;
const projectPath = argv.project_path;

if (!projectPath) {
    console.error('Please provide the path to the project folder.');
    process.exit(1);
    }


function runScript(label, script) {
    try {
        console.log(label);
        execSync(`node ${script} --project_path="${projectPath}" --rerun=${rerunNumber} --reorder=${reorderNumber}`, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Failed to run ${script}: ${error.message}`);
    }
}

runScript('Reordering and rerunning the test suites!', 'testSuitesReorderRunner.js');
runScript('Reordering and rerunning the describe blocks!', 'describeReorderRunner.js');
runScript('Reordering and rerunning the tests!', 'testReorderRunner.js');

      