public with sharing class myQuoteStackRetriever {

    @AuraEnabled
    public static String getLogBody(String logId) {
        PageReference pageRef = new PageReference('/servlet/servlet.FileDownload?file='+logId);
        String logBody = JSON.serialize(pageRef.getContent());
        return logBody;
    }
}