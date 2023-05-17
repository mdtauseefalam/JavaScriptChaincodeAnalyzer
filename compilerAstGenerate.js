const { template } = require('@babel/core');
const { exec } = require('child_process');
const fs = require('fs');
const { graphviz } = require('node-graphviz');

// const filename = 'example.txt';topics(F1.4)Chaincodes\asset_transfer_ledger_chaincode.js
const fileName = 'Chaincodes\\ERC721Token.js';
const cmd = `npx google-closure-compiler --js ${fileName} --print_ast > asttt.dot`;

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
    // const fullFile = fs.readFile(fileName, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    // console.log("***************"+data.search("const updateTopic = async (url, token, peers, fcn, topic_id, message) => {"))
    
    const lines = data.split('\n');
    const startTime = Date.now(); //FOR TIME RECORD OF CALL GRAPH GENERATION
    const startUsage = process.memoryUsage().heapUsed;
    
    for (const line of lines) {
      if(line.search("async")>=0 && line.search("=>") <=0){
        // console.log(line+"$$$$$$$$$async$$$$$$$$$$")
        // exp = "/" + line.trim + "/g"
        // console.log("INDEX--> "+ Boolean(fullFile.match(exp)))
        let CFnam = identifyContractFunctionsName(line);        
        functionNames[CFnam] = line.trim();
        // count++;
      }
      if ((line.search("=>") >=0 && line.search("const") >=0)){
        let HFnam = identifyHelperFunctionsName(line);
        functionNames[HFnam] = line.trim();
        // count++;
      }
      
      if (line.search("stub.") >= 0 && line.indexOf("(stub") < 0){
        let ln = line.trim();
        const start = ln.indexOf("stub.");
        const end = ln.indexOf("(",start);
        let len = "stub.".length
        const InBltName = ln.substring(start+len,end);
        // if( InBltName in Object.keys(functionNames)){
        chaincodeInbuiltFn[ln] = InBltName;        
        // functionNames[InBltName] = ln;
        // console.log(InBltName);
        // count++;
      }
      // console.log(line + "@#@#");
    }
    console.log(count);
    console.log("ALL FUNCTIONS ARE\n");
    console.log(functionNames);
    // console.log("ALL In built FUNCTIONS ARE\n");
    // console.log(chaincodeInbuiltFn);
    extractImpFunctionValues(functionNames);
    console.log("&&&&&&&&&&&&&&&&&&&");

 
    
    // console.log(Object.keys(functionNames));
    for (const key of Object.keys(functionNames)){
    //   console.log( key + "##TEST##");    
      let func = createIndividualFunctions(data, key, functionNames);
      console.log("^^^^^^^^^^^^^^^^");
      console.log(func);
      console.log("^^^^^^^^^^^^^^^^"); 
      // Now when we will pass this details we should get the called function as its children
      // we will store it in map where children will be of array type.
      //we will also include stub related functions.
      createCallGraph(func, key, functionNames, chaincodeInbuiltFn);

      // console.log("CALL GRAPH TADATADA HO GYA!!!!")
      // console.log(callGraph);
    }
    const endTime = Date.now();
    const endUsage = process.memoryUsage().heapUsed;
    console.log("CALL GRAPH TADATADA HO GYA!!!!");
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
  // let endIndex = temp[1].indexOf('=');
  let name = temp[1]
  count++;
  // console.log("NAMEEEEEE"+ name);
  // console.log(lineVar+"$$$$$$$$$async$$$$$$$$$$");
  return name;
}

// function identifyInbuiltFunctionsName(lineVar){

//   // Identify using "stub." and Extract uptill "("
//   // But use this after all functions Name is extracted from source code.
//   console.log(lineVar+"$$$$$$$$$async$$$$$$$$$$");
// }

function createIndividualFunctions(sourceCode, startOfFunctionName, allFunctionsName)
{
  // Traverse from starting of file and reach to startOfFunction point.
  // sourceCode.matchAll(startOfFunctionName)
  let keys = Object.keys(allFunctionsName);
  let nextIndex = keys.indexOf(startOfFunctionName) +1;
  let nextItem = keys[nextIndex];
  let startIndex = sourceCode.indexOf(allFunctionsName[startOfFunctionName]);
  let endIndex;
  const allLines = sourceCode.trim().split('\n');
  if(nextItem === undefined ){
    // console.log("THE LAST LINE: "+allLines.slice(-1));
    endIndex = sourceCode.indexOf(allLines.slice(-1));    
  }
  else{
    endIndex = sourceCode.indexOf(allFunctionsName[nextItem]);
  }
  // console.log("INDEXXXXXStart---> " + startIndex + "For----"+startOfFunctionName);
  // console.log("INDEXXXXXEnd---> " + endIndex + "For----"+ nextItem);

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

    // delete temp;
}

function extractImpFunctionValues(functionName){
  for (let f in functionName){
    // console.log(functionName[f]);
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
        // console.log("CALL GRAPH KEY :->"+k)
        let value = callGraph[k];
        // console.log("VALUE ->->" + value);
        value.forEach((val) => {
          // if url word is present it is external function
          if (val !== k){
            // console.log("VAL->" + val);
            let prexp = '';
            let t = functionNames[val];
            // console.log("TTTTTTTT "+ t);
            // val = val + "()";
            if(t !== undefined){
              if(t.indexOf("(url") >= 0){
                prexp = val + ' [fillcolor=moccasin, style="rounded,filled", shape=box, color=red] ; \n';  
              }}
            else{
                prexp = val + ' [fillcolor=lightyellow, style="rounded,filled", shape=box, color=red] ; \n';
            }            
            exp = k + ' -> ' + val + ';';
            // console.log("EXPRESSIONS-----***  "+ exp);
            temp = temp + prexp + exp + '\n';
          }
        });         
    });
    temp += '}';
    console.log(temp);
    graphviz.circo(temp, 'svg').then((svg) => {
      // Write the SVG to file
      fs.writeFileSync('OutputGraph/graph.svg', svg);
    });
}




