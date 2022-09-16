public class myQuoteCalculator {
    
    @AuraEnabled
    public static void calculate(String quoteJSON) {
        QuoteModel quote = (QuoteModel) JSON.deserialize(quoteJSON, QuoteModel.class);
        try {
            QuoteCalculator calculator = new QuoteCalculator();
            calculator.calculate(quote, 'MyCallback');
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String save(String quoteJSON){
        try {
            return SBQQ.ServiceRouter.save('SBQQ.QuoteAPI.QuoteSaver', quoteJSON);
            // return result;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}