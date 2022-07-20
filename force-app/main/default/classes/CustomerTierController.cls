public with sharing class CustomerTierController {
    @AuraEnabled
    public static List<CustomerTier__c> queryCT(String accountId){
        try {
            List<CustomerTier__c> tiers = [SELECT  Account__c, Additional_Discount__c, Id, Name ,Prod_Level_1__c ,Prod_Level_2__c, Tier__c, Unique_Key__c FROM CustomerTier__c where Account__c =: accountId];
            return tiers;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}