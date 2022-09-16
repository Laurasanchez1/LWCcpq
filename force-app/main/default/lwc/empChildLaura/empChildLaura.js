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
import { onBeforePriceRules, onBeforePriceRulesBatchable } from './qcp';
import { conditionsCheck } from './utils';
import hardcodedRules from './productRules';  //not used rn
import wrapQuoteLine from '@salesforce/apex/QuoteController.wrapQuoteLine';


import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import QUOTELINE_OBJECT from '@salesforce/schema/SBQQ__QuoteLine__c';
import LENGTH_UOM_FIELD from '@salesforce/schema/SBQQ__QuoteLine__c.Length_UOM__c';
import uomDependencyLevel2List from '@salesforce/apex/QuoteController.uomDependencyLevel2List';

//APEX METHOD TO SHOW NSP FIELDS IN POP UP
import NSPAdditionalFields from '@salesforce/apex/QuoteController.NSPAdditionalFields';

const columns = [
    { label: 'Name', fieldName: 'Quote_Line_Name__c' }, // References Quote_Line_Name__c in Sandbox
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
    allowSave = true;
    

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
            const [ 
                    tiers,
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
            
           console.log(this.quote)

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
            const localKey = this.flatLines[rowId].rowId;
            console.log('local key '+ localKey);

            // Obtain quote lines index
            const myIndex = lines.findIndex(ql => ql.key === localKey);
            console.log('my Index ' +myIndex);

            // Obtain list of fields that were changed
            const fieldList = Object.keys(row).filter(field => field !== 'id');
            if(!lines[myIndex].parentItemKey){
                // Cycle through the fields that were changed
                for(let field of fieldList){
                    // change value of fields on that line
                    lines[myIndex].record[field] = row[field];
                }
            }
            
            // BUNDLE LOGIC STARTS HERE --------
            // If line is a bundle parent
            if(lines[myIndex].record['SBQQ__Bundle__c']) {
                // Cycle through products that come next
                for(let i = myIndex; i < lines.length; i++){
                    // if product is a parent
                    if(lines[i].record['SBQQ__Bundle__c']){
                        continue;
                    }
                    // if product belongs to parent
                    if(lines[i].parentItemKey === lines[myIndex].key){
                        // if is type 'component'
                        if(lines[i].record['SBQQ__OptionType__c'] === 'Component'){
                            // Adjust quantity accordingly
                            lines[i].record['SBQQ__Quantity__c'] = lines[myIndex].record['SBQQ__Quantity__c'] * lines[i].record['SBQQ__BundledQuantity__c'];
                        }
                    } else {
                        break; // Stop cycling, reached the end of bundle
                    }
                }
            }
            
            // BUNDLE LOGIC ENDS HERE --------

            //MIN ORDER QTY LOGIC STARTS HERE
            //console.log("---Min Order Qty ---");
            if(lines[myIndex].record['SBQQ__Quantity__c'] < parseInt(lines[myIndex].record['Minimum_Order_Qty__c'])){
                //console.log('quantity is inferior that minimum')
                minQtyLines.push(parseInt(rowId)+1);  //row Id so the alert index matches the number displayed on datatable
                lines[myIndex].record['SBQQ__Quantity__c']=lines[myIndex].record['Minimum_Order_Qty__c'];
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

        //In case we want to evaluate product rules here!
        // if(this.productRules.length !==0){
        //     //console.log('Product Rules exist');
        //     this.allowSave = false;
        //     this.productRuleLookup(this.productRules,this.quote)
        //     .then(allowSave => {
        //         this.allowSave = allowSave;
        //         console.log('allow Save: '+this.allowSave);
        //     })
            
        // }
        
    }

    // this function triggers the calculation sequence locally
    // it checks the product rules, continues with the qcp script
    // and checks the price rules towards the end
    @api
    async calculate() {
        const lines = this.quote.lineItems;
        this.loading = true;

        //PRODUCT RULE LOGIC STARTS HERE --------------------
        if(this.productRules.length !==0){
            const beforeProdRules = window.performance.now();
            const allowSave = await this.productRuleLookup(this.productRules,this.quote);
            const afterProdRules = window.performance.now();
            console.log(`productRuleLookup waited ${afterProdRules - beforeProdRules} milliseconds`);
            this.allowSave = allowSave;            
        }
        
        //Allowing to save if no validation product rules prevent it
        if(this.allowSave==true){                                    //needs to be ==true so the event also dispatches here
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

            if (this.quote.lineItems.length <= 100){
                let startTime = window.performance.now();
                onBeforePriceRules(this.quote, this.ascendPackagingList, this.tiers, this.prodTiers, this.uomRecords)
                .then(newQuote => {
                    this.quote = newQuote;
                    this.regenerateFlatLines(500);
    
                    let endTime = window.performance.now();
                    console.log(`onBeforePriceRules waited ${endTime - startTime} milliseconds`);
                });
            }else{
                console.log('----------onBeforePriceRulesBatchable test---------------')
                let startTimeBatchable = window.performance.now();
                onBeforePriceRulesBatchable(this.quote, this.ascendPackagingList, this.tiers, this.prodTiers, this.uomRecords)
                .then(newQuote => {
                    this.quote = newQuote;
                    this.regenerateFlatLines(500);
    
                    let endTimeBatchable = window.performance.now();
                    console.log(`onBeforePriceRulesBatchable waited ${endTimeBatchable - startTimeBatchable} milliseconds`);
                });
    
            }

        
        } else if(this.allowSave == false){
            console.log('No save --> Wait for the rules to evaluate');
            const evt = new ShowToastEvent({
                title: 'Product Rule logic executing',
                message: 'This action is not available at this moment. Please, try again.',
                variant: 'info', mode: 'dismissable'
            });
            this.dispatchEvent(evt);

        } else{
            console.log('No save --> Validation rule');
            this.loading=false;
            this.dispatchEvent(this.allowSave);
        }
        //PRODUCT RULE LOGIC ENDS HERE --------------------
    }

    // this functions saves the quote record to the db
    // and navigates back to the quote record page
    @api
    exit() {
        this.loading = true;
        // use save API to update the quote
        console.log('quote')
        console.log(JSON.stringify(this.quote))
        console.log(this.quote)
        save({ quoteJSON: JSON.stringify(this.quote) })
        .then(result => {
            // redirect user to the quote record page
            setTimeout(() => {
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: this.quoteId,
                        actionName: 'view'
                    },
                });
            }, 2000);
        });
        
    }

    // this function clones the selected quote lines while maintaining
    // the existing relationships
    @api
    clonerows(){
        try{
            const rows = this.selectedRows;
            this.loading = true;
            for(let row of rows){
                // find the index of the element that matches the row Id
                let index = this.quote.lineItems.findIndex(ql => ql.key === row.rowId);
                // clone the quote line model with such index
                const clone = {...this.quote.lineItems[index]};
                // assign key with next highest value
                clone.key = Math.max(...this.quote.lineItems.map(o => o.key)) + 1;
                // remove identifiers pointing to the old record
                const { attributes, Id, ...other } = clone.record;
                // define new record data type
                clone.record = {attributes: {type: 'SBQQ__QuoteLine__c'}, ...other};
                // push cloned quote line into the collection
                this.quote.lineItems = [...this.quote.lineItems, clone];
                // if cloned record is a bundle
                if(clone.record['SBQQ__Bundle__c']){
                    const parentKey = clone.key;
                    // get all the children lines
                    const childrenQuoteLines = this.quote.lineItems.filter(ql => ql.parentItemKey === this.quote.lineItems[index].key);
                    for(let child of childrenQuoteLines){
                        // clone the child
                        const clone = {...child};
                        // assign next highest key
                        clone.key = Math.max(...this.quote.lineItems.map(o => o.key)) + 1;
                        // assign parent key to child record
                        clone.parentItemKey = parentKey;
                        // remove identifiers pointing to the old record
                        const { attributes, Id, ...other } = clone.record;
                        // define the new record data type
                        clone.record = {attributes: {type: 'SBQQ__QuoteLine__c'}, ...other};
                        // push cloned quote line into the collection
                        this.quote.lineItems = [...this.quote.lineItems, clone];
                    }
                }
            }
    
            this.regenerateFlatLines(1000);

            // send success toast notification
            const evt = new ShowToastEvent({
                title: 'Lines Cloned Successfully',
                variant: 'success',
                mode: 'dismissable'
            });
            this.dispatchEvent(evt);

        } catch (error) {
            console.log(error);
        }
    }

    // this function handles all the different row level actions coming
    // through the data table (set length uom, set uom, set nps,
    // and set overrides modals)
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

    // this function alerts the parent component if rows have been
    // selected on the data table
    handleRowSelection(event){
        //TO ALERT THAT A ROW HAS BEEN SELECTED
        if(event.detail.selectedRows.length == 0){
            this.selectedRows = [];
            this.dispatchEvent(new CustomEvent('rowunselected'));
        } else {
            this.dispatchEvent(new CustomEvent('rowselected'));
            this.selectedRows = event.detail.selectedRows;
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
            this.quote.lineItems[index].record['Length_UOM__c'] = this.newLengthUOM;
            
            this.closeLengthUomModal();
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

    // this function updates the net total amount on the parent component
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
                console.log(line.record.SBQQ__ProductName__c);
                console.log(line.record.Quote_Line_Name__c);
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
    async productRuleLookup(productRules, quote){  //The product rules already come sorted by evaluation order from the query

        let data = []

        // wrap quote line model records for conversion
        const quoteLines = quote.lineItems.map(line => {
        const { attributes, ...other } = line.record;
        return other;
        });
        //console.log('Quote Lines');
        //console.log(quoteLines);
        // recalculate formula fields

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
                // console.log(line)
                data = data.concat(line);
            })
        }

        const evaluateQuoteLines=data;
        // console.log(evaluateQuoteLines);

        //Validation Rules
        const valRules= productRules.filter(rule=> rule['SBQQ__Type__c']=='Validation');
        // console.log(valRules)
        if(valRules.length !==0){
            for(let valRule of valRules){const triggerRule = conditionsCheck(valRule['SBQQ__ErrorConditions__r'],quote,valRule['SBQQ__ConditionsMet__c'], evaluateQuoteLines);
                if(triggerRule!==-1){
                const evt = new ShowToastEvent({
                    title: 'Product Rule Error on line: '+ (parseInt(triggerRule)+1),
                    message: valRule['SBQQ__ErrorMessage__c'],
                    variant: 'error', mode: 'sticky'
                    });
                    this.dispatchEvent(evt);
                    //return the event to dispatch it when clicking save & calculate! 
                    // console.log(evt)
                    return evt;     
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
                this.dispatchEvent(evt);
                return true;
                }
            };
        }
        //console.log('no alert rules here');
        return true;
    }

    

  

    //Reorder Lines in Pop up by Product (Quote Line Name Field)
    @track dragStart;
    @track ElementList = []; 
    popUpReorder = false; 
    quotelinesLength = 0; 
    //When user clicks the reorder button
    @api
    reorderLines(){
        this.popUpReorder = true;
        //console.log(JSON.stringify( this.flatLines));
        this.ElementList = this.flatLines;
        this.quotelinesLength = this.ElementList.length;
        //console.log(JSON.stringify(this.ElementList));
    }
    //Close the reorder pop up
    closeReorder(){
        this.popUpReorder = false;
    }

    //Functions to reorder by drag and drop 

    DragStart(event) {
        this.dragStart = event.target.title;
        //console.log('Dragging');
        //console.log(this.dragStart);
        event.target.classList.add("drag");
    }
    DragOver(event) {
        event.preventDefault();
        return false;
    }
    Drop(event) {
        event.stopPropagation();
        const DragValName = this.dragStart;
        const DropValName = event.target.title;
        if (DragValName === DropValName) {
          return false;
        }
        const index = DropValName;
        const currentIndex = DragValName;
        const newIndex = DropValName;
        Array.prototype.move = function (from, to) {
          this.splice(to, 0, this.splice(from, 1)[0]);
        };
        this.ElementList.move(currentIndex, newIndex);
        //console.log(JSON.stringify(this.ElementList));
    }

    //When user wants to save the new order
    submitReorder(){
        this.flatLines = this.ElementList;
        //this.regenerateFlatLines(0);
        this.closeReorder();
        const evt = new ShowToastEvent({
            title: 'Table Reordered',
            message: 'Changes are successfully done',
            variant: 'success',
            mode: 'dismissable'
        });
        this.dispatchEvent(evt);
    }


}