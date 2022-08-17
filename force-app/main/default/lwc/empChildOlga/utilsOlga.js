//Function to check error conditions of a PRODUCT rule
const conditionsCheck = (errorConditions, quote, conditionsMet, evaluateQuoteLines) => {
    //console.log('entered conditions');
    const lines = evaluateQuoteLines.filter(ql=> !(ql['SBQQ__BundledQuantity__c']));   //doesn't considerate bundle childs
    //console.log(lines);
    const lineResults=[];
    for(let line of lines){

        //results of every condition inside each line
        const rawResults= errorConditions.map(condition=>{
            //console.log('Condition')
            //console.log(condition);
            //Check condition object to test
            if(condition['SBQQ__TestedObject__c']== 'Quote Line'){
                return operatorConverter([line[condition['SBQQ__TestedField__c']],condition['SBQQ__FilterValue__c']],condition['SBQQ__Operator__c']);
            }else if (condition['SBQQ__TestedObject__c'] =='Quote'){
                //HERE--- would go the same formula fields ignore but with the quoteTypeObject -- don't think it's neccesary for now
                return operatorConverter([quote.record[condition['SBQQ__TestedField__c']],condition['SBQQ__FilterValue__c']],condition['SBQQ__Operator__c'])
            } else{
                console.log('No support on different object product rules like options or atributtes');
            }
        })

        //check conditions on each line w conditions met --> consolidate rawResults to a simple quote line should trigger the rule?
        if(conditionsMet == 'Custom'){
            console.log('No support on product rules with custom logic conditions met');
            lineResults.push(false); //The product rule will be ignored!
        } else{
            lineResults.push(operatorConverter(rawResults,conditionsMet));
        }
    }

    //check the line result that triggers the rule
    const prResult= lineResults.indexOf(true);
    return prResult;  //returns -1 if no line triggers that rule
}

//Function to check price conditions on a PRICE rule
const priceConditionsCheck = (priceConditions,quote, conditionsMet) => {
    //console.log('Entered price conditions');
    const lines = quote.lineItems.filter(ql=> !(ql.record['SBQQ__BundledQuantity__c']));   //doesn't considerate bundle childs
    //console.log(lines);
    const lineResults=[];
    const sucessIndex=[];

    for(let line of lines){
        //console.log('line');
        //console.log(line);
        const rawResults = priceConditions.map(condition => {
            //console.log(condition);
            let operand1;  //Variable to store the tested field / formula  
            let operand2; //Variable to store the filter value /formula 

            //Retrieve the first value to compare --> depends on object and if its formula or value (no support on variables)
            if(condition['SBQQ__Object__c'] === "Quote Line"){
                condition['SBQQ__TestedFormula__c'] ? operand1 = formulaConverter(condition['SBQQ__TestedFormula__c'], 'QL', line, quote) : operand1 = line.record[condition['SBQQ__Field__c']];
            } else if (condition['SBQQ__Object__c'] === "Quote"){
                condition['SBQQ__TestedFormula__c'] ? operand1 = formulaConverter(condition['SBQQ__TestedFormula__c'], 'Q', line, quote) : operand1 = quote.record[condition['SBQQ__Field__c']];
            } else{
                console.log('Price conditions not supported for objects other than Quote or Quote Line');
                operand1= 'ignore';
            }
            //console.log('operand1 '+ operand1);


            //Retrieve the second value to compare can be a value or formula (no support on variables) --> then perform the condition check 
            if(condition['SBQQ__FilterType__c'] === 'Value'){
                operand2 = condition['SBQQ__Value__c']
            } else if(condition['SBQQ__FilterType__c'] === 'Formula'){
                condition['SBQQ__Object__c'] === "Quote Line" ? operand2 = formulaConverter(condition['SBQQ__FilterFormula__c'], 'QL', line, quote) : operand2 = formulaConverter(condition['SBQQ__FilterFormula__c'], 'Q', line, quote);
            }
            //console.log('operand2 '+ operand2);

            //Perform the comparing
            //console.log('list ' + [operand1, operand2]);
            //console.log('operator ' + condition['SBQQ__Operator__c']);
            return operatorConverter([operand1, operand2],condition['SBQQ__Operator__c']); 
        });

        //check conditions on each line w conditions met --> consolidate rawResults to a simple quote line should trigger the rule?
        if(conditionsMet == 'Custom'){
            console.log('No support on product rules with custom logic conditions met');
            lineResults.push(false); //The price rule will be ignored!
        } else{
            lineResults.push(operatorConverter(rawResults,conditionsMet));
        }
    }
    //console.log(lineResults);
    let i=-1;
    while ((i = lineResults.indexOf(true, i+1)) != -1){
        sucessIndex.push(i);
    }
    //console.log(sucessIndex);
    return sucessIndex;


}

const priceActionExecuter = (priceActions,quote,actionLines) =>{
    const lines=quote.lineItems.filter(line => !line.record['SBQQ__ProductOption__c']);
    console.log(lines);
    console.log('Action Lines');
    console.log(actionLines);
    const editedLines = priceActions.map(action => {
        if(action['SBQQ__TargetObject__c']=== "Quote Line"){
            console.log('Quote Line Action');
            for(let actLine of actionLines){
                console.log('Inside act line');
                console.log(actLine);
                console.log(lines[actLine]);
        
            }
        } else if (action['SBQQ__TargetObject__c']=== "Quote"){
            console.log('Quote Action');
            //how to handle this?? see examples
        } else {
            console.log('No support on Product Option Actions')
        }
    })

}

//Function to transpile a written formula 
const formulaConverter = (testedFormulaField, objectFlag, line, quote) => { 
    try{
        //console.log(testedFormulaField);
        // apply regex to create transpiled formula
        let fieldValues=[];
        const regex = /&&|\|\||<>|>=|<=|<|>|!=|==|&|!|=|\*|\+|-|\/|\|/g;
        const fields = testedFormulaField.split(regex).filter(el => el).map(el => el.trim());
        //console.log(fields);
        const operator = testedFormulaField.match(regex);
        let transpiledOperator=[];
        if(operator){
            for (let op of operator){
                if(op == '<>'){
                    transpiledOperator.push("!=")
                } else if (op == "=") {
                    transpiledOperator.push("==");
                }else if(op == '&'){
                    transpiledOperator.push("&&");
                } else if(op == '|'){
                    transpiledOperator.push("||");
                } else {
                    transpiledOperator.push(op);
                }
            }
        }
        //console.log(transpiledOperator);

        //convert fields to values
        if(objectFlag == 'QL'){
            fieldValues = fields.map(field => {if(typeof line.record[field] === 'undefined'){ return parseFloat(field)} else {return line.record[field]}});
        } else {fieldValues = fields.map(field => {if(typeof quote.record[field]=== 'undefined'){return parseFloat(field)} else {return quote.record[field]}});}
        //console.log(fieldValues);

        if(fieldValues.filter(el=> isNaN(el)).length){throw "Couldn't find value in formula" ;}

        //create a joined array
        let arrayFormula = [];
        for (let i=0; i < fieldValues.length; i++){
            arrayFormula.push(fieldValues[i]);
            if (transpiledOperator.length !== 0 && i <= transpiledOperator.length - 1) {
                arrayFormula.push(transpiledOperator[i]);
            }
        }
        //console.log(arrayFormula);

        const textTestedFormula = 'return ' + arrayFormula.join('');
        const transpiledTestedFormula = new Function(textTestedFormula);
        //console.log(transpiledTestedFormula)
        return transpiledTestedFormula();
    } catch (error) {
        console.log('Formula error');
        console.log(error);
        return 'ignore';
    }
}


//Function to compare a list with different operators.
const operatorConverter = (list,operator) => {
    const operations = {
        "equals" : (operand1, operand2) => {
            if(operand2 ==='false' || operand2 === 'False' || operand2 === 'FALSE'){
                operand2=0;
            } else if(operand2 ==='true' || operand2 === 'True' || operand2 === 'TRUE'){
                operand2=1;
            }
            return operand1 == operand2;
        },
        "not equals" : function (operand1, operand2) {
            if(operand2 ==='false' || operand2 === 'False' || operand2 === 'FALSE'){
                operand2=0;
            } else if(operand2 ==='true' || operand2 === 'True' || operand2 === 'TRUE'){
                operand2=1;
            }
            return operand1 != operand2;
        },
        "less than" : function (operand1, operand2) {
            return operand1 < operand2;
        },
        "less or equals" : function (operand1, operand2) {
            return operand1 <= operand2;
        },
        "greater than" : function (operand1, operand2) {
            return operand1 > operand2;
        },
        "greater or equals" : function (operand1, operand2) {
            return operand1 >= operand2;
        },
        "starts with" : function (operand1, operand2) {
            return operand1.startsWith(operand2);
        },
        "ends with" : function (operand1, operand2) {
            return operand1.endsWith(operand2);
        },
        "contains" : function (operand1, operand2) {
            return operand1.includes(operand2);
        },
        "All" : function (operand1, operand2) {
            return operand1 && operand2;
        },
        "Any" : function (operand1, operand2) {
            return operand1 || operand2;
        },
        "Custom" : function (operand1, operand2) {
            return console.log('No support on custom logic');
        }
    };
    return list.reduce(operations[operator]);
}

export { operatorConverter, conditionsCheck , priceConditionsCheck, priceActionExecuter }