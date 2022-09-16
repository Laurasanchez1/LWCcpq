public class myQuoteExample {
    
    @AuraEnabled
    public static String read(Id quoteId){
        
        return SBQQ.ServiceRouter.read('SBQQ.QuoteAPI.QuoteReader', quoteId); 
        
    }

}