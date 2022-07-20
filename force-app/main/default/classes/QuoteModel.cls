public class QuoteModel {
    @AuraEnabled
    public SBQQ__Quote__c record {get; set;}
    @AuraEnabled
    public QuoteLineModel[] lineItems {get; set;}
    @AuraEnabled
    public QuoteLineGroupModel[] lineItemGroups {get; set;}
    @AuraEnabled
    public Integer nextKey {get; set;}
    @AuraEnabled
    public Boolean applyAdditionalDiscountLast {get; set;}
    @AuraEnabled
    public Boolean applyPartnerDiscountFirst {get; set;}
    @AuraEnabled
    public Boolean channelDiscountsOffList {get; set;}
    @AuraEnabled
    public Decimal customerTotal {get; set;}
    @AuraEnabled
    public Decimal netTotal {get; set;}
    @AuraEnabled
    public Decimal netNonSegmentTotal {get; set;}
}