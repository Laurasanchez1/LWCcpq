public class myQuoteExample {
    
    @AuraEnabled
    public static String read(Id quoteId){
        try {
            QuoteReader reader = new QuoteReader();
            String quote = reader.read(quoteId);
            return quote;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

}