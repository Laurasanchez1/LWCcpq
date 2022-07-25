import { LightningElement, api, track, wire } from 'lwc';
import read from '@salesforce/apex/myQuoteExample.read';
import calculate from '@salesforce/apex/myQuoteCalculator.calculate';
import queryCT from '@salesforce/apex/CustomerTierController.queryCT';
import queryPPT from '@salesforce/apex/ProductPricingTierController.queryPPT';
import queryBlockPrices from '@salesforce/apex/BlockPriceController.queryBlockPrices';

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
    { label: 'Total', fieldName: 'SBQQ__NetTotal__c', type: 'currency' }
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

    // connectedCallback() {


    //     this.registerErrorListener();

    //     read({ quoteId: this.quoteId })
    //         .then(quote => {
    //             this.loading = false;
    //             this.quote = JSON.parse(quote);

    //             queryPPT({
    //                 prodLevel1List: this.quote.lineItems.map(line => {
    //                     return line.record['ProdLevel1__c']
    //                 })
    //             })
    //                 .then(prodTiers => {
    //                     this.prodTiers = prodTiers;
    //                 })




    //             queryCT({ accountId: this.quote.record['SBQQ__Account__c'] })
    //                 .then(tiers => {
    //                     this.tiers = tiers;
    //                     const flatLines = this.quote.lineItems.map(line => {
    //                         return {
    //                             SBQQ__ProductName__c: line.record['SBQQ__ProductName__c'],
    //                             SBQQ__Quantity__c: line.record['SBQQ__Quantity__c'],
    //                             SBQQ__ListPrice__c: line.record['SBQQ__ListPrice__c'],
    //                             SBQQ__NetPrice__c: line.record['SBQQ__NetPrice__c'],
    //                             SBQQ__NetTotal__c: line.record['SBQQ__NetTotal__c']
    //                         }
    //                     });
    //                     this.flatLines = flatLines;
    //                 });


    //             const messageCallback = (response) => {
    //                 read({ quoteId: this.quoteId })
    //                     .then(quote => {
    //                         this.quote = JSON.parse(quote);
    //                         const flatLines = this.quote.lineItems.map(line => {
    //                             return {
    //                                 SBQQ__ProductName__c: line.record['SBQQ__ProductName__c'],
    //                                 SBQQ__Quantity__c: line.record['SBQQ__Quantity__c'],
    //                                 SBQQ__NetTotal__c: line.record['SBQQ__NetTotal__c']
    //                             }
    //                         });
    //                         this.flatLines = flatLines;
    //                     })
    //             };

    //             subscribe(this.channelName, -1, messageCallback).then((response) => {
    //                 // Response contains the subscription information on subscribe call
    //                 console.log(
    //                     'Subscription request sent to: ',
    //                     JSON.stringify(response.channel)
    //                 );
    //                 this.subscription = response;
    //             });

    //         });

    // }



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
            const [tiers, prodTiers, blockPrices] = await Promise.all([
                queryCT({accountId: this.quote.record['SBQQ__Account__c']}),
                queryPPT({prodLevel1List: this.quote.lineItems.map(line => {
                    return line.record['ProdLevel1__c']})
                }),
                queryBlockPrices({listProduct: listBlockProducts})
                ]);
            this.tiers = tiers;
            this.prodTiers = prodTiers;
            this.blockPrices = blockPrices;
            const flatLines = this.quote.lineItems.map(line => {
                return {
                    SBQQ__ProductName__c: line.record['SBQQ__ProductName__c'],
                    SBQQ__Quantity__c: line.record['SBQQ__Quantity__c'],
                    SBQQ__ListPrice__c: line.record['SBQQ__ListPrice__c'],
                    SBQQ__SpecialPrice__c: line.record['SBQQ__SpecialPrice__c'],
                    SBQQ__NetPrice__c: line.record['SBQQ__NetPrice__c'],
                    SBQQ__NetTotal__c: line.record['SBQQ__NetTotal__c']
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

    // saveValues(event) {
    //     try {
    //         let lines = this.quote.lineItems;
    //         // Inspect changes
    //         event.detail.draftValues.forEach((row, index) => {

    //             // Obtain row id
    //             const rowId = row.id.substring(4);
    //             // Obtain list of fields that were changed
    //             const fieldList = Object.keys(row).filter(field => field !== 'id');
    //             console.log(fieldList);

    //             if (!lines[rowId].parentItemKey) {
    //                 // Cycle through the fields that were changed
    //                 for (let field of fieldList) {
    //                     // change value of fields on that line
    //                     lines[rowId].record[field] = row[field];
    //                 }
    //             }

    //             // BUNDLE LOGIC STARTS HERE --------

    //             // If line is a bundle parent
    //             if (lines[rowId].record['SBQQ__Bundle__c']) {
    //                 // Cycle through products that come next
    //                 for (let i = rowId; i < lines.length; i++) {
    //                     // if product is a parent
    //                     if (lines[i].record['SBQQ__Bundle__c']) {
    //                         continue;
    //                     }
    //                     // if product belongs to parent
    //                     if (lines[i].parentItemKey === lines[rowId].key) {
    //                         // if is type 'component'
    //                         if (lines[i].record['SBQQ__OptionType__c'] === 'Component') {
    //                             // Adjust quantity accordingly
    //                             lines[i].record['SBQQ__Quantity__c'] = lines[rowId].record['SBQQ__Quantity__c'] * lines[i].record['SBQQ__BundledQuantity__c'];
    //                         }
    //                     } else {
    //                         break; // Stop cycling, reached the end of bundle
    //                     }
    //                 }
    //             }

    //             // BUNDLE LOGIC ENDS HERE --------

    //         });


    //         this.quote.lineItems = lines;

    //         lines = this.customerTierScript(this.tiers, this.quote);

    //         this.quote.lineItems = lines;

    //         this.pricingTierMap = this.productPricingTierScript(this.prodTiers);

    //         console.log(this.quote);

    //         console.log("----Price Override----");
    //         lines = this.priceOverride(this.quote.lineItems)
    //         console.log(lines);

    //         // Regenerate flat lines object
    //         const flatLines = this.quote.lineItems.map(line => {
    //             return {
    //                 SBQQ__ProductName__c: line.record['SBQQ__ProductName__c'],
    //                 SBQQ__Quantity__c: line.record['SBQQ__Quantity__c'],
    //                 SBQQ__ListPrice__c: line.record['SBQQ__ListPrice__c'],
    //                 SBQQ__NetPrice__c: line.record['SBQQ__NetPrice__c'],
    //                 SBQQ__NetTotal__c: line.record['SBQQ__NetTotal__c']
    //             }
    //         });


    //         // Refresh component
    //         const randDelay = Math.floor(Math.random() * 500) + 500;
    //         this.loading = true;
    //         setTimeout(() => {
    //             this.flatLines = flatLines;
    //             this.columns = [...columns];
    //             this.loading = false;

    //         }, randDelay);
    //     } catch (error) {
    //         console.log(error);
    //     }

    // }


    saveValues(event) {
        let lines = this.quote.lineItems;
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
        this.quote.lineItems = lines;

        this.pricingTierMap = this.productPricingTierScript(this.prodTiers);

        // Regenerate flat lines object
        const flatLines = this.quote.lineItems.map(line => {
            return {
                SBQQ__ProductName__c: line.record['SBQQ__ProductName__c'],
                SBQQ__Quantity__c: line.record['SBQQ__Quantity__c'],
                SBQQ__ListPrice__c: line.record['SBQQ__ListPrice__c'],
                SBQQ__SpecialPrice__c: line.record['SBQQ__SpecialPrice__c'],
                SBQQ__NetPrice__c: line.record['SBQQ__NetPrice__c'],
                SBQQ__NetTotal__c: line.record['SBQQ__NetTotal__c']
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

}