const { template } = require('@babel/core');
const { exec } = require('child_process');
const fs = require('fs');
const { graphviz } = require('node-graphviz');


const fileName = process.argv[2];
const nameOutput = process.argv[3]; // for naming the output files
const cmd = `npx google-closure-compiler --js ${fileName} --print_ast > ASTOutputGraph\\${nameOutput}.dot`;

let count = 0;
const callGraph = {};
const impValues = {};
const functionNames = {};
let chaincodeInbuiltFn = {};

exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Error: ${stderr}`);
    return;
  }
  console.log(`Command output: AST GENERATED`);

  fs.readFile(fileName, 'utf8', (err, data) => {
  
    if (err) {
      console.error(err);
      return;
    }
    
    const lines = data.split('\n');
    const startTime = Date.now(); //FOR TIME RECORD OF CALL GRAPH GENERATION
    const startUsage = process.memoryUsage().heapUsed;
    
    for (const line of lines) {
      if(line.search("async")>=0 && line.search("=>") <=0){
        let CFnam = identifyContractFunctionsName(line);        
        functionNames[CFnam] = line.trim();
      }
      
      if ((line.search("=>") >=0 && line.search("const") >=0)){
        let HFnam = identifyHelperFunctionsName(line);
        functionNames[HFnam] = line.trim();
      }
      
      if (line.search("stub.") >= 0 && line.indexOf("(stub") < 0){
        let ln = line.trim();
        const start = ln.indexOf("stub.");
        const end = ln.indexOf("(",start);
        let len = "stub.".length
        const InBltName = ln.substring(start+len,end);
        chaincodeInbuiltFn[ln] = InBltName;        
      }
    }
    console.log(count);
    console.log("ALL FUNCTIONS ARE\n");
    console.log(functionNames);
    extractImpFunctionValues(functionNames);
    console.log("&&&&&&&&&&&&&&&&&&&");

    for (const key of Object.keys(functionNames)){
       
      let func = createIndividualFunctions(data, key, functionNames);
      console.log("^^^^^^^^^^^^^^^^");
      console.log(func);
      console.log("^^^^^^^^^^^^^^^^"); 
      // Now when we will pass this details we should get the called function as its children
      // we will store it in map where children will be of array type.
      //we will also include stub related functions.
      createCallGraph(func, key, functionNames, chaincodeInbuiltFn);
    }
    const endTime = Date.now();
    const endUsage = process.memoryUsage().heapUsed;
    console.log("CALL GRAPH Generated!!!!");
    console.log(callGraph);
    createDotFile(callGraph);
    // const endTime = Date.now();
    const elapsedTime = endTime - startTime; // calculate elapsed time in milliseconds
    console.log(`Elapsed time: ${elapsedTime} ms`);

    const memoryUsage = (endUsage - startUsage) / 1024 / 1024; // convert to MB
    console.log(`Memory usage: ${memoryUsage.toFixed(2)} MB`);
  });
});


function identifyContractFunctionsName(lineVar){
  lineVar = lineVar.trim();
  let temp = lineVar.split(' ');
  let endIndex = temp[1].indexOf('(');
  let name = temp[1].substring(0,endIndex)
  count++;
  return name;
}

function identifyHelperFunctionsName(lineVar){
  lineVar = lineVar.trim();
  let temp = lineVar.split(' ');
  let name = temp[1]
  count++;
  return name;
}


function createIndividualFunctions(sourceCode, startOfFunctionName, allFunctionsName)
{
  // Traverse from starting of file and reach to startOfFunction point.
  let keys = Object.keys(allFunctionsName);
  let nextIndex = keys.indexOf(startOfFunctionName) +1;
  let nextItem = keys[nextIndex];
  let startIndex = sourceCode.indexOf(allFunctionsName[startOfFunctionName]);
  let endIndex;
  const allLines = sourceCode.trim().split('\n');
  if(nextItem === undefined ){
    endIndex = sourceCode.indexOf(allLines.slice(-1));    
  }
  else{
    endIndex = sourceCode.indexOf(allFunctionsName[nextItem]);
  }
  return sourceCode.substring(startIndex,endIndex);
}


function createCallGraph(sourceCode, functionName, allContractFunctionsName, allInbiultFnName)
{
    let CFName = Object.keys(allContractFunctionsName);
    let IFName = Object.values(allInbiultFnName);
    const temp = [];
    CFName.forEach((cfname) => {
      let found = sourceCode.indexOf(cfname);
      if (found >= 0 && !(temp.includes(cfname))){
          temp.push(cfname);
          callGraph[functionName] = temp
      }
    });

    IFName.forEach((ifname) => {
      let found = sourceCode.indexOf(ifname);
      if (found >= 0 && !(temp.includes(ifname))){
          temp.push(ifname);
          callGraph[functionName] = temp
      }
    });
}

function extractImpFunctionValues(functionName){
  for (let f in functionName){
    let str = functionName[f];
    let start = str.indexOf("(");
    let end = str.indexOf(")");
    const param = str.substring(start+1, end);
    impValues[f] = param;
  }
  console.log("@@@@@@@@@@@");
  console.log(impValues);
}

function createDotFile(callGraph){
    let temp = 'digraph { \n node [fillcolor= aliceblue, fontcolor=black, fontsize=18, width=1, style ="rounded,filled", shape=box, color=blue]; \n edge [color=indigo]; \n';
    let key = Object.keys(callGraph);
    key.forEach((k) => {        
        let value = callGraph[k];
        value.forEach((val) => {
          // if url word is present it is external function
          if (val !== k){
            let prexp = '';
            let t = functionNames[val];
           
            if(t !== undefined){
              if(t.indexOf("(url") >= 0){
                prexp = val + ' [fillcolor=moccasin, style="rounded,filled", shape=box, color=red] ; \n';  
              }}
            else{
                prexp = val + ' [fillcolor=lightyellow, style="rounded,filled", shape=box, color=red] ; \n';
            }            
            exp = k + ' -> ' + val + ';';
            
            temp = temp + prexp + exp + '\n';
          }
        });         
    });
    temp += '}';
    console.log(temp);
    graphviz.circo(temp, 'svg').then((svg) => {
      // Write the SVG to file
      fs.writeFileSync(`OutputGraph/${nameOutput}Graph.svg`, svg);
    });
}




