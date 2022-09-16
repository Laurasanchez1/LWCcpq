public class ProductModel {
    @AuraEnabled
    public Product2 record {get; set;}
    public Id upgradedAssetId;
    public String currencySymbol;
    public String currencyCode;
    public String[] featureCategories;
    public OptionModel[] options;
    public FeatureModel[] features;
    public ConfigurationModel configuration;
    public ConfigAttributeModel[] configurationAttributes;
    public ConfigAttributeModel[] inheritedConfigurationAttributes;
    public ConstraintModel[] constraints; 
}