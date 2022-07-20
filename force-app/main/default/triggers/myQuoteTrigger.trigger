trigger myQuoteTrigger on SBQQ__Quote__c (before update) {
    Boolean shouldUpdate = false;
	List<SBQQ__Quote__c> myQuotes = Trigger.New;
    List<Id> ids = new List<Id>();
    for(SBQQ__Quote__c quote : myQuotes){
        if(quote.is_QCP_done__c == true){
        	shouldUpdate = true;
            quote.is_QCP_done__c = false;
            ids.add(quote.Id);
        }
    }
    if(shouldUpdate == true){
        Test__e myEvt = new Test__e();
        myEvt.Message__c = ids[0];
        EventBus.publish(myEvt);
    }
}