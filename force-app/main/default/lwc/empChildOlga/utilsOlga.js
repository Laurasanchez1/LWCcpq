import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import wrapQuoteLine from '@salesforce/apex/QuoteController.wrapQuoteLine';

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
    return prResult;  //returns -1 if no line triggers that rule --> so not trigger at all
}

//Function to check price conditions on a PRICE rule
const priceConditionsCheck = (priceConditions,quote, conditionsMet) => {
    //console.log('Entered price conditions');
    const lines = quote.lineItems.filter(ql=> !(ql.record['SBQQ__BundledQuantity__c']));   //doesn't considerate bundle childs
    //console.log(lines);
    const lineResults=[];
    const sucessIndex=[];

    if (priceConditions){
        for(let line of lines){
            const rawResults = priceConditions.map(condition => {
                //console.log(condition);
                let operand1;  //Variable to store the tested field / formula  
                let operand2; //Variable to store the filter value /formula 

                let fieldAPI = labelsToAPI(condition['SBQQ__Field__c']); //function that checks if the field is a default value set by the object

                //Retrieve the first value to compare --> depends on object and if its formula or value (no support on variables)
                if(condition['SBQQ__Object__c'] === "Quote Line"){
                    condition['SBQQ__TestedFormula__c'] ? operand1 = formulaConverter(condition['SBQQ__TestedFormula__c'], 'QL', line, quote) : operand1 = line.record[fieldAPI];
                } else if (condition['SBQQ__Object__c'] === "Quote"){
                    condition['SBQQ__TestedFormula__c'] ? operand1 = formulaConverter(condition['SBQQ__TestedFormula__c'], 'Q', line, quote) : operand1 = quote.record[fieldAPI];
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
                } else {
                    console.log('No support on variables');
                    operand2= 'ignore';
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
    }
    return sucessIndex;


}

const priceActionExecuter = (priceActions,quote,actionLines) =>{
    const lines=quote.lineItems.filter(line => !line.record['SBQQ__ProductOption__c']);

    if(priceActions){
        //console.log(priceActions);
        priceActions.map(action => {
            let fieldAPI = labelsToAPI(action['SBQQ__Field__c']); //function that checks if the field is a default value set by the object
            if(action['SBQQ__TargetObject__c']=== "Quote Line"){
                for(let actLine of actionLines){
                    if(action['SBQQ__Value__c']){
                        let newVal = action['SBQQ__Value__c'];
                        newVal == "TRUE" || newVal == "True" || newVal == "true" ? newVal = true : newVal = newVal;
                        newVal == "FALSE" || newVal == "False" || newVal == "false" ? newVal = false : newVal = newVal;
                        lines[actLine].record[fieldAPI] = newVal;
                    } else if (action['SBQQ__ValueField__c']){
                        typeof lines[actLine].record[action['SBQQ__ValueField__c']] != 'undefined' ? lines[actLine].record[fieldAPI] = lines[actLine].record[action['SBQQ__ValueField__c']] : console.log('Price Action ignored --> source field invalid');
                    } else if (action['SBQQ__Formula__c']){
                        let formulaResult = formulaConverter(action['SBQQ__Formula__c'], 'QL',lines[actLine],quote);
                        formulaResult !== 'ignore' ? lines[actLine].record[fieldAPI] = formulaResult : console.log('Price Action ignored --> formula failed');
                    }
                }
            } else if (action['SBQQ__TargetObject__c']=== "Quote"){
                if(action['SBQQ__Value__c']){
                    let newVal = action['SBQQ__Value__c'];
                    newVal == "TRUE" || newVal == "True" || newVal == "true" ? newVal = true : newVal = newVal;
                    newVal == "FALSE" || newVal == "False" || newVal == "false" ? newVal = false : newVal = newVal;
                    quote.record[fieldAPI] = newVal;
                } else if (action['SBQQ__ValueField__c']){
                    typeof quote.record[action['SBQQ__ValueField__c']] != 'undefined' ? quote.record[fieldAPI] = quote.record[action['SBQQ__ValueField__c']] : console.log('Price Action ignored --> source field invalid');
                } else if (action['SBQQ__Formula__c']){
                    let formulaResult = formulaConverter(action['SBQQ__Formula__c'], 'Q',lines[0],quote);  //lines[0] just to send something.. the quote is what is needed in this case
                    formulaResult !== 'ignore' ? quote.record[fieldAPI] = formulaResult : console.log('Price Action ignored --> formula failed');
                }
            } else {
                console.log('No support on Product Option Actions')
            }
        })
    }
    //console.log(lines);
    //console.log(quote);

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

//Object to match labels to API names
const labelsToAPI = (label) => {
    let result = label;
    switch(label){
        //Price Rules conditions
        case 'Product Code':
            result = 'SBQQ__ProductCode__c';
            break;
        case 'Unit Price':
            result = 'SBQQ__ListPrice__c';
            break;
        case 'Discount (%)':
            result = 'SBQQ__OptionDiscount__c';
            break;
        case 'Discount (Amt)':
            result = '	SBQQ__OptionDiscountAmount__c';
            break;
        case 'Markup (%)':
            result = 'SBQQ__MarkupRate__c';
            break;
        case 'Markup (Amt)':
            result = 'SBQQ__MarkupAmount__c';
            break;
        default:
            result = label;       
    }
    return result;
}

//Product Rule handling
const productRuleLookup = async (productRules,quote) => {
    //The product rules already come sorted by evaluation order from the query

    //Initialize return variables
    let allowSave;
    let event;

    let data = []
    // wrap quote line model records for conversion
    const quoteLines = quote.lineItems.map(line => {
    const { attributes, ...other } = line.record;
    return other;
    });
    if (quoteLines.length <= 100){
        let startTime = window.performance.now();
        data = await wrapQuoteLine({qlJSON: JSON.stringify(quoteLines)});
        let endTime = window.performance.now();
        console.log(`wrapQuoteLine waited ${endTime - startTime} milliseconds`);
    }else{
        let linesSaver = [];
        let results = [];
        while (quoteLines.length > 0){
            const batchSize = 100;
            const linesBatch = quoteLines.splice(0, batchSize);
            linesSaver.push(linesBatch);
        }
        let startTime = window.performance.now();
        results = await Promise.all(linesSaver.map(lines => wrapQuoteLine({qlJSON: JSON.stringify(lines)})));
        let endTime = window.performance.now();
        console.log(`wrapQuoteLine with batches waited ${endTime - startTime} milliseconds`);
        results.forEach(line =>{
            data = data.concat(line);
        })
    }
    const evaluateQuoteLines=data;

    //Validation Rules
    const valRules= productRules.filter(rule=> rule['SBQQ__Type__c']=='Validation');
    //console.log(valRules)
    if(valRules.length !==0){
        for(let valRule of valRules){const triggerRule = conditionsCheck(valRule['SBQQ__ErrorConditions__r'],quote,valRule['SBQQ__ConditionsMet__c'], evaluateQuoteLines);
            if(triggerRule!==-1){
            const evt = new ShowToastEvent({
                title: 'Product Rule Error on line: '+ (parseInt(triggerRule)+1),
                message: valRule['SBQQ__ErrorMessage__c'],
                variant: 'error', mode: 'sticky'
                });
                
                allowSave = false;
                event = evt;
                return{
                    allowSave,
                    event
                }     
            }
        };
    } else {
    //console.log('no validation rules here');
    }

    //Alert Rules
    const alertRules= productRules.filter(rule=> rule['SBQQ__Type__c']=='Alert');
    //console.log(alertRules);
    if(alertRules.length !==0){
        for(let alertRule of alertRules){
            const triggerRule = conditionsCheck(alertRule['SBQQ__ErrorConditions__r'],quote, alertRule['SBQQ__ConditionsMet__c'], evaluateQuoteLines);
            if(triggerRule!==-1 ){
                const evt = new ShowToastEvent({
                    title: 'Product Rule Alert on line: '+ (parseInt(triggerRule)+1),
                    message: alertRule['SBQQ__ErrorMessage__c'],
                    variant: 'warning', mode: 'dismissable'
                });

                allowSave = true;
                event = evt;
                return{
                    allowSave,
                    event
                }  
            }
        };
    }
    //console.log('no alert rules here');
    allowSave = true;
    event = 'no event';
    return{
        allowSave,
        event
    } 
}

//Price Rule handling
const priceRuleLookup = (priceRules,quote) => {
    //console.log('entered price rule lookup');
    
    //Variable to store the lines for which each product rule evaluates
    let successLines = [];

    //QCP states that to prevent actions to change behavior on future evaluated rules they first evaluate all the price rules conditions 
    //And then executes actions  --> See "concurrent conditions info on" https://trailhead.salesforce.com/content/learn/modules/price-rules-in-salesforce-cpq/sequence-price-rules-for-correct-calculations
    
    //Evaluate all price rules conditions first
    for(let priceRule of priceRules){
        const conditionsSuccess = priceConditionsCheck(priceRule['SBQQ__PriceConditions__r'], quote, priceRule['SBQQ__ConditionsMet__c']);
        successLines.push(conditionsSuccess);
    }
    //console.log(successLines);

    //Execute all price actions
    if(successLines.length !== 0){
        for (let i=0; i < successLines.length; i++){
            let actionLines= successLines[i];
            let priceRuleExec = priceRules[i];
            priceActionExecuter(priceRuleExec['SBQQ__PriceActions__r'], quote, actionLines);
        }
    }
}

export { productRuleLookup , priceRuleLookup }