import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';


export default class EmpApiCaro extends LightningElement {
    channelName = '/event/Test__e';
    quoteId = 'a0q8Z00000CsZBaQAN'; //  a0q8Z00000CsZBaQAN a0q8Z00000CrwOYQAZ
    isSubscribeDisabled = false;
    isUnsubscribeDisabled = !this.isSubscribeDisabled;
    totalValue;
    totalValueLoading = false;
    isCloneButtonDisabled = true;
    // quoteLines;

    subscription = {};

    // Tracks changes to channelName text field
    handleChannelName(event) {
        this.channelName = event.target.value;
    }

    handleQuoteId(event) {
        this.quoteId = event.target.value;
    }

    updateTotal(event){
        this.totalValue = event.detail.record['SBQQ__NetTotal__c'];
    }

    handleSaveAndCalculate(){
        console.log('save and calculate');
        this.template.querySelector("c-emp-child-caro").calculate();
    }

    handleSaveAndExit(){
        this.template.querySelector('c-emp-child-caro').exit();
    }

    handleCloneRows(){
        this.template.querySelector('c-emp-child-caro').clonerows();
    }

    enableCloneButton(){
        this.isCloneButtonDisabled = false;
    }

    disableCloneButton(){
        this.isCloneButtonDisabled = true;
    }

    // Initializes the component
    connectedCallback() {
        // Register error listener
        // this.registerErrorListener();
    }
    
    //Import Lines Button
    handleImportLines(){
        let link = '/apex/SBQQ__ImportLines?id='+this.quoteId;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: {
                url: link,
                recordId : this.quoteId,
            }
        })
    }

    //Reorder Lines Button (Disable if not in Quote Home Tab)
    disableReorder = false;
    deactivateReorderButton(){
        this.disableReorder = true;
    }
    activateReorderButton(){
        this.disableReorder = false;
    }
    handleReorderLines(){
        console.log('Reorder Lines');
        this.template.querySelector("c-emp-child-caro").reorderLines();
    }


    //Apply Discount
    @track valueDiscount = undefined;
    handleValueDiscount(event){
        this.valueDiscount = event.detail.value;
    }

    handleApplyDiscount(){
        if (this.valueDiscount != undefined){
            this.template.querySelector('c-emp-child-caro').applyDiscountInLines(this.valueDiscount);
            this.valueDiscount = undefined; 
        } else {
            const evt = new ShowToastEvent({
                title: 'No Line Discount value',
                message: 'Please add a line discount to apply',
                variant: 'error',
                mode: 'sticky'
            });
            this.dispatchEvent(evt);
        }
    }
    
}