import { LightningElement, track } from 'lwc';

export default class EmpApiOlga extends LightningElement {
    channelName = '/event/Test__e';
    quoteId = 'a0q8Z00000CsifaQAB';
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
        this.template.querySelector("c-emp-child-olga").calculate();
    }

    handleSaveAndExit(){
        this.template.querySelector('c-emp-child-olga').exit();
    }

    handleCloneRows(){
        this.template.querySelector('c-emp-child-olga').clonerows();
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
        this.template.querySelector("c-emp-child-olga").reorderLines();
    }
}