const fs = require('fs');

const { execSync } = require('child_process');
const path = require('path');

const argv = {
  project_path: process.env.JS_TOD_PROJECT_PATH,
  reorder: process.env.JS_TOD_REORDER ? parseInt(process.env.JS_TOD_REORDER,10) : undefined,
  rerun: process.env.JS_TOD_RERUN ? parseInt(process.env.JS_TOD_RERUN,10) : undefined
};
// Defaults if undefined (keep legacy defaults)
const orderNumber = Number.isInteger(argv.reorder) ? argv.reorder : 10;
const rerunNumber = Number.isInteger(argv.rerun) ? argv.rerun : 10;
const projectPath = argv.project_path;
if (!projectPath) { console.error('JS_TOD_PROJECT_PATH is required'); process.exit(2); }


// const rerunNumber = argv.rerun || 10;
const shuffleNumber = orderNumber;

//
// run tests with shuffleNumber of unique random orders
// if the number of all combinations of the tests is less than or equal to the shuffleNumber
// then it runs all possible combinations
//

const absolutePath = path.resolve(projectPath);


const absolutePathSequencer = path.resolve(__dirname, "../../lib/core/customSequencer.js");


try {
  const output = execSync(`cd ${absolutePath} && npm install`);
} catch (error) {
  console.error(`1. Error reading file: ${error.message}`);

}

//all the tests of project
const testSuites = listtests(projectPath);
if (!Array.isArray(testSuites) || testSuites.length === 0) {
  console.error('No test suites found or test list not loaded.');
  process.exit(1);
}


const parentFolderPath = path.join(projectPath, "___extracted results test files___");
const testPathsTxt = path.join(parentFolderPath, "orders.txt");
try {
  fs.mkdirSync(parentFolderPath, { recursive: true });
} catch (err) {
  console.error(`Error creating folder: ${err.message}`);
}


// runningDefaultOrder();

//shuffle the tests
const combinations = shuffleMultipleTimes(testSuites, shuffleNumber);

fs.writeFileSync(testPathsTxt, combinations.join(`\n`));


for (let j = 0; j < combinations.length; j++) {
  for (let i = 0; i < rerunNumber; ++i) {
    try {
      const parentFolderAbsolute = path.resolve(parentFolderPath);
      const outputName = `testOutput-${j}-${i}.json`;

      const outputPath = path.join(parentFolderAbsolute, outputName);
      //run tests with defined order and write the result in an output file
      const commandSequencer = `cd "${absolutePath}" && npx jest --runInBand --testSequencer=` + absolutePathSequencer + ` --order=` + combinations[j].toString() + ` --json --outputFile="${outputPath}"`;

      const output = execSync(commandSequencer);

// Args supplied by runner.js via env
const argv = {
  project_path: process.env.JS_TOD_PROJECT_PATH,
  reorder: process.env.JS_TOD_REORDER ? parseInt(process.env.JS_TOD_REORDER,10) : undefined,
  rerun:   process.env.JS_TOD_RERUN   ? parseInt(process.env.JS_TOD_RERUN,10)   : undefined
};

// Legacy defaults
const reorderNumber = Number.isInteger(argv.reorder) ? argv.reorder : 10;
const rerunNumber   = Number.isInteger(argv.rerun)   ? argv.rerun   : 10;
const projectPath   = argv.project_path;
if (!projectPath) { console.error('JS_TOD_PROJECT_PATH is required'); process.exit(2); }

    
    } catch (error) {
      console.log(`Error running the order `+error);

    }
  }
}



// return all test suites of a given project
function listtests(projectPath) {
  const p = process.env.JS_TOD_TEST_LIST_PATH;
  if (!p) return null;
  try {
    const txt = fs.readFileSync(p, 'utf-8');
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}


//return all possibel combination of input array items
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



// shuffle the items of arr
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




