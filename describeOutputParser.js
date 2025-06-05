const fs = require('fs');
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

// project path
const projectPath = argv.project_path;
const absolutePath = path.resolve(projectPath);

const parentFolderPath = path.join(projectPath, "___extracted results describes___");

const outputParsingResultPath = path.join(parentFolderPath, "output parsing");
try {
    fs.mkdirSync(outputParsingResultPath, { recursive: true });
} catch (err) {
    if (err.code !== 'EEXIST') {
        console.error(`Error creating folder: ${err}`);
    } else {
        console.log(err);
    }
}

const testPathsTxt = path.join(parentFolderPath, "testPaths.txt");

const fileContent = fs.readFileSync(testPathsTxt, 'utf8');


parsinDefaultOrder();
parsingOutput(fileContent);

async function parsinDefaultOrder() {

    const outputParsingName = `defaultOrder_output.csv`;
    const testsResultsPath = path.join(outputParsingResultPath, outputParsingName);

    let dataString;

    // for (let i = 0; i < rerunNumber; ++i) {
    const outputName = `testOutput DefaultOrder.json`;
    const outputPath = path.join(parentFolderPath, outputName);
    console.log(outputPath);

    try {
        const data = await fs.promises.readFile(outputPath, 'utf8');
        const testResults = JSON.parse(data);

        if (testResults && typeof testResults === 'object') {
            const numFailedTests = testResults.numFailedTests;
            const numPassedTests = testResults.numPassedTests;

            const failedTestNames = testResults.testResults
                .filter(testResult => testResult.status === 'failed')
                .map(testResult => testResult.massage);
            console.log(failedTestNames);

            dataString = `outputName , #failed ${numFailedTests}, #passed ${numPassedTests}, ${failedTestNames}`;
            // dataArray.push(dataString);
        } else {
            console.error('Jest output is not in the expected JSON format.');
            console.log('Jest Output:', data);
        }
    } catch (error) {
        console.error('Error reading or parsing JSON file:', error);
    }
    // }

    // const csvData = dataArray.join('\n');

    try {
        await fs.promises.writeFile(testsResultsPath, dataString);
        console.log('CSV file has been written successfully.');
    } catch (err) {
        console.error('Error writing CSV:', err);
    }


}

async function parsingOutput(testPaths) {
    const testsAddress = testPaths.split('\n').filter(Boolean);

    for (const test of testsAddress) {
        const outputParsingName = `${path.basename(test).split('.')[0]}_output.csv`;
        const testsResultsPath = path.join(outputParsingResultPath, outputParsingName);

        const dataArray = [];

        for (let i = 0; i < rerunNumber; ++i) {
            const outputName = `testOutput ${path.basename(test).split('.')[0]}_${i}.json`;
            const outputPath = path.join(parentFolderPath, outputName);

            try {
                const data = await fs.promises.readFile(outputPath, 'utf8');
                const testResults = JSON.parse(data);

                if (testResults && typeof testResults === 'object') {
                    const numFailedTests = testResults.numFailedTests;
                    const numPassedTests = testResults.numPassedTests;

                    const failedTestNames = testResults.testResults
                        .filter(testResult => testResult.status === 'failed')
                        .map(testResult => testResult.fullName);
                    // console.log(failedTestNames);

                    const dataString = `${path.basename(test).split('.')[0]}, #passed ${numPassedTests},  #failed ${numFailedTests}, ${failedTestNames}`;
                    dataArray.push(dataString);
                } else {
                    console.error('Jest output is not in the expected JSON format.');
                    console.log('Jest Output:', data);
                }
            } catch (error) {
                console.error('Error reading or parsing JSON file:', error);
            }
        }

        const csvData = dataArray.join('\n');

        try {
            await fs.promises.writeFile(testsResultsPath, csvData);
            console.log('CSV file has been written successfully.');
        } catch (err) {
            console.error('Error writing CSV:', err);
        }
    }
}
