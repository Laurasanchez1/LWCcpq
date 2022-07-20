public class QuoteLineModel {
    @auraEnabled
    public SBQQ__QuoteLine__c record {get; set;}
    public Boolean amountDiscountProrated {get; set;}
    public Integer parentGroupKey {get; set;}
    public Integer parentItemKey {get; set;}
    public Integer key {get; set;}
    public Boolean upliftable {get; set;}
    public String configurationType {get; set;}
    public String configurationEvent {get; set;}
    public Boolean reconfigurationDisabled {get; set;}
    public Boolean descriptionLocked {get; set;}
    public Boolean productQuantityEditable {get; set;}
    public Decimal productQuantityScale {get; set;}
    public String dimensionType {get; set;}
    public Boolean productHasDimensions {get; set;}
    public Decimal targetCustomerAmount {get; set;}
    public Decimal targetCustomerTotal {get; set;}
}