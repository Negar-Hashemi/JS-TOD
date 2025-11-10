const TestSequencer = require('@jest/test-sequencer').default;


class CustomSequencer extends TestSequencer {

  sort(tests) {
    //get the running order and put it in orderPath array
    const orderPathString = process.argv.find ((arg)=>arg.startsWith("--order")).replace("--order=","");
    const orderPath = orderPathString.split(",");
       
    return tests.sort((testA, testB) => {
      const indexA = orderPath.indexOf(testA.path);
      const indexB = orderPath.indexOf(testB.path);

      if (indexA === -1 && indexB === -1) return 0; // Both tests not specified in orderPath, keep them in their original order

      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      const result = indexA - indexB;
      return result;
    });
  }

}



module.exports = CustomSequencer;
