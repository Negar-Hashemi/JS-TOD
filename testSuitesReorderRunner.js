const fs = require('fs');

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
const shuffleNumber = argv.reorder || 10;

//
// run tests with shuffleNumber of unique random orders
// if the number of all combinations of the tests is less than or equal to the shuffleNumber
// then it runs all possible combinations
//

//project path
const projectPath = argv.project_path;
const absolutePath = path.resolve(projectPath);


const absolutePathSequencer = path.resolve('../JS-TOD/customSequencer.js')


try {
  const output = execSync(`cd ${absolutePath} && npm install`);
} catch (error) {
  console.error(`1. Error reading file: ${error.message}`);

}

//all the tests of project
const tests = listtests(projectPath);

const parentFolderPath = path.join(projectPath, "___extracted results test files___");
const testPathsTxt = path.join(parentFolderPath, "orders.txt");
fs.mkdirSync(parentFolderPath, (err) => {
  if (err && err.code !== 'EEXIST') {
    console.error(`Error creating folder: ${err}`);
  } else {
    console.log(err);
  }
});

runningDefaultOrder();

//shuffle the tests
const combinations = shuffleMultipleTimes(tests, shuffleNumber);

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

    
    } catch (error) {
      console.log(`Error running the order `+error);

    }
  }
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




