import { LightningElement, api, track, wire } from 'lwc';
import read from '@salesforce/apex/myQuoteExample.read';
import calculate from '@salesforce/apex/myQuoteCalculator.calculate';
import queryCT from '@salesforce/apex/CustomerTierController.queryCT';
import queryPPT from '@salesforce/apex/ProductPricingTierController.queryPPT';
import queryBlockPrices from '@salesforce/apex/BlockPriceController.queryBlockPrices';
import queryAscendPackagingAdder from '@salesforce/apex/AscendPackagingAdderController.queryAscendPackagingAdder';


import {
    subscribe,
    unsubscribe,
    onError,
    setDebugFlag,
    isEmpEnabled,
} from 'lightning/empApi';

const columns = [
    { label: 'Name', fieldName: 'SBQQ__ProductName__c' },
    { label: 'Quantity', fieldName: 'SBQQ__Quantity__c', type: 'number', editable: true },
    { label: 'List Unit Price', fieldName: 'SBQQ__ListPrice__c', type: 'currency' },
    { label: 'Net Unit Price', fieldName: 'SBQQ__NetPrice__c', type: 'currency' },
    { label: 'Total', fieldName: 'SBQQ__NetTotal__c', type: 'currency' },
    { label: 'Length UOM', fieldName: 'Length_UOM__c', type: 'picklist', editable: true},
    { label: 'Length', fieldName: 'Length__c', type: 'text', editable: true}
];

export default class EmpChild extends LightningElement {

    @api quoteId;
    quote;
    flatLines = [];
    @track columns = columns;
    @track loading = true;
    subscription = {};
    channelName = '/event/Test__e';
    tiers = [];
    prodTiers = [];
    pricingTierMap = [];
    ascendPackagingList = [];


    connectedCallback(){
        const load = async() => {
            const quote = await read({quoteId: this.quoteId});
            this.quote = JSON.parse(quote);
            // Get array of Products with Block Pricing
            const blockProducts = this.quote.lineItems
                .filter(line => line.record['SBQQ__BlockPrice__c'])
                .map(line => {
                    return line.record['SBQQ__Product__c'];
                });
            const listBlockProducts = "('" + blockProducts.join("', '") + "')";
            const [tiers, prodTiers, blockPrices, ascendPackagingList] = await Promise.all([
                queryCT({accountId: this.quote.record['SBQQ__Account__c']}),
                queryPPT({prodLevel1List: this.quote.lineItems.map(line => {
                    return line.record['ProdLevel1__c']})
                }),
                queryBlockPrices({listProduct: listBlockProducts}),
                queryAscendPackagingAdder()
                ]);
            console.log(this.quote.lineItems)
            this.tiers = tiers;
            this.prodTiers = prodTiers;
            this.blockPrices = blockPrices;
            this.ascendPackagingList = ascendPackagingList;
            const flatLines = this.quote.lineItems.map(line => {
                return {
                    SBQQ__ProductName__c: line.record['SBQQ__ProductName__c'],
                    SBQQ__Quantity__c: line.record['SBQQ__Quantity__c'],
                    SBQQ__ListPrice__c: line.record['SBQQ__ListPrice__c'],
                    SBQQ__SpecialPrice__c: line.record['SBQQ__SpecialPrice__c'],
                    SBQQ__NetPrice__c: line.record['SBQQ__NetPrice__c'],
                    SBQQ__NetTotal__c: line.record['SBQQ__NetTotal__c'],
                    Length_UOM__c: line.record['Length_UOM__c'],
                    Length__c: line.record['Length__c']
                }
            });
            return flatLines;
        }
        
        load().then(flatLines => { this.flatLines = flatLines; this.loading = false; console.log('Script loaded');});
      
    }


    

    disconnectedCallback() {
        unsubscribe(this.subscription, (response) => {
            console.log('unsubscribe() response: ', JSON.stringify(response));
            // Response is true for successful unsubscribe
        });
    }

    registerErrorListener() {
        // Invoke onError empApi method
        onError((error) => {
            console.log('Received error from server: ', JSON.stringify(error));
            // Error contains the server-side error
        });
    }

    handleCellChange(event) {
        // this handler could inform of changes that would not be saved
    }

 
    saveValues(event) {
        let lines = this.quote.lineItems;
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
            console.log(lines)
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
        });
      
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
       

        lines = this.customerTierScript(this.tiers, this.quote);
        console.log(lines)
        this.quote.lineItems = lines;

        this.pricingTierMap = this.productPricingTierScript(this.prodTiers);

        
        
        console.log("----Price Override----");
        lines = this.priceOverride(this.quote.lineItems)

        console.log('-----------setCableAssemblyName-----------')
        lines = this.setCableAssemblyName(this.quote.lineItems, this.ascendPackagingList)
        console.log(lines)


        // Regenerate flat lines object
        const flatLines = this.quote.lineItems.map(line => {
            return {
                SBQQ__ProductName__c: line.record['SBQQ__ProductName__c'],
                SBQQ__Quantity__c: line.record['SBQQ__Quantity__c'],
                SBQQ__ListPrice__c: line.record['SBQQ__ListPrice__c'],
                SBQQ__SpecialPrice__c: line.record['SBQQ__SpecialPrice__c'],
                SBQQ__NetPrice__c: line.record['SBQQ__NetPrice__c'],
                SBQQ__NetTotal__c: line.record['SBQQ__NetTotal__c'],
                Length_UOM__c: line.record['Length_UOM__c'],
                Length__c: line.record['Length__c']

            }
        });
        // Refresh component
        const randDelay = Math.floor(Math.random() * 500) + 500;
        this.loading = true;
        setTimeout(() => {
            this.flatLines = flatLines;
            this.columns = [...columns];
            this.loading = false;
        }, randDelay);
    }




    timeBeforeSave = 0;
    saveAndCalculate() {
        calculate({ quoteJSON: JSON.stringify(this.quote) });
    }

    // Custom price calculation
    customerTierScript(tiers, quote) {

        // if the query returned rows then build the keys else we still need to set all lines to List.
        if (tiers?.length) {
            var customerTierObj = tiers.reduce((o, record) => Object.assign(o, { [record.Account__c + '~' + record.Prod_Level_1__c + '~' + record.Prod_Level_2__c]: record }), {});
        }

        //now loop through lines and first try to get the prod level 1 and prod level 2 specific , if not try to get prod level 1 specific , if not then List
        const tieredLines = quote.lineItems.map(line => {
            line.record['Tier__c'] = 'List';
            if (customerTierObj[quote.record['SBQQ__Account__c'] + '~' + line.record['ProdLevel1__c'] + '~' + line.record['ProdLevel2__c']]) {

                line.record['Tier__c'] = customerTierObj[quote.record['SBQQ__Account__c'] + '~' + line.record['ProdLevel1__c'] + '~' + line.record['ProdLevel2__c']].Tier__c;
                line.record['Customer_Tier_Additional_Discount__c'] = customerTierObj[quote.record['SBQQ__Account__c'] + '~' + line.record['ProdLevel1__c'] + '~' + line.record['ProdLevel2__c']].Additional_Discount__c;
            }
            else if (customerTierObj[quote.record['SBQQ__Account__c'] + '~' + line.record['ProdLevel1__c'] + '~' + 'Any Value']) {

                line.record['Tier__c'] = customerTierObj[quote.record['SBQQ__Account__c'] + '~' + line.record['ProdLevel1__c'] + '~' + 'Any Value'].Tier__c;
                line.record['Customer_Tier_Additional_Discount__c'] = customerTierObj[quote.record['SBQQ__Account__c'] + '~' + line.record['ProdLevel1__c'] + '~' + 'Any Value'].Additional_Discount__c;
            }

            // test: applying discounts
            if (line.record['SBQQ__Quantity__c'] > 1) {
                line.record['SBQQ__NetPrice__c'] = line.record['SBQQ__OriginalPrice__c'] * 0.9;
            } else {
                line.record['SBQQ__NetPrice__c'] = line.record['SBQQ__OriginalPrice__c'];
            }

            line.record['SBQQ__NetTotal__c'] = line.record['SBQQ__NetPrice__c'] * line.record['SBQQ__Quantity__c'];

            return line;
        });
        console.log(customerTierObj);
        return tieredLines;
    }

    productPricingTierScript(prodTiers) {
        // if the query returned rows then build the keys else we still need to set all lines to List.
        if (prodTiers?.length) {
            var pricingTierMap = prodTiers.reduce((o, record) => Object.assign(o, { [record.Customer_Tier__c+'~'+record.Prod_Level_1__c+'~'+record.Prod_Level_2__c+'~'+record.Prod_Level_3__c+'~'+record.Prod_Level_4__c]: record }), {});
            console.log('---------Product Pricing Tiers---------');
            console.log(pricingTierMap)
        }
        return pricingTierMap;
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


    setCableAssemblyName(lines, ascendPackagingList){
        
        let uomSuffix = '';
        let AttUomSuffix = '';
        let AttUomDescSuffix = '';
        let convFactor = 1;
        let itemDesc = '';

        const overrideLines = lines.map(line =>{

            //when line.record['Product_Name_Key_Field_Text__c'] is blank that indicates that the product was just added to the line
            if (!line.record['Product_Name_Key_Field_Text__c']) {
                //backup the list price to the original price field. so it can be used to recalculate if the user changes qty 
                line.record['SBQQ__OriginalPrice__c'] = line.record['SBQQ__ListPrice__c'];
            }

            if (line.record['Length__c'] && line.record['Length_UOM__c'] && (!line.record['Product_Name_Key_Field_Text__c'] || (line.record['Product_Name_Key_Field_Text__c'] && line.record['Product_Name_Key_Field_Text__c'] != (line.record['Length__c'] + "~" + line.record['Length_UOM__c'])))) {
                // console.log('Name change required for line number: '+ line.record['SBQQ__Number__c']);

                if (line.record['Length_UOM__c'] === 'Feet' || line.record['Length_UOM__c'] === 'FT') {
                    uomSuffix = 'FT';
                    AttUomSuffix = 'F';
                    AttUomDescSuffix = 'FT';
                    convFactor = 3.281;
                }else{
                    AttUomSuffix = 'M';
                    AttUomDescSuffix = 'M';
                }

                const lengthSuffix = String("0000" + line.record['Length__c']).slice(-4);
                // console.log('lengthSuffix: ' + lengthSuffix);

                let FinalItem = line.record['SBQQ__ProductName__c'] +"-"+String(lengthSuffix)+uomSuffix;

                if(line.record['Quote_Item_Description_Part_B__c'] && line.record['Quote_Item_Description_Part_B__c'].includes("ASCEND")) {
                    // console.log('Ascend Product');
                    const suffixString = String(lengthSuffix)+uomSuffix;
                    const DescPartBNew = line.record['Quote_Item_Description_Part_B__c'].replace("XXXX", suffixString);
                    itemDesc = line.record['Quote_Item_Description_Part_A__c'] + " "+line.record['Length__c']+line.record['Length_UOM__c']+","+DescPartBNew;
                }else {
                    // console.log('Other Product');
                    itemDesc = line.record['Quote_Item_Description_Part_A__c'] + " "+line.record['Length__c']+line.record['Length_UOM__c']+","+line.record['Quote_Item_Description_Part_B__c']+"-"+String(lengthSuffix)+uomSuffix;
                }


                if (line.record['Customer__c']=== 'ATT' && line.record['Product_Type__c'] === 'HFC Cable') {
                    FinalItem = line.record['Base_Design_Code__c'] +String(lengthSuffix)+AttUomSuffix;
                    itemDesc = "Tip to Tip Length : "+line.record['Length__c']+AttUomDescSuffix+" "+line.record['Quote_Item_Description_Part_A__c'];
                }

                if (line.record['Customer__c']=== 'ATT' && line.record['Product_Type__c'] === 'HFC Cable' && line.record['Base_Design_Code__c']) {
                    itemDesc = line.record['Quote_Item_Description_Part_A__c'] + " " + line.record['Length__c']+AttUomDescSuffix;
                }

                if (line.record['Customer__c']=== 'ATT' && line.record['Product_Type__c'] === 'Interconnect Cable' && line.record['Base_Design_Code__c']) {
                    FinalItem = line.record['Base_Design_Code__c'] +"-" +String(lengthSuffix)+uomSuffix;
                }

                if (line.record['Customer__c']=== 'ATT' && line.record['Product_Type__c'] === 'Interconnect Cable' && line.record['Base_Design_Code__c']) {
                    FinalItem = line.record['Base_Design_Code__c'] +"-" +String(lengthSuffix)+uomSuffix;
                }

                line.record['SBQQ__PackageProductCode__c'] = FinalItem;
                line.record['SBQQ__PackageProductDescription__c'] = itemDesc;
                line.record['SBQQ__Description__c'] = itemDesc;
                line.record['Product_Name_Key_Field_Text__c'] = line.record['Length__c'] + "~" + line.record['Length_UOM__c'];
                
                // console.log('FinalItem: ' + FinalItem);

                convFactor = 1;
                const fixedPrice = line.record['SBQQ__OriginalPrice__c'];
                const varPrice = line.record['Variable_Price_1__c'];

                if (line.record['Length_UOM__c'] == 'Feet' || line.record['Length_UOM__c'] == 'Foot' || line.record['Length_UOM__c'] == 'FT') {
                    convFactor = 3.281;
                }
        
                let listPrice = (fixedPrice + (varPrice * line.record['Length__c'] / convFactor));
        
                // console.log('list price updated to = '+ listPrice);
                
                line.record['SBQQ__ListPrice__c'] = listPrice;

                if (line.record['Fixed_Cost__c'] && line.record['CableCostPerMeter__c'] ) {
                    line.record['Unit_Cost__c'] = (line.record['Fixed_Cost__c'] + (line.record['CableCostPerMeter__c'] * line.record['Length__c'] / convFactor));
                }

               

                //if the product is ASCEND, we need to add a packaging cost
                
                if (line.record['Product_Type__c'] && line.record['Product_Type__c'].toUpperCase().includes('ASCEND')) {
                    // console.log('++++++++++++++++++Adding Ascend Package Adder++++++++++++++++++');
                    // console.log('Price before Ascend Packaging adder = ' + listPrice);
                    // console.log('Length before = ' + line.record['Length__c']);
                    const qpLength = line.record['Length__c'] / convFactor;
                    // console.log('Length after = ' + qpLength);

                    for (let i=0; i < ascendPackagingList.length; i++) {
                        //log('count factor from table / FiberCount from Quote Line = '+ ascendPackagingList[i].Count_Factor__c.toString() + ' / ' +FiberCount);
                        if (ascendPackagingList[i].Count_Factor__c.toString() === line.record['Fiber_Count__c']) {       
                            if (qpLength <= ascendPackagingList[i].Length_Maximum__c) {
                                // console.log('Length max = ' + ascendPackagingList[i].Length_Maximum__c);
                                listPrice += ascendPackagingList[i].Price__c;
                                // console.log('Price adder = ' + ascendPackagingList[i].Price__c);
                                break;   // jump out of the loop
                            }
                        }
                    }
                    // console.log('Price after = ' + listPrice);
                    // console.log('++++++++++++++++++Adding Ascend Package Adder++++++++++++++++++');

                    line.record['SBQQ__ListPrice__c'] = listPrice;
                }

            }

            return line
        })
        return overrideLines
    }

}