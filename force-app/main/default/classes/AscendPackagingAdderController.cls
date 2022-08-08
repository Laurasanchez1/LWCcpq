public with sharing class AscendPackagingAdderController {
    @AuraEnabled
    public static List<Ascend_Packaging_Adder__mdt> queryAscendPackagingAdder(){
        try {
            List<Ascend_Packaging_Adder__mdt> AscendPackagingAdders =[SELECT Count_Factor__c, Length_Maximum__c, Price__c FROM Ascend_Packaging_Adder__mdt ORDER BY Length_Maximum__c ASC];
            return AscendPackagingAdders;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}