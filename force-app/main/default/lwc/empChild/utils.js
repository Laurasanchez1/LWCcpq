//Function to check error conditions of a product rule
const conditionsCheck = (errorConditions, quote, conditionsMet, qlTypeObject) => {
    //console.log('entered conditions');
    const lines = quote.lineItems;
    //console.log(lines);
    const lineResults=[];
    for(let line of lines){
        const rawResults= errorConditions.map(condition=>{
            //console.log('Condition')
            //console.log(condition);
            //Check condition object to test
            if(condition['SBQQ__TestedObject__c']== 'Quote Line'){
                //Formula fields ignore (beware of the exceptions on the wire function object)
                if(qlTypeObject[condition['SBQQ__TestedField__c']]==true ){
                    //console.log('No support on formula fields');
                    return false;   //Ignore error condition
                } else{       //Move on --> Not a formula field to ignore
                    return operatorConverter([line.record[condition['SBQQ__TestedField__c']],condition['SBQQ__FilterValue__c']],condition['SBQQ__Operator__c']);
                }
            }else if (condition['SBQQ__TestedObject__c'] =='Quote'){
                //HERE--- would go the same formula fields ignore but with the quoteTypeObject -- don't think it's neccesary for now
                return operatorConverter([quote.record[condition['SBQQ__TestedField__c']],condition['SBQQ__FilterValue__c']],condition['SBQQ__Operator__c'])
            } else{
                console.log('No support on different object product rules like options or atributtes');
            }
        })
        //check conditions on each line w conditions met
        if(conditionsMet == 'Custom'){
            console.log('No support on product rules with custom logic conditions met');
            lineResults.push(false); //The product rule will be ignored!
        } else{
            lineResults.push(operatorConverter(rawResults,conditionsMet));
        }
        //lineResults.push(operatorConverter(rawResults,conditionsMet));
    }
    //check line results with ANY because if any quote line covers the condition then the rule should trigger
    const prResult= operatorConverter(lineResults,"Any");
    return prResult;
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

export { operatorConverter, conditionsCheck }