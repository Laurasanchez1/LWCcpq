import { LightningElement, api, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import read from '@salesforce/apex/myQuoteExample.read';
import save from '@salesforce/apex/myQuoteCalculator.save';
import queryCT from '@salesforce/apex/CustomerTierController.queryCT';
import queryPPT from '@salesforce/apex/ProductPricingTierController.queryPPT';
import queryBlockPrices from '@salesforce/apex/BlockPriceController.queryBlockPrices';
import queryAscendPackagingAdder from '@salesforce/apex/AscendPackagingAdderController.queryAscendPackagingAdder';
import queryUOM from '@salesforce/apex/UomConversionController.queryUOM';
import queryProductRules from '@salesforce/apex/ProductRuleController.queryProductRules';
import { onBeforePriceRules } from './qcp';
import { conditionsCheck } from './utils';
import hardcodedRules from './productRules';
//test to recalculate formulas
import wrapQuoteLine from '@salesforce/apex/ProductRuleController.wrapQuoteLine';

import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import QUOTELINE_OBJECT from '@salesforce/schema/SBQQ__QuoteLine__c';
import LENGTH_UOM_FIELD from '@salesforce/schema/SBQQ__QuoteLine__c.Length_UOM__c';
import uomDependencyLevel2List from '@salesforce/apex/QuoteController.uomDependencyLevel2List';

//APEX METHOD TO SHOW NSP FIELDS IN POP UP
import NSPAdditionalFields from '@salesforce/apex/QuoteController.NSPAdditionalFields';

const columns = [
    { label: 'Name', fieldName: 'SBQQ__ProductName__c' }, // References Quote_Line_Name__c in Sandbox
    { label: 'Description', fieldName: 'SBQQ__Description__c' },
    { label: 'Quantity', fieldName: 'SBQQ__Quantity__c', type: 'number', editable: true },
    { label: 'UOM', sortable: true, fieldName: 'UOM__c' , type: "button",
        typeAttributes: { label: { fieldName: 'UOM__c' }, name: 'changeUOM', value: { fieldName: 'UOM__C' }, iconPosition: 'right', variant: 'base', iconName: 'utility:chevrondown' }},
    { label: 'Length', fieldName: 'Length__c', type: 'text', editable: true},
    { label: 'Length UOM', sortable: true, fieldName: 'Length_UOM__c' , type: "button",
        typeAttributes: { label: { fieldName: 'Length_UOM__c' }, name: 'changeLengthUOM', value: { fieldName: 'Length_UOM__c' }, icPosition: 'right', variant: 'base', iconName: 'utility:chevrondown' }},
    { label: 'Discount (%)', fieldName: 'SBQQ__Discount__c', editable: true ,sortable: true, wrapText: false,type: 'number', hideDefaultActions: true },
    { label: 'List Unit Price', fieldName: 'SBQQ__ListPrice__c', type: 'currency' },
    { label: 'Special Price', fieldName: 'SBQQ__SpecialPrice__c', type: 'currency' },
    { label: 'Net Unit Price', fieldName: 'SBQQ__NetPrice__c', type: 'currency' },
    { label: 'Total', fieldName: 'SBQQ__NetTotal__c', type: 'currency' },
    { label: 'NSP', type: 'button-icon', initialWidth: 30,
        typeAttributes:{iconName: 'action:google_news', name: 'NSP', variant:'brand', size:'xxx-small'}},
    { label: 'Tiers', type: 'button-icon', initialWidth: 30,
        typeAttributes:{iconName: 'action:adjust_value', name: 'Tiers', variant:'brand', size:'xxx-small'}}
    // replace
];

const nspGroupings = ['ADSS Cable', 'Bus Conductor -Rectangular Bar', 'Bus Conductor -Seamless Bus Pipe', 'Bus Conductor -Universal Angle', 'Loose Tube Cable', 'Premise Cable'];

export default class EmpChild extends NavigationMixin(LightningElement) {

    @api quoteId;
    quote;
    flatLines = [];
    @track columns = columns;
    @track loading = true;
    tiers = [];
    prodTiers = [];
    pricingTierMap = [];
    ascendPackagingList = [];
    productRules = [];
    uomRecords = [];
    allowSave = false;

    connectedCallback(){
        const load = async() => {
            const quote = await read({quoteId: this.quoteId});
            this.quote = JSON.parse(quote);

            // Get array of Products with Block Pricing
            const blockProducts = this.quote.lineItems
                .filter(line => line.record['SBQQ__BlockPrice__c'])
                .map(line => line.record['SBQQ__Product__c']);
            const listBlockProducts = "('" + blockProducts.join("', '") + "')";
            
            // Query SF objects and set state
            const [ tiers,
                    prodTiers,
                    blockPrices,
                    ascendPackagingList,
                    uomRecords,
                    productRules
                ] = await Promise.all([
                    queryCT({accountId: this.quote.record['SBQQ__Account__c']}),
                    queryPPT({prodLevel1List: this.quote.lineItems.map(line => line.record['ProdLevel1__c'])}),
                    queryBlockPrices({listProduct: listBlockProducts}),
                    queryAscendPackagingAdder(),
                    queryUOM(),
                    queryProductRules()
                ]);
            this.tiers = tiers;
            this.prodTiers = prodTiers;
            this.blockPrices = blockPrices;
            this.ascendPackagingList = ascendPackagingList;
            this.productRules = productRules;
            this.uomRecords = uomRecords;

            const flatLines = this.quote.lineItems.filter(line => !line.record['SBQQ__ProductOption__c']).map(line => {
                return {
                    rowId: line['key'],
                    isNSP: nspGroupings.includes(line.record['Filtered_Grouping__c']) ? true : false,
                    ...line.record
                }
            });
            return flatLines;
        }
        
        load().then(flatLines => { this.flatLines = flatLines; this.loading = false; this.updateQuoteTotal(); console.log('Script loaded');});
      
    }

    //GETTING PICKLIST VALUES IN UOM/LENGTH UOM/ DEPENDENT ON LEVEL 2
    @wire(getObjectInfo, { objectApiName: QUOTELINE_OBJECT })
    objectInfo;
    @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: LENGTH_UOM_FIELD})
    lengthUom;

    //GETTING QUOTE LINE FORMULA FIELD DICTIONARY TO EXCLUDE FORMULA FIELDS IN PRODUCT RULES
    @wire(getObjectInfo, { objectApiName: QUOTELINE_OBJECT })
    quoteLineInfo({ data, error }) {
        if (data) {
            const dataTypes = Object.values(data.fields).map((fld) => {
                let { apiName, dataType, calculated } = fld;
                return { apiName, dataType, calculated };
            });
            this.qlTypeObject= dataTypes.reduce((obj, item) => Object.assign(obj, { [item.apiName]: item.calculated}), {});
            //Manually change the exceptions--> Formula fields you still want to calculate
            //To include a certain field on the product rule logic change it below (beware it could have unexpected results)
            this.qlTypeObject['SBQQ__ProductCode__c'] = 'product rules available';
            this.qlTypeObject['SBQQ__ProductFamily__c'] = 'product rules available';
            this.qlTypeObject['SBQQ__ProductName__c'] = 'product rules available';
            //console.log(this.qlTypeObject);
        }
    }
    
    handleCellChange(event) {
        // this handler could inform of changes that would not be saved
    }

 
    saveValues(event) {
        let lines = this.quote.lineItems;
        const minQtyLines=[];
        // console.log(lines)
        // Inspect changes
        event.detail.draftValues.forEach((row, index) => {
            // Obtain row id
            const rowId = row.id.substring(4);
            // Obtain list of fields that were changed
            const fieldList = Object.keys(row).filter(field => field !== 'id');
            if(!lines[rowId].parentItemKey){
                // Cycle through the fields that were changed
                for(let field of fieldList){
                    // change value of fields on that line
                    lines[rowId].record[field] = row[field];
                }
            }
            
            // BUNDLE LOGIC STARTS HERE --------
            // If line is a bundle parent
            if(lines[rowId].record['SBQQ__Bundle__c']) {
                // Cycle through products that come next
                for(let i = rowId; i < lines.length; i++){
                    // if product is a parent
                    if(lines[i].record['SBQQ__Bundle__c']){
                        continue;
                    }
                    // if product belongs to parent
                    if(lines[i].parentItemKey === lines[rowId].key){
                        // if is type 'component'
                        if(lines[i].record['SBQQ__OptionType__c'] === 'Component'){
                            // Adjust quantity accordingly
                            lines[i].record['SBQQ__Quantity__c'] = lines[rowId].record['SBQQ__Quantity__c'] * lines[i].record['SBQQ__BundledQuantity__c'];
                        }
                    } else {
                        break; // Stop cycling, reached the end of bundle
                    }
                }
            }
            
            // BUNDLE LOGIC ENDS HERE --------

            //MIN ORDER QTY LOGIC STARTS HERE
            //console.log("---Min Order Qty ---");
            if(lines[rowId].record['SBQQ__Quantity__c'] < parseInt(lines[rowId].record['Minimum_Order_Qty__c'])){
                //console.log('quantity is inferior that minimum')
                minQtyLines.push(parseInt(rowId)+1);
                lines[rowId].record['SBQQ__Quantity__c']=lines[rowId].record['Minimum_Order_Qty__c'];
            } else {
                //console.log('quantity ok!')
            }

        });  //End of for each loop

        if(minQtyLines.length!=0){
            const evt = new ShowToastEvent({
                title: 'Warning Fields', 
                message: 'The minimum quantity required has not been reached for line(s): ' + minQtyLines.join(','),
                variant: 'warning', mode: 'dismissable'
            });
            this.dispatchEvent(evt);
        }
        //MIN ORDER QTY LOGIC ENDS HERE

        this.regenerateFlatLines(0);

        // if(this.productRules.length !==0){
        //     //console.log('Product Rules exist');
        //     this.allowSave = this.productRuleLookup(this.productRules,this.quote);
        // }
        
    }

    @api
    calculate() {
        //test to see toast on save & calc
        if(this.productRules.length !==0){
            //console.log('Product Rules exist');
            this.allowSave = this.productRuleLookup(this.productRules,this.quote);
        }

        const lines = this.quote.lineItems;
        //PRODUCT RULE LOGIC STARTS HERE --------------------
        
        //Allowing to save if no validation product rules prevent it
        if(this.allowSave){
            console.log('saving...');
            // BLOCKPRICES LOGIC STARTS HERE -----------
            for(let line of lines){
                // Check if block price exists
                if(line.record['SBQQ__BlockPrice__c']){
                    for(let blockPrice of this.blockPrices){
                        // If block price belongs to produce in quote line
                        if(blockPrice['SBQQ__Product__c'] === line.record['SBQQ__Product__c']){
                            // If quantity in block
                            if(parseInt(line.record ['SBQQ__Quantity__c']) >= blockPrice['SBQQ__LowerBound__c'] && parseInt(line.record['SBQQ__Quantity__c']) < blockPrice['SBQQ__UpperBound__c']){
                                // Adjust prices accordingly
                                line.record['SBQQ__ListPrice__c'] = blockPrice['SBQQ__Price__c'];
                                line.record['SBQQ__SpecialPrice__c'] = blockPrice['SBQQ__Price__c'];
                            }
                        }
                    }
                }
            }
            // BLOCKPRICES LOGIC ENDS HERE -----------
            
            this.quote.lineItems = lines;

            this.loading = true;
            onBeforePriceRules(this.quote, this.ascendPackagingList, this.tiers, this.prodTiers, this.uomRecords)
            .then(newQuote => {
                this.quote = newQuote;
                this.regenerateFlatLines(500);
            });
            
        } else{
            console.log('No save --> Validation rule');
        }
        //PRODUCT RULE LOGIC ENDS HERE --------------------
    }

    handleCancel(event) {
        // read quote again
        this.loading = true;
        read({quoteId: this.quoteId})
        .then(quote => {
            const originalQuote = JSON.parse(quote);
            this.quote.lineItems = originalQuote.lineItems;
            this.loading = false;
        })
    }

    timeBeforeSave = 0;
    @api
    exit() {
        this.loading = true;
        save({ quoteJSON: JSON.stringify(this.quote) })
        .then(result => {
            //NAVIGATE TO RECORD PAGE 
            setTimeout(() => {
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: this.quoteId,
                        //objectApiName: this.objectApiName,
                        actionName: 'view'
                    },
                });
            }, 2000);
        });
        
    }

    dataRow;
    isLengthUomModalOpen = false;
    isUomModalOpen = false;
    nspShowMessage = false;
    handleRowAction(event) {
        this.dataRow = event.detail.row;
        switch(event.detail.action.name){
            case 'changeLengthUOM':
                this.searchLengthUomValues();
                this.isLengthUomModalOpen = true;
                break;

            case 'changeUOM':
                this.newUOM = '';
                this.searchUomValuesForProduct2();
                this.isUomModalOpen = true;
                break;

            case 'NSP':
                this.isNspModalOpen = true; 
                if(this.dataRow.isNSP){
                    this.nspShowMessage = true;
                    this.showNSPValues();
                } else {
                    this.showNSP = true;
                    this.nspShowMessage = false;
                }
                break;
            default:
            alert('There is an error trying to complete this action');    
        }
    }

    lengthUomList = [];
    searchLengthUomValues(){
        if(this.lengthUom.data.values){
            this.lengthUomList = this.lengthUom.data.values;
        } else {
            const evt = new ShowToastEvent({
                title: 'There is not lengthUom for this quote line',
                message: 'Please, do not change the Length UOM value, it is not available now.',
                variant: 'warning', mode: 'dismissable'
            });
            this.dispatchEvent(evt);
            this.closeLengthUomModal();
        }
    }

    uomList = [];
    searchUomValuesForProduct2(){
        
        if(this.dataRow['ProdLevel2__c'] != null && this.dataRow['ProdLevel2__c'] != ''){
            uomDependencyLevel2List({productLevel2 : this.dataRow['ProdLevel2__c']})
            .then((data)=>{
                //console.log('HERE UOM VALUES');
                let list = JSON.parse(data);
                let prodLevel2 = Object.getOwnPropertyNames(list);
                this.uomList = list[prodLevel2[0]];
            })
            .catch((error)=>{
                console.log(error);
                const evt = new ShowToastEvent({
                    title: 'There is a problem loading the possible values for the UOM value',
                    message: 'Please, do not edit UOM values now or refresh the UI to correct this mistake.',
                    variant: 'error', mode: 'dismissable'
                });
                this.dispatchEvent(evt);
            })
        } else {
            const evt = new ShowToastEvent({
                title: 'There is not Product level 2 for this quote line',
                message: 'The Product Level 2 is empty, the UOM value is not available',
                variant: 'warning', mode: 'dismissable'
            });
            this.dispatchEvent(evt);
            this.closeUomPopup();
        }
    }

    nspValues = [];
    nspOptions = []; 
    nspInputs = [];
    showNSP = false;
    properties = [];
    showNSPValues(){
        this.showNSP = false;
        NSPAdditionalFields({productId: this.dataRow['SBQQ__Product__c'] })
        .then( data => {  
            
            let listNspValues = JSON.parse(data); 
            let values = [];
            let labels = [];
            let types = [];
            let optionsP = [];

            for(let nsp of listNspValues){
                values.push({value: nsp.apiName, label: nsp.label});
                labels.push(nsp.label); 
                types.push(nsp.type); 
                optionsP.push(JSON.parse(nsp.options));
            }
            
            let prop = Object.getOwnPropertyNames(this.dataRow); 
            this.properties = [];

            for(let i=0; i < prop.length; i++){
                let ind = (values.findIndex(z => z.value == prop[i]));
                if(ind !== -1 ){
                    this.properties.push({key: this.dataRow.rowId, value: prop[i].toLowerCase(), property: prop[i], label: values[ind].label});
                }   
            }
            
            for(let i =0; i < this.properties.length; i++){
                this.nspValues.push({label: this.properties[i].label, value: this.dataRow[this.properties[i].property]});
                this.nspValues.sort((a, b) => (a.label > b.label) ? 1 : -1);
                if(types[i] == 'PICKLIST'){
                    this.nspOptions.push({apiName: values[i].value, label:labels[i], options: optionsP[i],}); 
                    this.nspOptions.sort((a, b) => (a.label > b.label) ? 1 : -1);
                } else {
                    this.nspInputs.push({label: labels[i],}); 
                    this.nspInputs.sort((a, b) => (a.label > b.label) ? 1 : -1);
                }
                
            }

            this.showNSP = true;
        })
        .catch((error)=>{
            console.log('NSP VALUES ERROR');
            console.log(error);
        })
    }

    closeLengthUomModal(){
        this.isLengthUomModalOpen = false;
    }

    closeUomModal(){
        this.isUomModalOpen = false;
    }

    isNspModalOpen = false;
    closeNsp(){
        if (this.nspShowMessage){
            let fieldsEmpty = 0;
            for(let i=0 ; i < this.properties.length; i++){
                let index = this.quote.lineItems.findIndex(x =>  x.key === this.properties[i].key);
                if (this.quote.lineItems[index].record[this.properties[i].property] == null){
                    fieldsEmpty++; 
                } 
            } 
            if(fieldsEmpty > 0){
                fieldsEmpty = 0; 
                const evt = new ShowToastEvent({
                    title: 'Some fields are missing.',
                    message: 'Please, fill in all NSP fields.',
                    variant: 'warning',
                    mode: 'dismissable'
                });
                this.dispatchEvent(evt);
            } else {
                this.isNspModalOpen = false; 
                this.nspValues = [];
                this.nspOptions = [];
                this.nspInputs = [];
            }
        } else {
            this.isNspModalOpen = false; 
            this.nspValues = [];
            this.nspOptions = [];
            this.nspInputs = [];
        }
        
    }

    // lengthUOM Modal handler
    newLengthUOM = '';
    lengthUomHandler(event){
        this.newLengthUOM = event.target.value;
    }

    // UOM Modal handler 
    newUOM = '';
    uomHandler(event){
        this.newUOM = event.target.value;
    }

    saveLengthUom(){
        //SPECIAL BEHAVIOR TO ADD LENGTH BASE VALUES
        // if (this.dataRow.ouping == 'Cable Assemblies' || this.dataRow.productType == 'Patch Panel - Stubbed'){
        //     this.dataRow.qlevariableprice = 'Cable Length';
        // } else {
        //     newQuotelines[i].qlevariableprice = null ;
        // }
        // if (!(this.dataRow.qlevariableprice == 'Cable Length')){
        //     this.newLengthUOM = 'NA';
        // }
        if(this.newLengthUOM === '' || this.newLengthUOM == null){
            console.log('No changes but save value.');
        } else {
            let index = this.quote.lineItems.findIndex(x =>  x.key === this.dataRow.rowId);
            console.log(index, this.newLengthUOM);
            this.quote.lineItems[index].record['Length_UOM__c'] = this.newLengthUOM;

            this.closeLengthUomModal();
            this.allowSave = this.productRuleLookup(this.productRules, this.quote);
            this.regenerateFlatLines(0);
        }
        
        // this.qcpScript();
    }

    saveUom(){
        if(this.newUOM === '' || this.newUOM == null){
            console.log('No changes but save value.');
        } else {
            let index = this.quote.lineItems.findIndex(x => x.key === this.dataRow.rowId);
            this.quote.lineItems[index].record['UOM__c'] = this.newUOM;
        }
        this.closeUomModal();
        this.regenerateFlatLines(0);
    }

    saveNSP(event){
        this.showNSP = false;
        let prop = event.target.name;
        let indProp = this.properties.findIndex(x => x.property === prop);
        let value = event.target.value;
        let index = this.quote.lineItems.findIndex(x => x.key === this.dataRow.rowId);
        if(index != -1 && indProp != -1){
            this.quote.lineItems[index].record[this.properties[indProp].property] = value; 
            setTimeout(()=>{ this.showNSP = true; }, 200);
            this.nspValues[this.nspValues.findIndex(x => x.label === event.target.label)].value = value;
        } else {
            //console.log('There is a problem finding the line selected.');
            const evt = new ShowToastEvent({
                title: 'Problem changing NSP values',
                message: 'The changes cannot be saved',
                variant: 'error',
                mode: 'dismissable'
            });
            this.dispatchEvent(evt);
        }
        this.regenerateFlatLines(0);
        
    }

    regenerateFlatLines(delay){
        // Regenerate flat lines object
        const flatLines = this.quote.lineItems.filter(line => !line.record['SBQQ__ProductOption__c']).map(line => {
            return {
                rowId: line['key'],
                isNSP: nspGroupings.includes(line.record['Filtered_Grouping__c']) ? true : false,
                ...line.record
            }
        });
        // Refresh component
        const randDelay = Math.floor(Math.random() * delay/2) + delay/2;
        setTimeout(() => {
            this.updateQuoteTotal();
            this.flatLines = flatLines;
            this.columns = [...columns];
            this.loading = false;
        }, randDelay);
    }

    updateQuoteTotal() {
        this.dispatchEvent(new CustomEvent('updatetotal', {
            bubbles: true,
            detail: this.quote.lineItems.reduce((o, line) => {
                return {
                    record: {
                        SBQQ__NetTotal__c: o.record['SBQQ__NetTotal__c'] + line.record['SBQQ__NetTotal__c']
                    }
                }
            })
        }));
    }

    priceOverride(lines) {

        console.log(lines)
        // Loop through lines
        const overridedLines = lines.map(line => {
            //if orginal price is different than net price
            if (line.record['SBQQ__OriginalPrice__c'] !== line.record['SBQQ__NetPrice__c']) {
                // Check the ‘Price Override Approval Required' field, and write 'Price Override Approval Required’ in the Approval Reasons field in the Quote Line Object
                line.record['Price_Override_Approval_Required__c'] = true;
                line.record['Approval_Reasons__c'] = 'Price Override Approval Required';
                console.log("Successfully overrided price");
                console.log("----Line record After Override----");
                console.log(line.record.SBQQ__ProductName__c)
                console.log(line.record)

            } else {
                //uncheck the ‘Price Override Approval Required' field
                line.record['Price_Override_Approval_Required__c'] = false;
                line.record['Approval_Reasons__c'] = '';
            }

            return line;
        })

        return overridedLines;
    }

    //Product Rule handling
    productRuleLookup(productRules, quote){  //The product rules already come sorted by evaluation order from the query

        //Test to recalculate formula fields
        // wrap quote line model records for conversion
        const quoteLines = quote.lineItems.map(line => {
        const { attributes, ...other } = line.record;
        return other;
        });
        console.log('Quote Lines');
        console.log(quoteLines);
        // recalculate formula fields
        wrapQuoteLine({qlJSON: JSON.stringify(quoteLines)})
        .then((data)=>{
            console.log('Called recalc function');
            console.log(data);
            this.evaluatedQuoteLines=data;
        })

        
        // // evaluate hardcoded rules first
        // const isRuleTriggered = hardcodedRules(quote);
        // if(isRuleTriggered){
        //     const evt = new ShowToastEvent(isRuleTriggered);
        //     this.dispatchEvent(evt);
        //     return false;
        // }

        console.log('Evaluated quote lines: ');
        console.log(this.evaluatedQuoteLines);
        //Validation Rules
        const valRules= productRules.filter(rule=> rule['SBQQ__Type__c']=='Validation');
        //console.log(valRules)
        if(valRules.length !==0){
            for(let valRule of valRules){
            const triggerRule = conditionsCheck(valRule['SBQQ__ErrorConditions__r'],quote,valRule['SBQQ__ConditionsMet__c'], this.qlTypeObject);
            if(triggerRule==true){
                const evt = new ShowToastEvent({
                    title: 'Product Rule Error',
                    message: valRule['SBQQ__ErrorMessage__c'],
                    variant: 'error', mode: 'sticky'
                });
                this.dispatchEvent(evt);
                return false;
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
                const triggerRule = conditionsCheck(alertRule['SBQQ__ErrorConditions__r'],quote, alertRule['SBQQ__ConditionsMet__c'], this.qlTypeObject);
                if(triggerRule==true){
                const evt = new ShowToastEvent({
                    title: 'Product Rule Alert',
                    message: alertRule['SBQQ__ErrorMessage__c'],
                    variant: 'warning', mode: 'dismissable'
                });
                this.dispatchEvent(evt);
                return true;
                }
            };
        }
        //console.log('no alert rules here');
        return true;
    }

}