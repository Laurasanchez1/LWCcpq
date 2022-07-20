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
}