public with sharing class myQuoteReader implements Queueable {
    
    private String quoteId;

    public myQuoteReader(String quoteId) {
        this.quoteId = quoteId;
    }

    public void execute(QueueableContext context) {
        String quoteJSON = SBQQ.ServiceRouter.read('SBQQ.QuoteAPI.QuoteReader', quoteId);
        System.debug(quoteJSON);
    }
}