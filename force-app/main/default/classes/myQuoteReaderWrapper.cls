public with sharing class myQuoteReaderWrapper {
    
    @AuraEnabled
    public static String enqueueRead(String quoteId){
        myQuoteReader queueableReader = new myQuoteReader(quoteId);
        Id jobId = System.enqueueJob(queueableReader);
        return jobId;
    }
}