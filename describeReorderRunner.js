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

const testKeywords = ['test', 'it'];
const astKeywords = ['describe', 'test', 'it'];
const runningCondition = ['beforeEach', 'afterEach', 'beforeAll', 'afterAll']
const rerunNumber = argv.rerun || 10;
const orderNumber = argv.reorder || 10;

const describesNumber = [];
const describesNodesLevel0 = [];
const describesNodesLevel1 = [];


//project path
const projectPath = argv.project_path;
const absolutePath = path.resolve(projectPath);
try {
  const output = execSync(`cd ${absolutePath} && npm install`);
} catch (error) {
  console.error(`1. Error reading file: ${error.message}`);

}

// Read the test suite file
const testSuites = listtests(projectPath);

// Create the folder if it doesn't exist
const parentFolderPath = path.join(projectPath, "___extracted results describes___");
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
    for (let testNumber = 0; testNumber < testSuites.length; ++testNumber){
    // for (const testSuite of testSuites) {
        const testSuite = testSuites[testNumber]
        // describesNodes.length = 0;
        describesNodesLevel0.length = 0
        describesNodesLevel1.length = 0

        console.log(`+++++++++++++++` + testSuite.toString())

        // Parse the test suite code
        const testSuiteCode = fs.readFileSync(testSuite, 'utf-8')

        const ast = parser.parse(testSuiteCode, {
            sourceType: 'module',
            plugins: ['jsx'],
        });

        // +++++++++++++++++++++++++++++++++++++++++++++++++++++++
        const arrayNodes = extracteDescribes(ast);
        for (const node of arrayNodes) {
            describesNodesLevel0.push(node);
        }

        for (const describeNode of describesNodesLevel0) {
            describesNodesLevel1.push(extracteDescribes(describeNode.arguments[1].body))
        }

        if (describesNodesLevel0.length == 0) {
            console.log("The test has no describe!")
        } else if (describesNodesLevel0.length == 1 && describesNodesLevel1[0].length <= 1) {
            console.log("The test has only one describe!")
        } else if (describesNodesLevel0.length == 1 && describesNodesLevel1[0].length > 1) {

            reorderSameDecsribesLevel1(testSuite, ast, orderNumber, 0, testNumber);

        } else {
            let all = 1;
            for (let i = 1; i <= describesNodesLevel0.length; ++i) {
                all *= i;
            }
            // reordering the tests orderNumber times
            let reorderNumber = orderNumber >= all ? all : orderNumber;
            console.log("describe node 0 lenght: " + describesNodesLevel0.length)
            reorderSameDecsribesLevel0(testSuite, ast, reorderNumber, testNumber)

            let remainReorderNumber = orderNumber - reorderNumber;
            let allReorderLevel1 = 0;
            for (const describeLevel1 of describesNodesLevel1) {
                allReorderLevel1 += factorial(describeLevel1.length)
            }
            allReorderLevel1 -= 1;
            reorderNumber = remainReorderNumber >= allReorderLevel1 ? allReorderLevel1 : remainReorderNumber;
            if (reorderNumber < orderNumber) {
                for (let i = 0; i < describesNodesLevel0.length; ++i) {
                    if (describesNodesLevel1[i] != 0) {
                        reorderNumber = reorderSameDecsribesLevel1(testSuite, ast, reorderNumber, i, testNumber)
                    }
                }
            } else {
                while (reorderNumber) {
                    let nodeNumber = Math.floor(Math.random() * (describesNodesLevel0.length - 1))
                    if (describesNodesLevel1[nodeNumber] != 0) {
                        reorderNumber = reorderSameDecsribesLevel1(testSuite, ast, reorderNumber, nodeNumber, testNumber)
                    }
                }
            }
        }

    }

    // Read the tests to run
    const fileContent = fs.readFileSync(testPathsTxt, 'utf8');

    runningTests(fileContent);
   
} catch (error) {
    // Handle any errors, such as file not found or permission issues
    console.error(`2. Error reading file: ${error.message}`);

}


function reorderSameDecsribesLevel1(testSuite, ast, reorderNumber, nodeNumber, testNumber) {
    let all = factorial(describesNodesLevel1[nodeNumber].length) - 1;

    // reordering the tests orderNumber times
    let reorder = reorderNumber >= all ? all : reorderNumber;

    let i = 0;
    while (i < reorder) {
        const result = shuffleDescribesLevel1(ast, nodeNumber);
        
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
        const n = nodeNumber + 1;
        if (isUnique(result, path.join(path.dirname(testSuite), folderName), i, n, postfix)) {

            // defining the file name for saving the tests results

            const filePath = path.join(path.dirname(testSuite), folderName + nodeNumber + n + testNumber.toString()+`_Describe` + i.toString() + postfix);
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
    return reorderNumber - reorder;
}



function reorderSameDecsribesLevel0(testSuite, ast, j,testNumber) {

    let i = 0;
    while (i < j) {
        const result = shuffleDescribesLevel0(ast);
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
        if (isUnique(result, path.join(path.dirname(testSuite), folderName), i, 0, postfix)) {

            // defining the file name for saving the tests results
            const filePath = path.join(path.dirname(testSuite), folderName + testNumber.toString()+`_0Describe` + i.toString() + postfix);
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


function shuffleDescribesLevel1(ast, nodeNumber) {

    const describes = [];
    const variables = [];
    const imports = [];
    const functions = [];
    const classes = [];
    const testNodes = [];
    const testEach = [];
    
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
                if (runningCondition.includes(path.node.callee.name)) {
                    testEach.push(path.node);
                }
            }

            if (path.node.callee.type === 'MemberExpression') {
                if (path.node.callee.object.name === `test`) {
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

    for (const testItem of testNodes) {
        output += generator(testItem).code + "\n";
    }

    for (let i = 0; i < nodeNumber; ++i) {
        output += generator(describes[i]).code + "\n";
    }


    if (numberInnerDescribe(describes[nodeNumber].arguments[1].body) < 2) {
        output += generator(describes[nodeNumber]).code + " \n";
    } else {
        output += `describe("${describes[nodeNumber].arguments[0].value}", () => { \n`
        output += shuffleDescribes(describes[nodeNumber].arguments[1].body)
        output += "}); \n"
    }

    for (let i = nodeNumber + 1; i < describes.length; ++i) {
        output += generator(describes[i]).code + "\n";
    }

    return output;

}

function shuffleDescribesLevel0(ast) {
    const describes = [];
    const variables = [];
    const imports = [];
    const functions = [];
    const classes = [];
    const testNodes = [];
    const testEach = [];
    

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
                if (runningCondition.includes(path.node.callee.name)) {
                    testEach.push(path.node);
                }
            }

            if (path.node.callee.type === 'MemberExpression') {
                if (path.node.callee.object.name === `test`) {
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

    for (const testItem of testNodes) {
        output += generator(testItem).code + "\n";
    }

    let reorderDescribes = [];
    describesNumber.push(describes.length);
    // if the number of tests is more than 1, add tests with different order
    if (describes.length > 1) {
        // if (orderMode == 0) {
        reorderDescribes = shuffleMultipleTimes(describes, 1);
        for (let i = 0; i < reorderDescribes.length; ++i) {
            for (let j = 0; j < describes.length; ++j)
                // traverseDescribe(testNodes[i][1]);
                output += generator(reorderDescribes[i][j]).code + " \n";
        }
        
    } 
    return output;
}


function extracteDescribes(describeNode) {
    const describes = [];
    const describesNodes = [];
    const testCode = generator(describeNode).code;
    const ast = parser.parse(testCode, {
        sourceType: 'module',
        plugins: ['jsx'],
    });
    //extracted the describes
    traverse(ast, {
        CallExpression(path) {
            if (path.node.callee.type === 'Identifier') {
                if (path.node.callee.name === `describe`) {
                    describes.push(path.node);
                }
            }
        },

        Function(innerPath) {
            innerPath.skip(); //checking the children is irrelevant
        }
    });

    if (describes.length > 0) {
        describesNumber.push(describes.length);
    }

    for (const describeNode of describes) {
        describesNodes.push(describeNode);
    }
    //   }
    return (describesNodes);
}


function numberInnerDescribe(describeNode) {
    const describes = []
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
        },
        Function(innerPath) {
            innerPath.skip(); //checking the children is irrelevant
        }
    });
    return describes.length;
}


function shuffleDescribes(describeNode) {
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
                if (runningCondition.includes(path.node.callee.name)) {
                    testEach.push(path.node);
                }
            }

            if (path.node.callee.type === 'MemberExpression') {
                if (path.node.callee.object.name === `test`) {
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

    for (const testItem of testNodes) {
        output += generator(testItem).code + "\n";
    }

    reorderDescribes = shuffleMultipleTimes(describes, 1);

    for (let i = 0; i < reorderDescribes.length; ++i) {
        for (let j = 0; j < describes.length; ++j)
            // traverseDescribe(testNodes[i][1]);
            output += generator(reorderDescribes[i][j]).code + " \n";
    }
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



function isUnique(result, filePath, i, n, postfix) {
   

    for (let j = 0; j < i; ++j) {
        const file = path.join(filePath + `0Describe` + j.toString() + postfix);
        if (fs.existsSync(file)) {
            const testSuiteCode = fs.readFileSync(file, 'utf-8');
            if (result === testSuiteCode) {
                return false;
            }
        }
    }

    for (let j = 0; j < i; ++j) {
        const file = path.join(filePath + n + `Describe` + j.toString() + postfix);
        if (fs.existsSync(file)) {
            const testSuiteCode = fs.readFileSync(file, 'utf-8');
            if (result === testSuiteCode) {
                return false;
            }
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
