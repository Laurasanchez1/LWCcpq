public with sharing class PriceRuleController {
    @AuraEnabled
    public static List<SBQQ__PriceRule__c> queryPriceRules(){
        try {
            List<SBQQ__PriceRule__c> priceRules = [SELECT SBQQ__ConditionsMet__c, SBQQ__ConfiguratorEvaluationEvent__c, SBQQ__EvaluationEvent__c, (SELECT SBQQ__Object__c, SBQQ__Field__c, SBQQ__TestedFormula__c, SBQQ__Operator__c, SBQQ__FilterType__c, SBQQ__Value__c, SBQQ__FilterVariable__c FROM SBQQ__PriceConditions__r), (SELECT SBQQ__TargetObject__c, SBQQ__Field__c, SBQQ__Value__c FROM SBQQ__PriceActions__r) FROM SBQQ__PriceRule__c WHERE SBQQ__Active__c = true AND SBQQ__TargetObject__c = 'Calculator'];
            return priceRules;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}