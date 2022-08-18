public with sharing class QuoteController {
    
    @AuraEnabled
    public static List<SBQQ__QuoteLine__c> wrapQuoteLine (String qlJSON){
        try {
            List<SBQQ__QuoteLine__c> listQL = (List<SBQQ__QuoteLine__c>) JSON.deserialize(qlJSON, List<SBQQ__QuoteLine__c>.class);
            List<FormulaRecalcResult> recalcList = Formula.recalculateFormulas(listQL);
            List<SBQQ__QuoteLine__c> recalcQL = new List<SBQQ__QuoteLine__c>();
            for(FormulaRecalcResult recalcObject : recalcList){
                recalcQL.add((SBQQ__QuoteLine__c) recalcObject.getSObject());
            }
            return recalcQL;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // Diana's method
    public static List<Schema.PicklistEntry> getDependentPicklistValues(Schema.sObjectField dependToken, String prodTypeSelection) {
        Schema.DescribeFieldResult depend = dependToken.getDescribe();
        Schema.sObjectField controlToken = depend.getController();
        System.debug('control token = ' + controlToken);
        if (controlToken == null) {
            List<String> valuesToPrint = new List<String>();
            List<Schema.PicklistEntry> pickListValues = dependToken.getDescribe().getPickListValues();
            // List<String> pickListLabels = dependToken.getDescribe().getPickListValues().getLabel();
            for(Schema.PicklistEntry p : pickListValues){
                String value = p.getLabel();
                valuesToPrint.add(value);
            }
            return pickListValues;
        }
        Schema.DescribeFieldResult control = controlToken.getDescribe();
        List<Schema.PicklistEntry> controlEntries;
        if(control.getType() != Schema.DisplayType.Boolean) {
            controlEntries = control.getPicklistValues();
        }
        String base64map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        Map<String,List<Schema.PicklistEntry>> dependentPicklistValues = new Map<String,List<Schema.PicklistEntry>>();
        for (Schema.PicklistEntry entry : depend.getPicklistValues()) {
            if (entry.isActive() && String.isNotEmpty(String.valueOf(((Map<String,Object>) JSON.deserializeUntyped(JSON.serialize(entry))).get('validFor')))) {
                List<String> base64chars =
                        String.valueOf(((Map<String,Object>) JSON.deserializeUntyped(JSON.serialize(entry))).get('validFor')).split('');
                for (Integer index = 0; index < (controlEntries != null ? controlEntries.size() : 2); index++) {
                    Object controlValue =
                            (controlEntries == null
                                    ?   (Object) (index == 1)
                                    :   (Object) (controlEntries[index].isActive() ? controlEntries[index].getLabel() : null)
                            );
                    Integer bitIndex = index / 6;
                    if (bitIndex > base64chars.size() - 1) {
                        break;
                    }
                    Integer bitShift = 5 - Math.mod(index, 6);
                    if  (controlValue == null || (base64map.indexOf( base64chars[ bitIndex ] ) & (1 << bitShift)) == 0)
                        continue;
                    if (!dependentPicklistValues.containsKey((String) controlValue)) {
                        dependentPicklistValues.put((String) controlValue, new List<Schema.PicklistEntry>());
                    }
                    dependentPicklistValues.get((String) controlValue).add(entry);
                }
            }
        }
        List<Schema.PicklistEntry> pickListValues = dependentPicklistValues.get(prodTypeSelection);
        return pickListValues;
    }

    @AuraEnabled
    public static String uomDependencyLevel2List(List<String> productLevel2){
        Schema.sObjectType sobject_type = SBQQ__QuoteLine__c.getSObjectType();
        Map<String, Schema.SObjectField> theFieldmap = sobject_type.getDescribe().fields.getMap();
        Map<String, List<Schema.PicklistEntry>> mapOfPick2toUOM = new Map<String, List<Schema.PicklistEntry>>();
        for(Integer i=0; i< productLevel2.size(); i++){
            List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(theFieldmap.get('UOM__c'), productLevel2[i]);
            mapOfPick2toUOM.put(productLevel2[i], pickListValues);
        }
        return JSON.serialize(mapOfPick2toUOM);
    }

    //This controls the fields that willl need to be filled from the NSP products depending on which one it is 
    @AuraEnabled
    public static String NSPAdditionalFields(Id productId){
        Map<String,BL_NSP_Fields__c> custFieldsMap = BL_NSP_Fields__c.getAll(); //Get the custom fields in the custom setting

        Schema.sObjectType sobject_type = Product2.getSObjectType();
        Schema.sObjectType sobject_type_quote = SBQQ__QuoteLine__c.getSObjectType();
        Map<String, Schema.SObjectField> theProductFieldmap = sobject_type.getDescribe().fields.getMap(); //The fields map of the product oject
        Map<String, Schema.SObjectField> productFields = new Map<String, Schema.SObjectField>(); //Store the Product picklist fields
        Map<String, Schema.SObjectField> productPicklistFields = new Map<String, Schema.SObjectField>(); //Store the Product picklist fields
        Map<String, String> prodFieldsNameMap = new Map<String, String>(); //Store the Product picklist fields
        Map<String, Schema.DisplayType> prodFieldsTypeMap = new Map<String, Schema.DisplayType>(); //Store the type of the Product fields
        
        Map<String, Schema.SObjectField> theLineFieldmap = sobject_type_quote.getDescribe().fields.getMap(); //The fields map of the Quote Line oject
        Map<String, Schema.SObjectField> linePicklistFields = new Map<String, Schema.SObjectField>(); //Store the Quote Line picklist fields
        Map<String, String> lineFieldsNameMap = new Map<String, String>(); //Store the Quote Line picklist fields
        Map<String, Schema.DisplayType> lineFieldsTypeMap = new Map<String, Schema.DisplayType>(); //Store the type of the Quote Line fields
        
        String query ='';
        String strFields = '';
        for(String fieldName : theProductFieldmap.keyset() ){
            if(strFields == null || strFields == ''){
                strFields = fieldName;
            }else{
                strFields = strFields + ' , ' + fieldName;
            }
        }

        Map<String, List<Schema.PicklistEntry>> filtersMap = new Map<String, List<Schema.PicklistEntry>>();
        List<WrappersClass.FilteringWrappingClass> filtersWrapperToShow = new List<WrappersClass.FilteringWrappingClass>();
        Map<String, Object> displayFieldsMap = new Map<String, String>();
        // Product2 product = [SELECT Filtered_Grouping__c,Product_Type__c,Fiber_Type__c,Base_Design_Code__c,Minimum_in_Feet__c,Weight_kg_per_meter__c  FROM Product2 WHERE ID =: productId];
        query ='SELECT '+strFields +' FROM Product2 WHERE ID =: productId';
        Product2 product = Database.query(query);

        for(String field: theProductFieldmap.keyset()){ //for each field in the Product2 object
            String label = theProductFieldmap.get(field).getDescribe().getLabel(); // Get the label of each field in the product object
            Schema.DisplayType theResult = theProductFieldmap.get(field).getDescribe().GetType(); //get field type
            prodFieldsNameMap.put(label,theProductFieldmap.get(field).getDescribe().getName()); //Stores the API name of each field object
            productFields.put(label,theProductFieldmap.get(field)); //put all of the product fields in a map, with the label as the key
            if (theResult == Schema.DisplayType.Picklist){ //if it's a picklist
                productPicklistFields.put(label,theProductFieldmap.get(field)); //put all of the picklist fields in a map, with the label as the key
                prodFieldsNameMap.put(label,theProductFieldmap.get(field).getDescribe().getName()); //Stores the API name of each field object
                prodFieldsTypeMap.put(label,theProductFieldmap.get(field).getDescribe().getType()); //Stores the type of each field object
            }
        }
        for(String field: theLineFieldmap.keyset()){ //for each field in the Quote Line object
            String label = theLineFieldmap.get(field).getDescribe().getLabel(); // Get the label of each field in the product object
            Schema.DisplayType theResult = theLineFieldmap.get(field).getDescribe().GetType(); //get field type
            lineFieldsNameMap.put(label,theLineFieldmap.get(field).getDescribe().getName()); //Stores the API name of each field object
            if (theResult == Schema.DisplayType.Picklist){ //if it's a picklist
                linePicklistFields.put(label,theLineFieldmap.get(field)); //put all of the picklist fields in a map, with the label as the key
                lineFieldsNameMap.put(label,theLineFieldmap.get(field).getDescribe().getName()); //Stores the API name of each field object
                lineFieldsTypeMap.put(label,theLineFieldmap.get(field).getDescribe().getType()); //Stores the type of each field object
            }
        }
        //Get all of the custom field values from the filtered grouping - gets it from the custom settings

        BL_NSP_Fields__c customFilters = custFieldsMap.get(product.Filtered_Grouping__c);
        if(product.Filtered_Grouping__c == 'Premise Cable'){
            System.debug('is premise cable');
            if(customFilters.Attribute_1__c!= null){
                if(productPicklistFields.get(customFilters.Attribute_1__c)!=null){
                    List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(productPicklistFields.get(customFilters.Attribute_1__c),product.Product_Type__c);
                    filtersMap.put(customFilters.Attribute_1__c,pickListValues);
                }else{
                    filtersMap.put(customFilters.Attribute_1__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_2__c!= null){
                if(productPicklistFields.get(customFilters.Attribute_2__c)!=null){
                    List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(productPicklistFields.get(customFilters.Attribute_2__c),product.Product_Type__c);
                    filtersMap.put(customFilters.Attribute_2__c,pickListValues);
                }else{
                    filtersMap.put(customFilters.Attribute_2__c,new List<Schema.PicklistEntry>());
                }
            }

            if(product.Product_Type__c != 'RIBBON-Link®' && product.Product_Type__c != 'Circular Premise Cable' && product.Product_Type__c!= 'Dual-Link' && product.Product_Type__c!= 'eABF® - Air Blown Fiber' && product.Product_Type__c!= 'Indoor/Outdoor Tight Buffer' && product.Product_Type__c!= 'Interconnect Premise MicroCore®' && product.Product_Type__c!= 'Micro-Dual' && product.Product_Type__c!= 'Premise MicroCore® Furcation' && product.Product_Type__c!= 'Quad-Link' && product.Product_Type__c!= 'Simplex' && product.Product_Type__c != 'Zipcord'){
                // if(product.Product_Type__c != 'Circular Premise Cable') {
                system.debug('entered here : ' + product.Product_Type__c);
                if(customFilters.Attribute_3__c!= null){
                    if(productPicklistFields.get(customFilters.Attribute_3__c)!=null){
                        List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(productPicklistFields.get(customFilters.Attribute_3__c),product.Product_Type__c);
                        filtersMap.put(customFilters.Attribute_3__c,pickListValues);
                    }else{
                        filtersMap.put(customFilters.Attribute_3__c,new List<Schema.PicklistEntry>());
                    }
                }
            }   
            if(product.Fiber_Type__c == 'X | Mixed'){
                if(customFilters.Attribute_4__c!= null){
                    if(linePicklistFields.get(customFilters.Attribute_4__c)!=null){
                        List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_4__c),product.Product_Type__c);
                        filtersMap.put(customFilters.Attribute_4__c,pickListValues);
                    }else{
                        filtersMap.put(customFilters.Attribute_4__c,new List<Schema.PicklistEntry>());
                    }
                }         
                if(customFilters.Attribute_5__c!= null){
                    if(linePicklistFields.get(customFilters.Attribute_5__c)!=null){
                        List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_5__c),product.Product_Type__c);
                        filtersMap.put(customFilters.Attribute_5__c,pickListValues);
                    }else{
                        filtersMap.put(customFilters.Attribute_5__c,new List<Schema.PicklistEntry>());
                    }
                }         
                if(customFilters.Attribute_6__c!= null){
                    if(linePicklistFields.get(customFilters.Attribute_6__c)!=null){
                        List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_6__c),product.Product_Type__c);
                        filtersMap.put(customFilters.Attribute_6__c,pickListValues);
                    }else{
                        filtersMap.put(customFilters.Attribute_6__c,new List<Schema.PicklistEntry>());
                    }
                }         
                if(customFilters.Attribute_7__c!= null){
                    if(linePicklistFields.get(customFilters.Attribute_7__c)!=null){
                        List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_7__c),product.Product_Type__c);
                        filtersMap.put(customFilters.Attribute_7__c,pickListValues);
                    }else{
                        filtersMap.put(customFilters.Attribute_7__c,new List<Schema.PicklistEntry>());
                    }
                } 
            }                 
        } else if(product.Filtered_Grouping__c == 'ADSS Cable' || product.Filtered_Grouping__c == 'Loose Tube Cable' ){
            if(customFilters.Attribute_1__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_1__c)!=null){
                    filtersMap.put(customFilters.Attribute_1__c,linePicklistFields.get(customFilters.Attribute_1__c).getDescribe().getPickListValues());
                }else{
                    filtersMap.put(customFilters.Attribute_1__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_2__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_2__c)!=null){
                    filtersMap.put(customFilters.Attribute_2__c,linePicklistFields.get(customFilters.Attribute_2__c).getDescribe().getPickListValues());
                }else{
                    filtersMap.put(customFilters.Attribute_2__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_3__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_3__c)!=null){
                    filtersMap.put(customFilters.Attribute_3__c,linePicklistFields.get(customFilters.Attribute_3__c).getDescribe().getPickListValues());
                }else{
                    filtersMap.put(customFilters.Attribute_3__c,new List<Schema.PicklistEntry>());
                }
            }
            if(product.Fiber_Type__c == 'X | Mixed'){
                if(customFilters.Attribute_4__c!= null){
                    if(linePicklistFields.get(customFilters.Attribute_4__c)!=null){
                        filtersMap.put(customFilters.Attribute_4__c,linePicklistFields.get(customFilters.Attribute_4__c).getDescribe().getPickListValues());
                    }else{
                        filtersMap.put(customFilters.Attribute_4__c,new List<Schema.PicklistEntry>());
                    }
                }
                if(customFilters.Attribute_5__c!= null){
                    if(linePicklistFields.get(customFilters.Attribute_5__c)!=null){
                        filtersMap.put(customFilters.Attribute_5__c,linePicklistFields.get(customFilters.Attribute_5__c).getDescribe().getPickListValues());
                    }else{
                        filtersMap.put(customFilters.Attribute_5__c,new List<Schema.PicklistEntry>());
                    }
                }
                if(customFilters.Attribute_6__c!= null){
                    if(linePicklistFields.get(customFilters.Attribute_6__c)!=null){
                        filtersMap.put(customFilters.Attribute_6__c,linePicklistFields.get(customFilters.Attribute_6__c).getDescribe().getPickListValues());
                    }else{
                        filtersMap.put(customFilters.Attribute_6__c,new List<Schema.PicklistEntry>());
                    }
                }
                if(customFilters.Attribute_7__c!= null){
                    if(linePicklistFields.get(customFilters.Attribute_7__c)!=null){
                        filtersMap.put(customFilters.Attribute_7__c,linePicklistFields.get(customFilters.Attribute_7__c).getDescribe().getPickListValues());
                    }else{
                        filtersMap.put(customFilters.Attribute_7__c,new List<Schema.PicklistEntry>());
                    }
                }
            }
        } else if(product.Filtered_Grouping__c == 'Bus Conductor -Rectangular Bar' || product.Filtered_Grouping__c == 'Bus Conductor -Seamless Bus Pipe' || product.Filtered_Grouping__c == 'Bus Conductor -Universal Angle'){
            if(customFilters.Attribute_1__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_1__c)!=null){
                    filtersMap.put(customFilters.Attribute_1__c,linePicklistFields.get(customFilters.Attribute_1__c).getDescribe().getPickListValues());
                }else{
                    filtersMap.put(customFilters.Attribute_1__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_2__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_2__c)!=null){
                    filtersMap.put(customFilters.Attribute_2__c,linePicklistFields.get(customFilters.Attribute_2__c).getDescribe().getPickListValues());
                }else{
                    filtersMap.put(customFilters.Attribute_2__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_3__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_3__c)!=null){
                    filtersMap.put(customFilters.Attribute_3__c,linePicklistFields.get(customFilters.Attribute_3__c).getDescribe().getPickListValues());
                }else{
                    filtersMap.put(customFilters.Attribute_3__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_4__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_4__c)!=null){
                    filtersMap.put(customFilters.Attribute_4__c,linePicklistFields.get(customFilters.Attribute_4__c).getDescribe().getPickListValues());
                }else{
                    filtersMap.put(customFilters.Attribute_4__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_5__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_5__c)!=null){
                    filtersMap.put(customFilters.Attribute_5__c,linePicklistFields.get(customFilters.Attribute_5__c).getDescribe().getPickListValues());
                }else{
                    filtersMap.put(customFilters.Attribute_5__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_6__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_6__c)!=null){
                    filtersMap.put(customFilters.Attribute_6__c,linePicklistFields.get(customFilters.Attribute_6__c).getDescribe().getPickListValues());
                }else{
                    filtersMap.put(customFilters.Attribute_6__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_7__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_7__c)!=null){
                    filtersMap.put(customFilters.Attribute_7__c,linePicklistFields.get(customFilters.Attribute_7__c).getDescribe().getPickListValues());
                }else{
                    filtersMap.put(customFilters.Attribute_7__c,new List<Schema.PicklistEntry>());
                }
            }        
        } else if(product.Filtered_Grouping__c =='Cable Assemblies' || product.Filtered_Grouping__c =='Patch Panels'){
            if(customFilters.Attribute_1__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_1__c)!=null){
                    List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_1__c),product.Product_Type__c);
                    filtersMap.put(customFilters.Attribute_1__c,pickListValues);
                }else{
                    filtersMap.put(customFilters.Attribute_1__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_2__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_2__c)!=null){
                    List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_2__c),product.Product_Type__c);
                    filtersMap.put(customFilters.Attribute_2__c,pickListValues);
                }else{
                    filtersMap.put(customFilters.Attribute_2__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_3__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_3__c)!=null){
                    List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_3__c),product.Product_Type__c);
                    filtersMap.put(customFilters.Attribute_3__c,pickListValues);
                }else{
                    filtersMap.put(customFilters.Attribute_3__c,new List<Schema.PicklistEntry>());
                }
            }
            if(customFilters.Attribute_4__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_4__c)!=null){
                    List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_4__c),product.Product_Type__c);
                    filtersMap.put(customFilters.Attribute_4__c,pickListValues);
                }else{
                    filtersMap.put(customFilters.Attribute_4__c,new List<Schema.PicklistEntry>());
                }
            }         
            if(customFilters.Attribute_5__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_5__c)!=null){
                    List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_5__c),product.Product_Type__c);
                    filtersMap.put(customFilters.Attribute_5__c,pickListValues);
                }else{
                    filtersMap.put(customFilters.Attribute_5__c,new List<Schema.PicklistEntry>());
                }
            }         
            if(customFilters.Attribute_6__c!= null){
                if(linePicklistFields.get(customFilters.Attribute_6__c)!=null){
                    List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_6__c),product.Product_Type__c);
                    filtersMap.put(customFilters.Attribute_6__c,pickListValues);
                }else{
                    filtersMap.put(customFilters.Attribute_6__c,new List<Schema.PicklistEntry>());
                }
            }         
            if(product.Filtered_Grouping__c == 'Cable Assemblies'){
                if(customFilters.Attribute_7__c!= null){
                    System.debug('filter: ' + customFilters.Attribute_7__c + ' attribute : ' + productFields.get(customFilters.Attribute_7__c));
                    Map<String, Object> valuesMap = NSPDisplayFields(product,productFields.get(customFilters.Attribute_7__c));
                    for (String values : valuesMap.keySet()){
                        displayFieldsMap.put(values, valuesMap.get(values));
                    }
                } 
            }else{
                if(customFilters.Attribute_7__c!= null){                    
                    if(linePicklistFields.get(customFilters.Attribute_7__c)!=null){
                        List<Schema.PicklistEntry> pickListValues = getDependentPicklistValues(linePicklistFields.get(customFilters.Attribute_7__c),product.Product_Type__c);
                        filtersMap.put(customFilters.Attribute_7__c,pickListValues);
                    }else{
                        filtersMap.put(customFilters.Attribute_7__c,new List<Schema.PicklistEntry>());
                    }
                } 
            }
        } else if(product.Filtered_Grouping__c == 'Copperclad' || product.Filtered_Grouping__c == 'Core' || product.Filtered_Grouping__c == 'Wire'){
            if(customFilters.Attribute_1__c!= null){
                System.debug('filter: ' + customFilters.Attribute_1__c + ' attribute : ' + productFields.get(customFilters.Attribute_1__c));
                Map<String, Object> valuesMap = NSPDisplayFields(product,productFields.get(customFilters.Attribute_1__c));
                for (String values : valuesMap.keySet()){
                    displayFieldsMap.put(values, valuesMap.get(values));
                }
            } 
            if(customFilters.Attribute_2__c!= null){
                System.debug('filter: ' + customFilters.Attribute_2__c + ' attribute : ' + productFields.get(customFilters.Attribute_2__c));
                Map<String, Object> valuesMap = NSPDisplayFields(product,productFields.get(customFilters.Attribute_2__c));
                for (String values : valuesMap.keySet()){
                    displayFieldsMap.put(values, valuesMap.get(values));
                }
            } 
            if(customFilters.Attribute_3__c!= null){
                System.debug('filter: ' + customFilters.Attribute_3__c + ' attribute : ' + productFields.get(customFilters.Attribute_3__c));
                Map<String, Object> valuesMap = NSPDisplayFields(product,productFields.get(customFilters.Attribute_3__c));
                for (String values : valuesMap.keySet()){
                    displayFieldsMap.put(values, valuesMap.get(values));
                }
            } 
        }

        System.debug('list size ' + filtersMap.keyset().size());
        for(String filter : filtersMap.keyset()){
            WrappersClass.FilteringWrappingClass wrapper = new WrappersClass.FilteringWrappingClass();
            wrapper.label = filter;
            wrapper.options = JSON.serialize(filtersMap.get(filter));
            wrapper.action = 'INPUT';
            if(prodFieldsNameMap.get(filter) != null){
                wrapper.apiName = prodFieldsNameMap.get(filter);
            }else{
                wrapper.apiName = lineFieldsNameMap.get(filter);
            }
            if(prodFieldsTypeMap.get(filter) != null){
                wrapper.type = prodFieldsTypeMap.get(filter);
            }else{
                wrapper.type = lineFieldsTypeMap.get(filter);
            }
            
            filtersWrapperToShow.add(wrapper);
        }

        for(String display : displayFieldsMap.keyset()){
            WrappersClass.FilteringWrappingClass wrapper = new WrappersClass.FilteringWrappingClass();
            wrapper.label = display;
            wrapper.options = String.valueOf(displayFieldsMap.get(display));
            wrapper.action = 'DISPLAY';
            wrapper.apiName = prodFieldsNameMap.get(display);
            
            filtersWrapperToShow.add(wrapper);
        }

        String filtersToAdd = JSON.serialize(filtersWrapperToShow);
        return filtersToAdd;
    }

    //Used internally in the NSPAdditionalFields method to print the label of the NSP field and its value
    public static Map<String, Object> NSPDisplayFields(Product2 product, Schema.SObjectField field){
        Map<String, Object> valuesMap = new Map<String, String>(); //Map the label of the field and its value
        WrappersClass.FilteringWrappingClass valuesWrapperToShow = new WrappersClass.FilteringWrappingClass();
        Map<String,BL_NSP_Fields__c> custFieldsMap = BL_NSP_Fields__c.getAll(); //Get the custom fields in the custom setting

        String label = field.getDescribe().getLabel(); // Get the label of each field in the product object
        Schema.DisplayType theResult = field.getDescribe().GetType(); //get field type
        String apiName = field.getDescribe().getName(); //Stores the API name of each field object

        valuesMap.put(label,String.ValueOf(product.get(field)));

        //Get all of the custom field values from the filtered grouping - gets it from the custom settings

        BL_NSP_Fields__c customFilters = custFieldsMap.get(product.Filtered_Grouping__c);        


        return valuesMap;
    }

    @AuraEnabled
    public static void deleteQuoteLines(List<String> quoteIds){
        try {
            
            System.debug(quoteIds);

            for(String quoteId : quoteIds){
                SBQQ__QuoteLine__c obj = [SELECT Id FROM SBQQ__QuoteLine__c WHERE Id =: quoteId];
              
                delete obj;
                System.debug('paso');
            }

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}