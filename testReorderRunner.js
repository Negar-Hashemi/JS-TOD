const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const parser = require('@babel/parser');
const { isUtf8 } = require('buffer');
const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;

const argv = require('yargs')
    .options({
        'project_path': {
            describe: 'Path to the projectproject',
            demandOption: true, // Make this argument required
            type: 'string' // Specify the data type
        },
        'reorder': {
            describe: 'Number of reordering operations',
            type: 'number' // Specify the data type as number
        },
        'rerun': {
            describe: 'Number of rerun operations',
            type: 'number' // Specify the data type as number
        }
    })
    .argv;

const testKeywords = ['test', 'it'];
const astKeywords = ['describe', 'test', 'it'];
const runningCondition = ['beforeEach', 'afterEach', 'beforeAll', 'afterAll']
const rerunNumber = argv.rerun || 10;
const orderNumber = argv.reorder || 10;

const testsNumber = [];


//project path
const projectPath = argv.project_path;
const absolutePath = path.resolve(projectPath);
try {
    const output = execSync(`cd ${absolutePath} && npm install --force`);
} catch (error) {
    console.error(`1. Error reading file: ${error.message}`);

}

// Read the test suite file
const testSuites = listtests(projectPath);


// Create the folder if it doesn't exist
const parentFolderPath = path.join(projectPath, "___extracted results___");
const testPathsTxt = path.join(parentFolderPath, "testPaths.txt");
fs.mkdirSync(parentFolderPath, (err) => {
    if (err && err.code !== 'EEXIST') {
        console.error(`Error creating folder: ${err}`);
    } else {
        console.log(err);
    }
});

runningDefaultOrder();

try {
    fs.writeFileSync(testPathsTxt, "");
    for (const testSuite of testSuites) {

        // Parse the test suite code
        const testSuiteCode = fs.readFileSync(testSuite, 'utf-8')

        const ast = parser.parse(testSuiteCode, {
            sourceType: 'module',
            plugins: ['jsx'],
        });
        testsNumber.length = 0;
        extracteTestsNumbers(ast);
        
        let all = 1;
        for (let i = 0; i < testsNumber.length; ++i) {
            all *= factorial(testsNumber[i]);
        }

        
        // reordering the tests orderNumber times
        let reorderNumber = orderNumber >= all ? all : orderNumber;
        let i = 0;
        while (i < reorderNumber) {
            console.log(`\n ${i} *************************`)
            const result = traverseDescribe(ast);
            // definign the folder name for saving the result of running tests
            const fileName = path.basename(testSuite).split('.');
            const folderName = fileName[0];
            let postfix;
            if (fileName.length == 3) {
                postfix = '.' + fileName[1] + '.' + fileName[2];
            } else if (fileName.length == 2) {
                postfix = '.test.' + fileName[1];
            } else {
                postfix = '.test.js'
            }
            if (isUnique(result, testSuite, path.join(path.dirname(testSuite), folderName), i, postfix)) {

                // defining the file name for saving the tests results
                const filePath = path.join(path.dirname(testSuite), folderName + i.toString() + postfix);
                fs.appendFileSync(testPathsTxt, filePath + "\n");
                console.log(result);
                fs.writeFileSync(filePath, result, (err) => {
                    if (err) {
                        console.error(`Error writing to file: ${err}`);
                    } else {
                        console.log(`File "${filePath}" created and written successfully.`);
                    }
                });
                ++i;
            }
        }
    }

    // Read the tests to run
    const fileContent = fs.readFileSync(testPathsTxt, 'utf8');

    runningTests(fileContent);
    // countingTests();

} catch (error) {
    // Handle any errors, such as file not found or permission issues
    console.error(`2. Error reading file: ${error.message}`);

}


function extracteTestsNumbers(describeNode) {
    const describes = [];
    const testNodes = [];
    const testCode = generator(describeNode).code;
    const ast = parser.parse(testCode, {
        sourceType: 'module',
        plugins: ['jsx'],
    });

    //extracted the tests, variables, and describes
    traverse(ast, {
        CallExpression(path) {
            if (path.node.callee.type === 'Identifier') {
                if (path.node.callee.name === `describe`) {
                    describes.push(path.node);
                }
            }
            if (path.node.callee.type === 'Identifier') {
                if (testKeywords.includes(path.node.callee.name)) {
                    testNodes.push(path.node);
                }
            }
        },

        Function(innerPath) {
            innerPath.skip(); //checking the children is irrelevant
        }
    });

    if (testNodes.length > 1) {
        testsNumber.push(testNodes.length);
    }

    if (describes.length > 0) {
        for (let i = 0; i < describes.length; ++i) {

            //recall for nested describes
            extracteTestsNumbers(describes[i].arguments[1].body);

        }
    }
}

//return reordered tests inside describes for a given test suite
function traverseDescribe(describeNode) {
    const describes = [];
    const variables = [];
    const imports = [];
    const functions = [];
    const classes = [];
    const testNodes = [];
    const testEach = [];
    const testCode = generator(describeNode).code;
    const ast = parser.parse(testCode, {
        sourceType: 'module',
        plugins: ['jsx'],
    });

    //extracted the tests, variables, and describes
    traverse(ast, {
        CallExpression(path) {
            if (path.node.callee.type === 'Identifier') {
                if (path.node.callee.name === `describe`) {
                    describes.push(path.node);
                }
            }
            if (path.node.callee.type === 'Identifier') {
                if (testKeywords.includes(path.node.callee.name)) {
                    testNodes.push(path.node);
                }
            }
            if (path.node.callee.type === 'MemberExpression') {
                if (path.node.callee.object.name === `jest` || path.node.callee.object.name === `expect`) {
                    variables.push(path.node);
                }
            }

            if (path.node.callee.type === 'Identifier') {
                if (path.node.callee.name === `configure`) {
                    variables.push(path.node);
                }
            }
            

            if (path.node.callee.type === 'Identifier') {
                if (runningCondition.includes(path.node.callee.name)) {
                    testEach.push(path.node);
                }
            }

            if (path.node.callee.type === 'MemberExpression') {
                if (path.node.callee.object.name === `test`) {
                    testEach.push(path.node);
                }
            }

            if (path.node.callee.type === 'CallExpression') {
                if (path.node.callee.callee.type === 'MemberExpression' && path.node.callee.callee.property.name === `each`) {
                    testEach.push(path.node);
                }
            }
        },

        ImportDeclaration(path) {
            imports.push(path.node)
        },

        FunctionDeclaration(path) {
            functions.push(path.node)
        },

        ClassDeclaration(path) {
            classes.push(path.node)
        },

        VariableDeclaration(path) {
            if (path.type === 'VariableDeclaration') {

                variables.push(path.node)

            }

        },
        Function(innerPath) {
            innerPath.skip(); //checking the children is irrelevant
        }
    });
    let output = "";
    if (imports.length > 0) {
        for (const importItem of imports) {
            output += generator(importItem).code + "\n";
        }
    }
    // output += "{ \n"
    // adding variable decleration block
    for (const variable of variables) {
        output += generator(variable).code + "\n";
    }

    for (const functionItem of functions) {
        output += generator(functionItem).code + "\n";
    }

    for (const classItem of classes) {
        output += generator(classItem).code + "\n";
    }

    for (const testEachItem of testEach) {
        output += generator(testEachItem).code + "\n";
    }

    let reorderTests = [];
    testsNumber.push(testNodes.length);
    // if the number of tests is more than 1, add tests with different order
    if (testNodes.length > 1) {
        reorderTests = shuffleMultipleTimes(testNodes, 1);
    } else {
        output += generator(testNodes[0]).code + " \n";
    }
    for (let i = 0; i < reorderTests.length; ++i) {
        for (let j = 0; j < testNodes.length; ++j)
            // traverseDescribe(testNodes[i][1]);
            output += generator(reorderTests[i][j]).code + " \n";
    }
    if (describes.length > 0) {

        for (let i = 0; i < describes.length; ++i) {
            output += "describe(' ', () => { \n"
            //recall for nested describes
            output += traverseDescribe(describes[i].arguments[1].body);
            output += "}); \n"
        }

    }

    // output += "\n }"
    return output;
}


// return all test suites of a given project
function listtests(projectPath) {
    try {
        const address = 'cd ' + absolutePath;
        const command = address + ' && ' + `npx jest --listTests`;

        const output = execSync(command);
        var string = new TextDecoder().decode(output);
        console.log(`------------------listtests--------${isArrayString(string)}`)
        if (!isArrayString(string)){
        // convert the list of tests into an array of string 
        
        const arr = string.split(/\r?\n/);
        arr.pop();

        return (arr)
        }else{
            return JSON.parse(string);
        }

    } catch (err) {
        console.log(err);
    }
}

function isArrayString(input) {
    // Trim the input to remove extra spaces
    const trimmedInput = input.trim();
    
    // Check if the input starts with [ and ends with ]
    if (trimmedInput.startsWith('[') && trimmedInput.endsWith(']')) {
        try {
            // Try to parse the string as JSON
            const parsed = JSON.parse(trimmedInput);
            
            // Check if the parsed result is an array
            return Array.isArray(parsed);
        } catch (e) {
            // If JSON parsing fails, it is not a valid array
            return false;
        }
    }
    return false;
}


function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// return the result of comparision of two arrays
function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}

function getPermutationss(arr) {
    const result = [];
    const n = arr.length;
    const c = new Array(n).fill(0);
    result.push([...arr]);

    let i = 0;
    while (i < n) {
        if (c[i] < i) {
            if (i % 2 === 0) {
                [arr[0], arr[i]] = [arr[i], arr[0]]; // Swap elements
            } else {
                [arr[c[i]], arr[i]] = [arr[i], arr[c[i]]]; // Swap elements
            }
            result.push([...arr]);
            c[i]++;
            i = 0;
        } else {
            c[i] = 0;
            i++;
        }
    }

    return result;
}


// shuffle items of input array for r times
function shuffleMultipleTimes(arr, r) {
    const result = [];
    const length = arr.length;
    let n = 1;

    for (let i = 2; i <= length; i++) {
        n = n * i;
    }

    if (r >= n) {
        return getPermutationss(arr)
    } else {
        while (result.length < r) {
            const shuffledArray = shuffleArray([...arr]); // Create a copy of the array to avoid modifying the original

            // Check if the shuffled array is already in the result array
            if (!result.some((array) => arraysAreEqual(array, shuffledArray))) {
                result.push(shuffledArray);
            }
        }

        return result;
    }
}

// running test in default order and save the results
function runningDefaultOrder() {
    const parentFolderAbsolute = path.resolve(parentFolderPath);
    const outputName = `testOutput DefaultOrder.json`;

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


// running a test suite in given path
function runningTests(testPaths) {
    // Split the file content into an array by newline character
    const testsAddress = testPaths.split('\n');
    testsAddress.pop();


    for (const test of testsAddress) {
        for (let i = 0; i < rerunNumber; ++i) {
            // Define the output file path
            const parentFolderAbsolute = path.resolve(parentFolderPath);
            const outputName = `testOutput ${path.basename(test).split('.')[0]}_${i}.json`;

            const outputPath = path.join(parentFolderAbsolute, outputName);
            
            // Construct the command sequence
            const commandSequencer = `cd "${absolutePath}" && npx jest --verbose "${test}" --json --outputFile="${outputPath}"`;

            console.log(commandSequencer);

            try {
                // Execute the command
                const output = execSync(commandSequencer, { encoding: 'utf-8' });

            } catch (error) {
                console.error(`Error executing the command: ${error.message}`);
            }

        }
    }

}


function isUnique(result, originalPath, filePath, i, postfix) {
    const file = path.join(filePath + postfix);
    const testSuiteCode = fs.readFileSync(originalPath, 'utf-8');
    if (result === testSuiteCode) {
        return false;
    }

    for (let j = 0; j < i; ++j) {
        const file = path.join(filePath + j.toString() + postfix);
        const testSuiteCode = fs.readFileSync(file, 'utf-8');
        if (result === testSuiteCode) {
            return false;
        }

    }

    return true;

}


function factorial(n) {
    if (n > 0) {
        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }
}

