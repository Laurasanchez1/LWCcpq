public with sharing class ProductRuleController {
    @AuraEnabled
    public static List<SBQQ__ProductRule__c> queryProductRules(){
        try {
            String Scope = 'Quote';
            List<SBQQ__ProductRule__c> productRules = Database.query('SELECT SBQQ__Active__c, SBQQ__Type__c, SBQQ__Scope__c, SBQQ__EvaluationEvent__c, SBQQ__EvaluationOrder__c, SBQQ__ConditionsMet__c,SBQQ__ErrorMessage__c, (SELECT SBQQ__TestedObject__c, SBQQ__TestedField__c, SBQQ__Operator__c, SBQQ__FilterType__c, SBQQ__FilterValue__C, SBQQ__FilterVariable__c FROM SBQQ__ErrorConditions__r) FROM SBQQ__ProductRule__c WHERE SBQQ__Active__c = true AND SBQQ__Scope__c=:Scope ORDER BY SBQQ__EvaluationOrder__c NULLS LAST');
            return productRules;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static List<SBQQ__QuoteLine__c> wrapQuoteLine (String qlJSON){
        try {
            List<SBQQ__QuoteLine__c> listQL = (List<SBQQ__QuoteLine__c>) JSON.deserialize(qlJSON, List<SBQQ__QuoteLine__c>.class);
            List<FormulaRecalcResult> recalcList = Formula.recalculateFormulas(listQL);
            List<SBQQ__QuoteLine__c> recalcQL = new List<SBQQ__QuoteLine__c>();
            for(FormulaRecalcResult recalcObject : recalcList){
                recalcQL.add((SBQQ__QuoteLine__c) recalcObject.getSObject());
            }
            return recalcQL;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}