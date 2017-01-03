/*
 * Copyright (C) 2009-2014 SAP SE or an SAP affiliate company. All rights reserved
 */
/*global jQuery: false, sap: false, cus: false, console: false, location: false, URI:false, mytravelandexpense */
(function () {
    'use strict';
    jQuery.sap.declare("mytravelandexpense.util.InputHelper");
    jQuery.sap.require("mytravelandexpense.util.PersistenceHelper");
    jQuery.sap.require("mytravelandexpense.formatter.ClaimFormatter");

    mytravelandexpense.util.InputHelper = {};

    /*****************************************************************************************************************
     *  Destination Input helper - common features for all destination fields
     *****************************************************************************************************************/

    mytravelandexpense.util.InputHelper.getDestinationCreationInfoFromCity = function (oCityContext) {
        var oDestinationCreationInfo = {
            City: "",
            District: "",
            PostalCode: "",
            CityCode: "",
            StreetName: "",
            StreetNumber: "",
            Country: "",
            Region: "",
            Location: "",
            FullName: ""
        };
        if (!!oCityContext) {
            jQuery.each(oDestinationCreationInfo, function (sPropertyName, sValue) {
                oDestinationCreationInfo[sPropertyName] = oCityContext.getProperty("Address/" + sPropertyName);
            });
        }
        return oDestinationCreationInfo;
    };

    /**
     * called when a user wish to display a destination selection dialog
     * show last used cities
     * @param {object} oSelectDialog
     * @param {object} oJsonModelLastUsedCities
     * @param {object} oODataModel
     * @param {object} oResourceBundle
     */
    mytravelandexpense.util.InputHelper.displayDestinationDelegate = function (oSelectDialog, oJsonModelLastUsedCities, oODataModel, oResourceBundle, iSource) {

        var oBindingInfo = oSelectDialog.getBindingInfo("items"), aFilters = [];

        oSelectDialog.setTitle(oResourceBundle.getText("LAST_USED_ADDRESS"));

        //reset the search (to revert to an intial state)
        // open value help dialog with the last used data if any
        if (oJsonModelLastUsedCities && oJsonModelLastUsedCities.getProperty("/Cities")) {
            oSelectDialog.bindAggregation("items", {
                path: oBindingInfo.path,
                template: oBindingInfo.template,
                filters: [],
                sorter: mytravelandexpense.util.InputHelper._getDestinationSorter(true, oResourceBundle),
                parameters: { custom: {search: ""} } // reset search
            });

            oSelectDialog.setModel(oJsonModelLastUsedCities);
        }
        else {
            if (mytravelandexpense.util.ConfigurationManager.getGlobalSettings().LastUsedAddresses) {
                iSource = iSource || 0/*LastUsed*/;

                aFilters.push(new sap.ui.model.Filter("Source", sap.ui.model.FilterOperator.EQ, iSource));
            }

            oSelectDialog.bindAggregation("items", {
                path: oBindingInfo.path,
                template: oBindingInfo.template,
                filters: aFilters,
                sorter: mytravelandexpense.util.InputHelper._getDestinationSorter(false),
                parameters: { custom: {search: ""} } // reset search
            });

            oSelectDialog.setModel(oODataModel);
        }
    };

    mytravelandexpense.util.InputHelper._getDestinationSorter = function (bIsJSON, oResourceBundle) {
        if (bIsJSON) {
            return new sap.ui.model.Sorter('Address/FullName', false, jQuery.proxy(function () {
                return oResourceBundle.getText("DESTINATION_LAST_USED_TITLE");
            }, this));
        } else {
            return new sap.ui.model.Sorter("Address/FullName", false);
        }
    };

    /**
     * called when the user search within the destination select dialog
     * @param {Event} oEvent
     * @param {object} oResourceBundle
     * @param {object} oAppModel
     * @param {object} oFilter
     */
    mytravelandexpense.util.InputHelper.handleDestinationValueHelpSearchDelegate = function (oEvent, oResourceBundle, oAppModel, oFilter, iSource) {
        var sValue = oEvent.getParameter("value"),
            aFilters = [],
            oSorter = {},
            oSelectDialog = oEvent.getSource(),
            oBindingInfo = oSelectDialog.getBindingInfo("items"),
            mParameters = { custom: {search: ""} };

        if (!!sValue) {
            mParameters = { custom: {search: sValue} };
            if (mytravelandexpense.util.ConfigurationManager.getGlobalSettings().LastUsedAddresses) {
                iSource = iSource || 1/*Predefined*/;

                aFilters.push(new sap.ui.model.Filter("Source", sap.ui.model.FilterOperator.EQ, iSource));
            }

            oSelectDialog.setTitle(oResourceBundle.getText("PREDEFINED_ADDRESS"));

        } else {
            if (mytravelandexpense.util.ConfigurationManager.getGlobalSettings().LastUsedAddresses) {
                iSource = iSource || 0/*LastUsed*/;
                aFilters.push(new sap.ui.model.Filter("Source", sap.ui.model.FilterOperator.EQ, iSource));
            }

            oSelectDialog.setTitle(oResourceBundle.getText("LAST_USED_ADDRESS"));
        }

        oSorter = mytravelandexpense.util.InputHelper._getDestinationSorter(false);
        if (oFilter && oFilter instanceof sap.ui.model.Filter) {
            aFilters.push(oFilter);
        }

        //reset the current context so it doesn't apply to the oDataModel when setting it (avoid unnecessary calls)
        if (oSelectDialog.getModel() instanceof sap.ui.model.json.JSONModel) {

            //remove model so no query is fired before the aggregation is re-bound correctly
            oSelectDialog.setModel(null);
            oSelectDialog.bindAggregation("items", {
                path: oBindingInfo.path,
                template: oBindingInfo.template,
                filters: aFilters,
                sorter: oSorter,
                parameters: mParameters
            });
            oSelectDialog.setModel(oAppModel);
        }
        else {//oData was already there, do a filter query
            oSelectDialog.bindAggregation("items", {
                path: oBindingInfo.path,
                template: oBindingInfo.template,
                filters: aFilters,
                sorter: oSorter,
                parameters: mParameters
            });
        }
    };

    /*********************************************************************************
     *  Input helpers with an Id and a description - common features for all fields
     *  that have an ID and a Description
     *  and that can optionally be filtered by Country
     *********************************************************************************/
    mytravelandexpense.util.InputHelper.handleIdDescriptionValueHelpSearch = function (oEvent, sCountryID) {
        var aFilters,
            aSorters = [new sap.ui.model.Sorter("Description", false)];
        
        aFilters = [];

        if (sCountryID) {
            aFilters = [new sap.ui.model.Filter("CountryID", sap.ui.model.FilterOperator.EQ, sCountryID)];
        }

        mytravelandexpense.util.InputHelper.handleValueHelpSearch(oEvent, aFilters, aSorters);

    };

    mytravelandexpense.util.InputHelper.handleRegionContext = function (oModel, sPath, sCountryID, fnCallback) {
        if (sCountryID) {
            oModel.read(sPath + "/$count", {
                    context: null,
                    urlParameters: "$filter=" + jQuery.sap.encodeURL("CountryID" + " eq " + "'" + sCountryID + "'"),
                    async: true,
                    success: function (iCount) {
                        if (fnCallback && typeof fnCallback === "function") {
                            fnCallback((iCount && parseInt(iCount, 10) > 0));
                        }
                    }
                }
            );

        }
    };

    mytravelandexpense.util.InputHelper.handleIdDescriptionSuggest = function (oEvent, sPath, sCountryID) {
        var sNewValue, aFilters, oSorter, sCustomModel;
        aFilters = [];

        // retrieve the model name from the path if different than the view model
        sCustomModel = sPath.substr(0, sPath.indexOf(">") + 1);

        oSorter = new sap.ui.model.Sorter("Description", false);
        sNewValue = oEvent.getParameter("suggestValue");
        //we first set the suggestionItems binding = trigger a request to backend before doing the smartSuggest
        if (sCountryID) {
            aFilters = [
                new sap.ui.model.Filter("CountryID", sap.ui.model.FilterOperator.EQ, sCountryID)];
        }
        // A filter is done by the input through is _fnFilter property
        // in the current version it is not possible to.
        // In future version (1.21.2-SNAPSHOT and beyond) we'll use we'll use
        // http://veui5infra.dhcp.wdf.sap.corp:8080/demokit/#docs/api/symbols/sap.m.Input.html
        // filterSuggests : boolean (default: true).
        // From now on, we use the setFilterFunction() function
        // http://veui5infra.dhcp.wdf.sap.corp:8080/demokit-1.20/#docs/api/symbols/sap.m.Input.html:
        // setFilterFunction() : boolean
        // Sets a custom filter function for suggestionItems.
        // Default is to check whether the item text begins with the typed value.
        // This filter function is called with two parameters: the first one is the string that is currently typed in the input
        // and the second one is the item that is being filtered. Returning true will add this item to the popup.
        //
        var fnFilter = function(i, s){return true;};
        oEvent.getSource().setFilterFunction(fnFilter);

        if (!oEvent.getSource().getBindingInfo("suggestionItems")) {
            //this will trigger the query
            oEvent.getSource().bindAggregation("suggestionItems", {
                path: sPath,
                filters: aFilters,
                sorter: oSorter,
                startIndex: 0,
                length: 10,
                parameters: { custom: {search: sNewValue} },
                template: new sap.ui.core.Item({text: "{" + sCustomModel + "Description}"})
            });
        }
        else {
            //this will trigger the query and update the binding
            oEvent.getSource().bindAggregation("suggestionItems", {
                path: sPath,
                filters: aFilters,
                sorter: oSorter,
                startIndex: 0,
                length: 10,
                parameters: { custom: {search: sNewValue} },
                template: new sap.ui.core.Item({text: "{" + sCustomModel + "Description}"})
            });
        }
    };

    /**
     *
     * @param {Event} oEvent
     * @param {object} oInput
     * @param {string} sIdPropertyName
     * @returns An object with properties sID and sDescription
     */
    mytravelandexpense.util.InputHelper.handleValueHelpClose = function (oEvent, oInput, sIdPropertyName) {
        var oIdDesc,
            oBindingContext,
            oSelectedItem = oEvent.getParameter("selectedItem");

        if (oSelectedItem) {
            oInput.setValueState(sap.ui.core.ValueState.None);
            oBindingContext = oSelectedItem.getBindingContext();
            oIdDesc = { sID: oBindingContext.getProperty(sIdPropertyName),
                sDescription: oBindingContext.getProperty("Description")  };
        }
        return oIdDesc;
    };


    /**
     *
     * @param {Event} oEvent
     * @param {string} sIdPath
     * @returns An object with properties sID and sDescription
     */
    mytravelandexpense.util.InputHelper.handleIdDescriptionChange = function (oEvent, sIdPath) {
        var oInput = oEvent.getSource(),
            sValue = oEvent.getParameter("newValue"),
            oSuggestionItem = null,
            i, aSuggestionItems, oIdDesc, oBindingContext, sModelName, sIdPropertyName, aSplit;

        oInput.setValueState(sap.ui.core.ValueState.None);

        if (sValue === "") {
            oIdDesc = { sID: "",
                sDescription: ""};
        }
        else {
            //validation step: check if the value belongs to the suggestion items
            aSuggestionItems = oInput.getSuggestionItems();

            for (i = 0; (oSuggestionItem === null) && i < aSuggestionItems.length; i++) {
                if ((aSuggestionItems[i].getText() === sValue)) {
                    oSuggestionItem = aSuggestionItems[i];
                }
            }
            var sID, sDescription;
            if (oSuggestionItem !== null) {

                // retrieves property name, and model name if model name is different than the one from the view
                aSplit = sIdPath.split(">");
                if (aSplit.length > 1) {
                    sModelName = aSplit[0];
                    sIdPropertyName = aSplit[1];
                } else {
                    sIdPropertyName = aSplit[0];
                }

                if (sModelName) {
                    oBindingContext = oSuggestionItem.getBindingContext(sModelName);
                } else {
                    oBindingContext = oSuggestionItem.getBindingContext();
                }

                if (oBindingContext) {
                    sID = oBindingContext.getProperty(sIdPropertyName);
                    sDescription = oBindingContext.getProperty("Description");
                    oIdDesc = { sID: sID,
                        sDescription: sDescription};
                }

            }
            else {
                oInput.setValueState(sap.ui.core.ValueState.Error);
            }
        }
        return oIdDesc;

    };

    /*****************************************************************************************************************
     *  CostAssignment Input helper - common features for all CostAssignment fields
     *****************************************************************************************************************/
    mytravelandexpense.util.InputHelper.handleCostAssignmentValueHelpSearchDelegate = function (oEvent, aDefaultFilters, oModel) {
        var sValue, oList, oBindingInfo, aFilters, aSorters, bSetModel, mParameters;
        sValue = oEvent.getParameter("value");
        oList = oEvent.getSource();

        if (oList) {
            if (oList.getModel() !== oModel) {
                bSetModel = true;
                oList.setModel(null);
            }

            if (sValue) {
                aFilters = aDefaultFilters.slice(0);
                aSorters = [ new sap.ui.model.Sorter("Description", false) ];
                mParameters = { custom: {search: sValue} };
            }
            else {
                aFilters = aDefaultFilters;
                aSorters = [ new sap.ui.model.Sorter("Description", false) ];
                mParameters = {}; // reset search
            }

            oBindingInfo = oList.getBindingInfo("items");
            oList.bindAggregation("items", {
                path: oBindingInfo.path,
                template: oBindingInfo.template,
                filters: aFilters,
                sorter: aSorters,
                parameters: mParameters
            });

            if (bSetModel) {
                oList.setBindingContext(new sap.ui.model.Context(oModel, mytravelandexpense.util.ConfigurationManager.getUserProfilePath()));
                oList.setModel(oModel);
            }
        }
    };

    mytravelandexpense.util.InputHelper.getDefaultFilterForCostObject = function (oCostAssignmentSelect) {
        var oSelectedItem, oContext, aItems, aFilters = [];
        oSelectedItem = oCostAssignmentSelect.getSelectedItem();

        if (oSelectedItem) {
            oContext = oSelectedItem.getBindingContext();
        } else {
            aItems = oCostAssignmentSelect.getItems();
            if (Array.isArray(aItems) && aItems.length > 0) {
                oContext = aItems[0].getBindingContext();
            }
        }

        if (oContext) {
            aFilters.push(mytravelandexpense.util.InputHelper.getCostObjectFilterFromCostObjectType(oContext));
        }

        return aFilters;
    };

    mytravelandexpense.util.InputHelper.getCostObjectFilterFromCostObjectType = function (oContext) {
        var sCostObjectTypeID = oContext.getProperty("CostObjectTypeID");
        return new sap.ui.model.Filter("CostObjectTypeID", sap.ui.model.FilterOperator.EQ, sCostObjectTypeID);
    };

    mytravelandexpense.util.InputHelper.bindCostObjectItems = function (oSelectDialog, oContext) {
        var oBindingInfo = oSelectDialog.getBindingInfo("items"),
            aFilters = [mytravelandexpense.util.InputHelper.getCostObjectFilterFromCostObjectType(oContext)];

        oSelectDialog.bindAggregation("items", {
            path: oBindingInfo.path,
            template: oBindingInfo.template,
            filters: aFilters,
            sorter: [ new sap.ui.model.Sorter("Description", false) ],
            parameters: oBindingInfo.parameters // The search
        });
    };

    mytravelandexpense.util.InputHelper.getCostAssignmentCreationInfoFromCostObject = function (oCostAssignmentCreationContext, sId, sType) {

        var oCostAssignmentCreationInfo = {
            Percentage: "0",
            CostObjectDescription: oCostAssignmentCreationContext.getProperty("Description"),
            CostObjectID: oCostAssignmentCreationContext.getProperty("CostObjectID"),
            CostObjectTypeID: oCostAssignmentCreationContext.getProperty("CostObjectTypeID"),
            CostObjectTypeDescription: oCostAssignmentCreationContext.getProperty("CostObjectTypeDescription"),
            TravelAndExpenseHeaderID: "",
            ExpenseID: "",
            MileageID: "",
            ExpandParametersKey: ""
        };

        switch (sType) {
            case "Mileage":
                oCostAssignmentCreationInfo["MileageID"] = encodeURI(sId);
                oCostAssignmentCreationInfo["ExpandParametersKey"] = "Mileage/CostAssignments";
                break;
            case "Expense":
                oCostAssignmentCreationInfo["ExpenseID"] = encodeURI(sId);
                oCostAssignmentCreationInfo["ExpandParametersKey"] = "Expense/CostAssignments";
                break;
            case "TravelAndExpenseHeader":
                oCostAssignmentCreationInfo["TravelAndExpenseHeaderID"] = encodeURI(sId);
                oCostAssignmentCreationInfo["ExpandParametersKey"] = "TravelAndExpenseHeader/CostAssignments";
                break;
        }
        return oCostAssignmentCreationInfo;
    };

    /**
     * update a cost assignment information
     * @param {object} oModel  odata model
     * @param {string} sCostAssignmentID id of the cost assignment to update
     * @param {object} oCostAssignmentCreationInfo information to update the cost assignment with
     * @param {Function} fnCallBack
     */
    mytravelandexpense.util.InputHelper.updateCostAssignment = function (oModel, sCostAssignmentID, oCostAssignmentCreationInfo, fnCallBack) {
        var oCostAssignmentContext = new sap.ui.model.Context(oModel, "/" + mytravelandexpense.util.PersistenceHelper.getEntityPath("CostAssignments", sCostAssignmentID));

        oModel.setProperty("CostObjectDescription", oCostAssignmentCreationInfo.CostObjectDescription, oCostAssignmentContext);
        oModel.setProperty("CostObjectID", oCostAssignmentCreationInfo.CostObjectID, oCostAssignmentContext);
        oModel.setProperty("CostObjectTypeID", oCostAssignmentCreationInfo.CostObjectTypeID, oCostAssignmentContext);
        oModel.setProperty("CostObjectTypeDescription", oCostAssignmentCreationInfo.CostObjectTypeDescription, oCostAssignmentContext);
        var oBusy = new sap.m.BusyDialog();
        oBusy.open();
        mytravelandexpense.util.PersistenceHelper.autoSave(jQuery.proxy(function() {
        	 	jQuery.sap.delayedCall(0, this, function() {oBusy.close();});
        	 	if (typeof fnCallBack === "function") {
        	 		fnCallBack.apply(this, arguments);        		 
        	 	}
        	},this));        
    };


    /**
     * Called when a user changes or adds a cost assignment
     * @param {object} oController
     * @param {string} sCostAssignmentID
     * @param {string} sCostObjectType
     */
    mytravelandexpense.util.InputHelper.displayCostObjects = function (oController, sCostAssignmentID, sCostObjectType, oJsonModelLastUsedCostObjects) {
        var fnCallBack, oContextItem, oBindingInfo, fnOpenSelectDialog, oModel, oNewModel, oNewContext;

        oModel = oController.oApplicationFacade.getODataModel();

        fnOpenSelectDialog = jQuery.proxy(function (oEvent) {
            oModel.detachRequestCompleted(fnOpenSelectDialog);
            if (sCostAssignmentID) {
                oController.costAssignmentSelectDialog.data("sCostID", sCostAssignmentID);
            }
            oController.costAssignmentSelectDialog.open();
        }, oController);

        if (!oController.costAssignmentSelectDialog) {
            //step1: create the xml fragment
            oController.costAssignmentSelectDialog = sap.ui.xmlfragment(oController.createFragmentId("CostAssignmentSelectDialog"), "mytravelandexpense.view.CostAssignmentSelectDialog", oController);
            oController.costAssignmentSelectDialog.setModel(oController.oApplicationFacade.getODataModel("i18n"), "i18n");
            oController.costAssignmentSelect = oController.costAssignmentSelectDialog.getSelect();

            //step2: retrieve the cost object types for the "filter" select control
            fnCallBack = jQuery.proxy(function (oEvent) {
                oModel.detachRequestCompleted(fnCallBack);

                //the binding has set the cost object types into the select control
                //if the parent controller ask for a specific cost object type, we'll select it
                //otherwise we'll auto-select the first one
                //then we'll set the filter for the cost objects on it
                var aItems = oController.costAssignmentSelect.getItems();

                if (Array.isArray(aItems) && aItems.length > 0) {
                    if (!!sCostObjectType) {
                        oController.costAssignmentSelect.setSelectedKey(sCostObjectType);

                    }

                    //the sCostObjectType provided matched something in the collection
                    if (oController.costAssignmentSelect.getSelectedItem()) {
                        oContextItem = oController.costAssignmentSelect.getSelectedItem().getBindingContext();
                    }
                    else {
                        oController.costAssignmentSelect.setSelectedKey(aItems[0].getKey());
                        oContextItem = aItems[0].getBindingContext();
                    }

                    //we'll do a first binding on the odatamodel + the filtering cost object type
                    //we don't set the bindingContext yet
                    mytravelandexpense.util.InputHelper.bindCostObjectItems(oController.costAssignmentSelectDialog, oContextItem);
                }

                //if a last used model is provided, we'll do a binding on the lastUsed model regardless to the retrieved cost object types
                if (oJsonModelLastUsedCostObjects && oJsonModelLastUsedCostObjects.getProperty("/CostObjects")) {
                    oController.costAssignmentSelectDialog.setBindingContext(new sap.ui.model.Context(oJsonModelLastUsedCostObjects, "/"));
                    oController.costAssignmentSelectDialog.setModel(oJsonModelLastUsedCostObjects);

                    fnOpenSelectDialog();
                }

                //else we will bind onto the OData Model and we will set the binding context which will trigger the query with the preselected item
                else {
                    oModel.attachRequestCompleted(fnOpenSelectDialog);

                    oController.costAssignmentSelectDialog.setBindingContext(new sap.ui.model.Context(oModel, mytravelandexpense.util.ConfigurationManager.getUserProfilePath()));
                    oController.costAssignmentSelectDialog.setModel(oModel);
                }

            }, oController);

            oModel.attachRequestCompleted(fnCallBack);
            oController.costAssignmentSelect.setModel(oModel); //fire the query cost object type query

        }
        //we already have the dialog initialized
        else {
            //reset the search (to revert to an initial state)
            if (!!sCostObjectType) {
                oController.costAssignmentSelect.setSelectedKey(sCostObjectType);
            } else {
                oController.costAssignmentSelect.setSelectedKey("");
            }
            oBindingInfo = oController.costAssignmentSelectDialog.getBindingInfo("items");
            if (oJsonModelLastUsedCostObjects && oJsonModelLastUsedCostObjects.getProperty("/CostObjects")) {

                if (oController.costAssignmentSelectDialog.getModel() !== oJsonModelLastUsedCostObjects) {
                    oNewModel = oJsonModelLastUsedCostObjects;
                    oNewContext = new sap.ui.model.Context(oJsonModelLastUsedCostObjects, "/");

                    oController.costAssignmentSelectDialog.setModel(null);
                }

            } else {
                if (oController.costAssignmentSelectDialog.getModel() !== oModel) {
                    oNewModel = oModel;
                    oNewContext = new sap.ui.model.Context(oModel, mytravelandexpense.util.ConfigurationManager.getUserProfilePath());

                    oController.costAssignmentSelectDialog.setModel(null);
                }
            }

            oController.costAssignmentSelectDialog.bindAggregation("items", {
                path: oBindingInfo.path,
                template: oBindingInfo.template,
                filters: mytravelandexpense.util.InputHelper.getDefaultFilterForCostObject(oController.costAssignmentSelect),
                sorter: [ new sap.ui.model.Sorter("Description", false) ],
                parameters: { custom: {search: ""} } // reset search
            });

            if (oNewModel && oNewContext) {
                oController.costAssignmentSelectDialog.setBindingContext(oNewContext);
                oController.costAssignmentSelectDialog.setModel(oNewModel);
            }

            if (oController.costAssignmentSelectDialog.getModel() instanceof sap.ui.model.json.JSONModel) {
                fnOpenSelectDialog();
            } else {
                oModel.attachRequestCompleted(fnOpenSelectDialog);
            }
        }
    };

    /**
     * check if the value is a valid percentage
     * @param {string} sValue
     * @return {Boolean} is a valid percentage value
     */
    mytravelandexpense.util.InputHelper.validatePercentage = function (sValue) {
        var isValid = false;
        // Non empty value
        if (!!sValue) {
            // value is a integer and  [0, 100]
            if ((jQuery.isNumeric(sValue) && Math.floor(sValue) === sValue) && (sValue <= 100 && sValue >= 0)) {
                isValid = true;
            }
        }
        return isValid;
    };

    /**
     * Initialize the Cost Assignment UI Model with the proper the default values
     * @param {object} oController
     */
    mytravelandexpense.util.InputHelper.initializeCostAssignmentModel = function (oController) {
        oController._oCostAssignmentModel = new sap.ui.model.json.JSONModel({
            bProportionEditable: true,
            bProportionVisible: true,
            bProportionValid: sap.ui.core.ValueState.None
        });

        oController.getView().setModel(oController._oCostAssignmentModel, "costAssignmentModel");
    };

    /**
     * Set proportion properties on Cost Assignment UI model
     * @param {object} oController
     * @param {string} sPath
     */
    mytravelandexpense.util.InputHelper.setCostAssignmentProportionProperties = function (oController, sPath) {
        // Use of a json model to handle properly the "Multi" mode which only exist as a UI
        var oModel = oController.oApplicationFacade.getODataModel(),
            oContext = new sap.ui.model.Context(oModel, sPath),
            aCostAssignments = oContext.getProperty("CostAssignments"),
            bVisible = false,
            bEditable = true;

        // cost assignment proportion visibility
        if (!!aCostAssignments) {
            // multi cost assignment
            if (aCostAssignments.length > 1) {
                bVisible = true;
            }
            // if there is a single cost assignment  we a value less than 100%,
            // let the user change the value so that it is 100%,  i.e. show the input box in this case
            else if (aCostAssignments.length === 1) {
                var oCostAssignmentContext = new sap.ui.model.Context(oModel, "/" + aCostAssignments[0]),
                    iCostAssignmentPercentage = oCostAssignmentContext.getProperty("Percentage");
                bVisible = iCostAssignmentPercentage < 100;
                bEditable = bVisible;
            }
        }

        oController._oCostAssignmentModel.setProperty("/bProportionVisible", bVisible);
        oController._oCostAssignmentModel.setProperty("/bProportionEditable", bEditable);
        // set the value state of the proportion allocation
        oController._oCostAssignmentModel.setProperty("/bProportionValid", mytravelandexpense.util.InputHelper.getValueStates(oController));
    };

    /**
     * Show or hide the assignments list inside the views
     * @param {object} oController
     * @param {boolean} bShow
     */
    mytravelandexpense.util.InputHelper.showCostAssignmentList = function (oController, bShow) {
    	var oLabel = oController.byFragmentId("costAssignmentLabel");
    	var oList = oController.byFragmentId("costAssignmentList");
    	var oButton = oController.byFragmentId("costAssignmentAddButton");
    	
    	if (oLabel) {
    		oLabel.setVisible(bShow);
    	}
    	
    	if (oList) {
    		oList.setVisible(bShow);
    	}
    	if (oButton) {
    		oButton.setVisible(bShow);
    	}
    };

    mytravelandexpense.util.InputHelper.checkManageCostAssignmentVisibility = function (oController, sOverrideProperty) {
        // Use of a json model to handle properly the "Multi" mode which only exist as a UI
        var oModel = oController.oApplicationFacade.getODataModel(),
            oHeaderContext = new sap.ui.model.Context(oModel, oController.sTravelAndExpensePath),
            aCostAssignments = oHeaderContext.getProperty("CostAssignments"),
            oButton = oController.byFragmentId("costAssignmentButton"),
            bOverrideCostAssignment = oHeaderContext.getProperty(sOverrideProperty);

        if (oButton) {
        	oButton.setVisible(bOverrideCostAssignment);
        }    
        
        // right to override AND cost assignment list non empty
        if (bOverrideCostAssignment && (!!aCostAssignments && aCostAssignments.length > 0)) {
            mytravelandexpense.util.InputHelper.showCostAssignmentList(oController, true);
            oController.handleManageCostAssignmentPress();
        } else {
            mytravelandexpense.util.InputHelper.showCostAssignmentList(oController, false);
        }
    };

    /**
     * called when the percentage value is changed
     * @param {object} oController
     * @param {string} sValue
     * @param {Event} oEvent
     * @param {Function} fnCallBack
     */
    mytravelandexpense.util.InputHelper.validateAllocation = function (oController, sValue, oEvent, fnCallBack) {
        var oModel = oController.oApplicationFacade.getODataModel(),
            oBindingInfo = oEvent.getSource().getBindingInfo("value"),
            oContext = oEvent.getSource().getBindingContext(),
            sProperty = oBindingInfo.parts[0].path;

        oModel.setProperty(sProperty, sValue, oContext);
        // set the value state of the proportion allocation
        oController._oCostAssignmentModel.setProperty("/bProportionValid", mytravelandexpense.util.InputHelper.getValueStates(oController));

        if (fnCallBack && typeof fnCallBack === "function") {
            fnCallBack();
        }

    };

    /**
     * called to figure out if the total sum of percentage is valid (i.e gt 100)
     * @param {object} oController
     * @return {*}
     */
    mytravelandexpense.util.InputHelper.getValueStates = function (oController) {
        var iSum,
            sValueState = sap.ui.core.ValueState.None,
            oList = oController.byFragmentId("costAssignmentList"),
            aItems = oList.getItems();

        // there is more than two items in the list
        iSum = 0;
        for(var i = 0, total = aItems.length; i < total; i++){
            var aInputs;
            if (typeof oList.getItems()[i].getInputs === "function") {
            	// used if the CostAssignmentListItem Control is used
            	aInputs = oList.getItems()[i].getInputs(); 
            } else {
            	// this must be identical to the CostAssignments fragment structure! FlexBox -> Items -> HBox -> Items -> Input Control
            	aInputs = oList.getItems()[i].getContent()[0].getAggregation("items")[1].getAggregation("items")[0];
            }
            
            if (Array.isArray(aInputs) && aInputs.length > 0) {
                var currentValue = parseInt(oList.getItems()[i].getInputs()[0].getValue(), 10);
                if (!isNaN(currentValue)) {
                    iSum += currentValue;
                }
            }
        }
        // Error: total iSum is superior from 100%
        if (iSum > 100) {
            // No error: total iSum is != 100%
            sValueState = sap.ui.core.ValueState.Error;
        }
        return sValueState;
    };

    /***
     * Create the destination country filter
     *    a.    Country eq <UserProfile.Country>  (for Domestic_International.Domestic)
     *    b.    Country ne <UserProfile.Country> (for Domestic_International.International)
     *    c.    <no filter> (for Domestic_International.NoDistinction)
     *
     * @return {object} the filter object, null for no filter
     */
    mytravelandexpense.util.InputHelper.createDestinationCountryFilter = function (iDomesticInternationalSetting) {
        var oFilter, sUserProfileCountry, eDomestic_International;

        sUserProfileCountry = mytravelandexpense.util.ConfigurationManager.getUserProfile().Country;

        // enum for Domestic_International
        eDomestic_International = {
            Domestic: 0,
            International: 1,
            NoDistinction: 2
        };

        switch (iDomesticInternationalSetting) {
            case eDomestic_International.Domestic:
                oFilter = new sap.ui.model.Filter("Address/Country", sap.ui.model.FilterOperator.EQ, sUserProfileCountry);
                break;
            case eDomestic_International.International:
                oFilter = new sap.ui.model.Filter("Address/Country", sap.ui.model.FilterOperator.NE, sUserProfileCountry);
                break;
            default:
                oFilter = null;
                break;
        }

        return oFilter;
    };

    /*********************************************************************************
     SELECT DIALOG MANAGEMENT
     *********************************************************************************/


    /**
     * called when something is searched in the provider selection dialog
     * @param {Event} oEvent
     */
    mytravelandexpense.util.InputHelper.handleTaxSelectDialogSearchDelegate = function (oEvent) {

        var aSorters = [new sap.ui.model.Sorter("TaxCodeID", false) ];
        mytravelandexpense.util.InputHelper.handleValueHelpSearch(oEvent, [], aSorters);
    };


    /**
     * called when something is searched in any selection dialog
     * @param {Event} oEvent
     * @param {Array} aFilters? optional
     * @param {Array} aSorters? optional
     */
    mytravelandexpense.util.InputHelper.handleValueHelpSearch = function (oEvent, aFilters, aSorters) {
        var oList = oEvent.getSource(),
            sValue = oEvent.getParameter("value"),
            oBindingInfo,
            mParameters = { custom: {search: ""} };

        if (oList) {
            if (sValue) {
                mParameters = { custom: {search: sValue} };
            }

            oBindingInfo = oList.getBindingInfo("items");
            oList.bindAggregation("items", {
                path: oBindingInfo.path,
                template: oBindingInfo.template,
                filters: aFilters,
                sorter: aSorters,
                parameters: mParameters
            });

            jQuery.sap.delayedCall(0, this, sap.ca.ui.utils.busydialog.releaseBusyDialog);
        }
    };

    /**
     * Called when the user leaves the input field
     * @param {Event} oEvent                The Event
     * @param {Function} fnUpdateModel         The function to update model properties
     * @param {object} oParam                {IDKey : IDValue, DescKey : DescValue}
     */
    mytravelandexpense.util.InputHelper.handleSelectDialogInputValueChange = function (oEvent, fnUpdateModel, oParam) {
        var oInput = oEvent.getSource(),
            sValue = oEvent.getParameter("newValue"),
            oSuggestionItem = null,
            i,
            aSuggestionItems,
            newValue;

        if (sValue !== "") {
            //validation step: check if the value belongs to the suggestion items
            aSuggestionItems = oInput.getSuggestionItems();

            for (i = 0; (oSuggestionItem === null) && i < aSuggestionItems.length; i++) {
                if ((aSuggestionItems[i].getText() === sValue)) {
                    oSuggestionItem = aSuggestionItems[i];
                }
            }

            if (oSuggestionItem !== null) {
                oInput.setValueState(sap.ui.core.ValueState.None);
                for (var propertyName in oParam){
                    newValue = oSuggestionItem.getBindingContext().getProperty(propertyName);
                    fnUpdateModel(oParam[propertyName], newValue);
                }
            }
            else {
                oInput.setValueState(sap.ui.core.ValueState.Error);
            }
        }
    };

    /**
     * Display a select dialog
     * instantiate the select dialog and store a reference on the provided controller under the provided sDialogName
     * set the binding context to the sPath with the given filters and sorters
     * @param {object} oController
     * @param {string} sPath
     * @param {string} sDialogName
     * @param {Array} aFilters optional
     * @param {Array} aSorters optional
     */
    mytravelandexpense.util.InputHelper.displaySelectDialog = function (oController, sPath, sDialogName, aFilters, aSorters) {
    	// Use default callback method names that must be defined in each controller for compatibility reasons with
    	// existing calls. New implementations should directly provide the callback methods.
    	if (sDialogName === "CountrySelectDialog") {
    		mytravelandexpense.util.InputHelper.displaySelectDialogWithCallback(oController, sPath, sDialogName, oController.handleCountryValueHelpSearch, oController.handleCountryValueHelpClose, aFilters, aSorters);	
    	} else {
    		mytravelandexpense.util.InputHelper.displaySelectDialogWithCallback(oController, sPath, sDialogName, null, null, aFilters, aSorters);
    	}
    	
    };
    
    /**
     * Display a select dialog
     * instantiate the select dialog and store a reference on the provided controller under the provided sDialogName
     * set the binding context to the sPath with the given filters and sorters
     * @param {object} oController
     * @param {string} sPath
     * @param {string} sDialogName
     * @param {function} fnFunctionName Callback function for search optional
     * @param {function} fnFunctionName Callback function for confirm optional
     * @param {Array} aFilters optional
     * @param {Array} aSorters optional
     */
    mytravelandexpense.util.InputHelper.displaySelectDialogWithCallback = function (oController, sPath, sDialogName, fnSearch, fnConfirm, aFilters, aSorters) {
    	var oApplicationFacade, oControl, oModel, oBindingInfo;

        oApplicationFacade = oController.oApplicationFacade || sap.ca.scfld.md.app.Application.getImpl().oConfiguration.oApplicationFacade;
        oControl = oController[sDialogName];

        if (!oControl) {
            oControl = sap.ui.xmlfragment(oController.getView().getId() + sDialogName, "mytravelandexpense.view." + sDialogName, oController);
            oController[sDialogName] = oControl;
            oControl.setModel(oApplicationFacade.getODataModel("i18n"), "i18n");
            oControl.setModel(oApplicationFacade.getODataModel("userProfile"), "userProfile");
            if (fnConfirm) {
            	oControl.attachConfirm(fnConfirm, oController);	
            }
            if (fnSearch) {
            	oControl.attachSearch(fnSearch, oController);
            	
            	mytravelandexpense.util.InputHelper.attachLiveChange(oControl, oController, fnSearch, aFilters, aSorters);
            }

            if (aFilters || aSorters) {
                oBindingInfo = oController[sDialogName].getBindingInfo("items");
                oController[sDialogName].bindAggregation("items", {
                    path: oBindingInfo.path,
                    template: oBindingInfo.template,
                    filters: aFilters || [],
                    sorter: aSorters || [],
                    parameters: { custom: {search: ""} } // reset search
                });
            }

            oModel = oApplicationFacade.getODataModel();
            oControl.setBindingContext(new sap.ui.model.Context(oModel, sPath));
            oControl.setModel(oModel);
        } else {
            oBindingInfo = oController[sDialogName].getBindingInfo("items");
            oController[sDialogName].bindAggregation("items", {
                path: oBindingInfo.path,
                template: oBindingInfo.template,
                filters: aFilters || [],
                sorter: aSorters || [],
                parameters: { custom: {search: ""} } // reset search
            });
        }

        jQuery.sap.delayedCall(0, this, sap.ca.ui.utils.busydialog.releaseBusyDialog);
        oController[sDialogName].open();
    };
    
    /**
     * Attach a liveChange event to a SelectDialog control that calls the
     * fnSearch parameter if 3 or more character are provided in the search
     * field.
     * @param {object} oControl SelectDialog control instance
     * @param {object} oController controller context
     * @param {function} fnSearch Callback function for search optional
     * @param {Array} aFilters optional
     * @param {Array} aSorters optional
     */    
    mytravelandexpense.util.InputHelper.attachLiveChange = function(oControl, oController, fnSearch, aFilters, aSorters) {
    	var fnOnLiveChange = function(oEvent, oData) {
    		var sValue = oEvent.getParameter("value");
    		if (sValue && sValue.length > 2) {
    			oData.callback.apply(this, [oEvent, aFilters, aSorters]); 
    		}
    	};
    	
    	oControl.attachLiveChange({ callback: fnSearch }, fnOnLiveChange, oController);
    };

    /**
     * The method will return true if the event is of type "search" or
     * "liveSearch" with at least 3 characters. Otherwise it will return false.
     * @param {object} oEvent Event of type search or liveSearch
     */
    mytravelandexpense.util.InputHelper.getContinueSearch = function(oEvent) {
    	if (oEvent.sId === "search") return true;
    	if (oEvent.sId === "liveChange") {
		var sValue = oEvent.getParameter("value");
			if (sValue && sValue.length > 2) {
				return true; 
			}
    	}
    	return false;
    };
    
    /**
     * Display a PerDiemRegion select dialog
     * @param {object} oController
     * @param {string} sPath
     * @param {function} fnFunctionName Callback function for search
     * @param {function} fnFunctionName Callback function for confirm
     * @param {Array} aFilters optional
     * @param {Array} aSorters optional
     * @param {object} oJsonModelLastUsedPerDiemRegions optional
     */
    mytravelandexpense.util.InputHelper.displayPerDiemRegionSelectDialog = function (oController, sPath, fnSearch, fnConfirm, aFilters, aSorters, oJsonModelLastUsedPerDiemRegions) {
        var oApplicationFacade, oControl, oModel, oBindingInfo, fnCallBack;

        oApplicationFacade = oController.oApplicationFacade || sap.ca.scfld.md.app.Application.getImpl().oConfiguration.oApplicationFacade;
        oControl = oController.PerDiemRegionSelectDialog;
        var oBusy = new sap.m.BusyDialog();
        oBusy.open();
       
        if (!oControl) {
            oControl = sap.ui.xmlfragment(oController.getView().getId() + "PerDiemRegionSelectDialog", "mytravelandexpense.view.PerDiemRegionSelectDialog", oController);
            oController.PerDiemRegionSelectDialog = oControl;
            oControl.setModel(oApplicationFacade.getODataModel("i18n"), "i18n");
            oControl.setModel(oApplicationFacade.getODataModel("userProfile"), "userProfile");
            oControl.attachConfirm(fnConfirm, oController);
            oControl.attachSearch(fnSearch, oController);
            mytravelandexpense.util.InputHelper.attachLiveChange(oControl, oController, fnSearch, aFilters, aSorters);

            if (aFilters || aSorters) {
                oBindingInfo = oController.PerDiemRegionSelectDialog.getBindingInfo("items");
                oController.PerDiemRegionSelectDialog.bindAggregation("items", {
                    path: oBindingInfo.path,
                    template: oBindingInfo.template,
                    filters: aFilters || [],
                    sorter: aSorters || [],
                    parameters: { custom: {search: ""} } // reset search
                });
            }

            var setModel = function() {
            		if (oJsonModelLastUsedPerDiemRegions && oJsonModelLastUsedPerDiemRegions.getProperty("/PerDiemRegions")) {
		            	// set recently used model
		            	oControl.setBindingContext(new sap.ui.model.Context(oJsonModelLastUsedPerDiemRegions, "/"));
		            	oControl.setModel(oJsonModelLastUsedPerDiemRegions);
		            } else {
		            	// default backend model
		                oModel = oApplicationFacade.getODataModel();
		                oControl.setBindingContext(new sap.ui.model.Context(oModel, sPath));
		                oControl.setModel(oModel);
		            }
            };
            
            if (oJsonModelLastUsedPerDiemRegions && oJsonModelLastUsedPerDiemRegions.getProperty("/PerDiemRegionsInitialized") === false) {
        		// wait until content was loaded
            	var oPropertyContext = oJsonModelLastUsedPerDiemRegions.bindProperty("/PerDiemRegionsInitialized");
            	fnCallBack = function (oEvent) {
            		oPropertyContext.detachChange(fnCallBack);
                	setModel();
                	
                	jQuery.sap.delayedCall(0, this, function() { oBusy.close();} );
	                oController.PerDiemRegionSelectDialog.open();
                };
            	oPropertyContext.attachChange(fnCallBack);
        		return;
            }
            
            setModel();
            
        } else {
        	// dialog is already instantiated but re-opened, exchange model if required
        	if (oJsonModelLastUsedPerDiemRegions && 
        	    oJsonModelLastUsedPerDiemRegions.getProperty("/PerDiemRegions") && 
        	    oControl.getModel() !== oJsonModelLastUsedPerDiemRegions) {
        		
        		oControl.setBindingContext(new sap.ui.model.Context(oJsonModelLastUsedPerDiemRegions, "/"));
            	oControl.setModel(oJsonModelLastUsedPerDiemRegions);
        	}
        	
            oBindingInfo = oController.PerDiemRegionSelectDialog.getBindingInfo("items");
            oController.PerDiemRegionSelectDialog.bindAggregation("items", {
                path: oBindingInfo.path,
                template: oBindingInfo.template,
                filters: aFilters || [],
                sorter: aSorters || [],
                parameters: { custom: {search: ""} } // reset search
            });
        }

        jQuery.sap.delayedCall(0, this, function() { oBusy.close();} );
        oController.PerDiemRegionSelectDialog.open();
    };
})();
