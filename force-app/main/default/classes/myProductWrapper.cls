public with sharing class myProductWrapper {
    
    @AuraEnabled
    public static ProductModel retrieveQLM(String productId){
        List<Product2> productList = [SELECT (SELECT Pricebook2Id FROM PricebookEntries) FROM Product2 WHERE Id = :productId];
        List<PricebookEntry> myEntries = productList[0].PricebookEntries;
        String pricebookId = myEntries[0].Pricebook2Id;
        ProductReader reader = new ProductReader();
        ProductModel myProd = reader.read(productId, pricebookId, 'USD');
        return myProd;
    }
}