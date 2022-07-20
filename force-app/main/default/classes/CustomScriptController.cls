public with sharing class CustomScriptController {
    @AuraEnabled
    public static String getCode() {
        SBQQ__CustomScript__c script = [SELECT Id, SBQQ__Code__c FROM SBQQ__CustomScript__c LIMIT 1];
        return script.SBQQ__Code__c;
    }
}