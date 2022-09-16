public with sharing class accountPagination {  
    @AuraEnabled
    public static List<Account> getAccountsWithOffset(){
        // String pageSize, String pageNumber
        // Integer ps = Integer.valueOf(pageSize);
        // Integer pn = Integer.valueOf(pageNumber)-1;
        
        List<Account> accounts = [SELECT
               Id, Name,BillingStreet
               FROM Account 
            //    WITH SECURITY_ENFORCED LIMIT :Integer.valueOf(ps) OFFSET :(ps*pn)
               ];
        return accounts;
    }
}