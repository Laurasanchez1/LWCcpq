public with sharing class PremiseMapController {

    @AuraEnabled
    public static List<AFL_Premise_Jacket_Color_Xrefs__c> queryJacketColor(){
        try {
            Map<String, AFL_Premise_Jacket_Color_Xrefs__c> jacketPrintMap = AFL_Premise_Jacket_Color_Xrefs__c.getAll(); //Get the custom fields in the custom setting
            return jacketPrintMap.values();
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}