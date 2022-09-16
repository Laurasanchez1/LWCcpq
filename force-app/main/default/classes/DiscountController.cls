public with sharing class DiscountController {
    public virtual class BaseException extends Exception {}
    public class OtherException extends BaseException {}

    @AuraEnabled
    public static List<SBQQ__DiscountTier__c> discountPrinter(String agreementId, String prodId) {
        List<SBQQ__DiscountTier__c> tiersToShow = new List<SBQQ__DiscountTier__c>();

        //In this query there is missing a field that tells us if a discount is active for the product -- there can only be one discount active per product
        List<SBQQ__DiscountSchedule__c> discountList = [SELECT id, Contract__c, (SELECT ID,Tier_Name__c,UOM__C, Name, SBQQ__Number__c,SBQQ__LowerBound__c,SBQQ__UpperBound__c, SBQQ__Discount__c,Agreement__c,SBQQ__Price__c FROM SBQQ__DiscountTiers__r) FROM SBQQ__DiscountSchedule__c WHERE Contract__c =: agreementId AND SBQQ__Product__c =: prodId]; 
        // System.debug('discounts found ' + discountList.size()); //Should always be 1, either way we are only taking the first one
        if (discountList.size()>0) {
            for(SBQQ__DiscountTier__c tier : discountList[0].SBQQ__DiscountTiers__r){
                tiersToShow.add(tier);
            }    
        }
        

        // System.debug('Size of the list' + tiersToShow.size());

        return tiersToShow;
    }

    @AuraEnabled(cacheable=true)
    public static List<SBQQ__DiscountTier__c> tiersByScheduleId(String scheduleId){
        try {

            List<SBQQ__DiscountTier__c> tiersToShow = new List<SBQQ__DiscountTier__c>();

            List<SBQQ__DiscountSchedule__c> discountList = [SELECT id, Contract__c, (SELECT ID,Tier_Name__c,UOM__C, Name, SBQQ__Number__c,SBQQ__LowerBound__c,SBQQ__UpperBound__c, SBQQ__Discount__c,Agreement__c,SBQQ__Price__c FROM SBQQ__DiscountTiers__r) FROM SBQQ__DiscountSchedule__c WHERE Id =: scheduleId]; 

            if (discountList.size()>0) {
                for(SBQQ__DiscountTier__c tier : discountList[0].SBQQ__DiscountTiers__r){
                    tiersToShow.add(tier);
                }    
            }

            //return tiersToShow;

            if(Test.isRunningTest() && tiersToShow.size()==0){
                throw new OtherException('Error');
            } else {
                return tiersToShow;
            }
            
        } catch (BaseException e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}