public with sharing class QuoteReader {
    
    public String read(String quoteId) {
        String quoteJSON = SBQQ.ServiceRouter.read('SBQQ.QuoteAPI.QuoteReader', quoteId);
        // QuoteModel quote = (QuoteModel) JSON.deserialize(quoteJSON, QuoteModel.class);
        return quoteJSON;
    }
}