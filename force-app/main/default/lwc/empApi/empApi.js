import { LightningElement, track } from 'lwc';

// import read from '@salesforce/apex/myQuoteExample.read';
// import {
//     subscribe,
//     unsubscribe,
//     onError,
//     setDebugFlag,
//     isEmpEnabled,
// } from 'lightning/empApi';

export default class EmpApiLWC extends LightningElement {
    channelName = '/event/Test__e';
    quoteId = 'a0q8Z00000CsGvUQAV';
    isSubscribeDisabled = false;
    isUnsubscribeDisabled = !this.isSubscribeDisabled;
    totalValue;
    totalValueLoading = false;
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
        this.template.querySelector("c-emp-child").calculate();
    }

    handleSaveAndExit(){
        this.template.querySelector('c-emp-child').exit();
    }

    // handleFetch() {
    //     read({quoteId: this.quoteId})
    //     .then(quote => {
    //         const flatLines = quote.lineItems.map(line => {
    //             return {
    //                 SBQQ__ProductName__c: line.record['SBQQ__ProductName__c']
    //             }
    //         });
    //         this.quoteLines = flatLines;
    //     }
            
    //     )
    //     .catch(error => console.log(error));
    // }

    // Initializes the component
    connectedCallback() {
        // Register error listener
        // this.registerErrorListener();
    }

    // Handles subscribe button click
    // handleSubscribe() {
    //     // Callback invoked whenever a new event message is received
    //     const messageCallback = (response) => {
            
    //     };

    //     // Invoke subscribe method of empApi. Pass reference to messageCallback
    //     subscribe(this.channelName, -1, messageCallback).then((response) => {
    //         // Response contains the subscription information on subscribe call
    //         console.log(
    //             'Subscription request sent to: ',
    //             JSON.stringify(response.channel)
    //         );
    //         this.subscription = response;
    //         this.toggleSubscribeButton(true);
    //     });
    // }

    // Handles unsubscribe button click
    // handleUnsubscribe() {
    //     this.toggleSubscribeButton(false);

    //     // Invoke unsubscribe method of empApi
    //     unsubscribe(this.subscription, (response) => {
    //         console.log('unsubscribe() response: ', JSON.stringify(response));
    //         // Response is true for successful unsubscribe
    //     });
    // }

    // toggleSubscribeButton(enableSubscribe) {
    //     this.isSubscribeDisabled = enableSubscribe;
    //     this.isUnsubscribeDisabled = !enableSubscribe;
    // }

    // registerErrorListener() {
    //     // Invoke onError empApi method
    //     onError((error) => {
    //         console.log('Received error from server: ', JSON.stringify(error));
    //         // Error contains the server-side error
    //     });
    // }
}