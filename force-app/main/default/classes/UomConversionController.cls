public with sharing class UomConversionController {
    @AuraEnabled
    public static List<UOM_Conversion__c> queryUOM() {
        try {
            List<UOM_Conversion__c> fieldList = [SELECT Id, Name, Product__c, From_UOM__c, To_UOM__c, Product_Level_1__c, Product_Level_2__c, Conversion_Factor__c FROM UOM_Conversion__c];
            return fieldList;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}