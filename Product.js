'use strict';

/**
 * Controller that renders product detail pages and snippets or includes used on product detail pages.
 * Also renders product tiles for product listings.
 *
 * @module controllers/Product
 */

var params = request.httpParameterMap;

/* Script Modules */
var app = require('~/cartridge/scripts/app');
var guard = require('~/cartridge/scripts/guard');
var URLUtils = require('dw/web/URLUtils');
var ProductAvailabilityModel = require('dw/catalog/ProductAvailabilityModel');
/**
 * Renders the product page.
 *
 * If the product is online, gets a ProductView and updates the product data from the httpParameterMap.
 * Renders the product page (product/product template). If the product is not online, sets the response status to 401,
 * and renders an error page (error/notfound template).
 */
function show() {

    var Product = app.getModel('Product');
    var product = Product.get(params.pid.stringValue);
    product = getSelectedProduct(product);

    if (product.isVisible()) {
        require('~/cartridge/scripts/meta').update(product);
       
        //After pay
        var sitePreferences =require ( 'int_afterpay_core/cartridge/scripts/util/AfterpayUtilities.js' ).getSitePreferencesUtilities();
        var afterpayEnable = sitePreferences.isAfterpayEnabled();
        if (afterpayEnable) {
        	require ( 'int_afterpay_core/cartridge/scripts/util/AfterpayCallThreshold.js' ).SetThreshold();
        }

        var productView = app.getView('Product', {
            product: product,
            DefaultVariant: product.getVariationModel().getDefaultVariant(),
            CurrentOptionModel: product.updateOptionSelection(params),
            CurrentVariationModel: product.updateVariationSelection(params)
        });

        productView.render(product.getTemplate() || 'product/product');
    } else {
    	if(product.isVariant()){
    		var masterProduct = product.getMasterProduct();
    		product = masterProduct;
    		if(masterProduct.isOnline()){
    			require('~/cartridge/scripts/meta').update(product);

                var productView = app.getView('Product', {
                    product: product,
                    DefaultVariant: product.getVariationModel().getDefaultVariant()
                });

                productView.render(product.getTemplate() || 'product/product');
    		}
    		else{
        		var productPrimaryCaterogy = product.getPrimaryCategory().getID();
        		 response.redirect(URLUtils.http('Search-Show','cgid',productPrimaryCaterogy));
        	}
    		
    	}else if(!product.isVariant()){
    		var productPrimaryCaterogy = product.object.getPrimaryCategory().getID();
    		 response.redirect(URLUtils.http('Search-Show','cgid',productPrimaryCaterogy));
    	}
    	else{
    		// @FIXME Correct would be to set a 404 status code but that breaks the page as it utilizes
            // remote includes which the WA won't resolve.
            response.setStatus(410);
            app.getView().render('error/notfound');
    	}
    }

}

function getZoomImage(){
    
    var Product = app.getModel('Product');
 var product = Product.get(params.pid.stringValue);

 if (product.isVisible()) {
     var currentVariationModel = product.updateVariationSelection(params);
     var productView = app.getView('Product', {
         product: product,
         DefaultVariant: product.getVariationModel().getDefaultVariant(),
         CurrentOptionModel: product.updateOptionSelection(params),
         CurrentVariationModel: currentVariationModel
     });

     productView.render('product/components/productzoomimages');
 } else {
     // @FIXME Correct would be to set a 404 status code but that breaks the page as it utilizes
     // remote includes which the WA won't resolve
     response.setStatus(410);
     app.getView().render('error/notfound');
 }
}

/**
 * Returns maximum instock date for product bundle 
 */
function getbundleInStockMaxDate() {
    var Product = app.getModel('Product');
    var productObj = Product.get(params.pid.stringValue).object;
	if (productObj.bundle) {
    	var dates=[];
        var bundleProducts = productObj.getBundledProducts();
        var bundleIterator = bundleProducts.iterator();
    	var Calendar = require('dw/util/Calendar');
    	var StringUtils = require('dw/util/StringUtils');
    	var Logger = require('dw/system/Logger');
        try {
            var dates=[];
            while (bundleIterator.hasNext()) {
                var bundleItem = bundleIterator.next();
                if (bundleItem.availabilityModel.availabilityStatus === ProductAvailabilityModel.AVAILABILITY_STATUS_BACKORDER) {
                    var inStockDate = bundleItem.getAvailabilityModel().getInventoryRecord().getInStockDate();
                    dates.push(inStockDate);
                }
            }
            var maxDate = null;
            var bundleMaxDate = null;
            if (dates.length > 0) {
	            maxDate = new Date(Math.max.apply(null,dates));
	            bundleMaxDate = StringUtils.formatCalendar(new Calendar(maxDate), "MM/dd/yyyy");
            }
        } catch(e) {
            Logger.error("error in fetching the latest date for bundles" + e.message);
        }
    }
	
	app.getView({
		bundleMaxDate : bundleMaxDate
	}).render('product/bundleMaxdate');
}

/**
 * Renders the product detail page.
 *
 * If the product is online, gets a ProductView and updates the product data from the httpParameterMap.
 * Renders the product detail page (product/productdetail template). If the product is not online, sets the response status to 401,
 * and renders an error page (error/notfound template).
 */
function detail() {

    var Product = app.getModel('Product');
    var product = Product.get(params.pid.stringValue);

    if (product.isVisible()) {
        var currentVariationModel = product.updateVariationSelection(params);
        
        var productObj = product.object;
        
        var productView = app.getView('Product', {
            product: product,
            DefaultVariant: product.getVariationModel().getDefaultVariant(),
            CurrentOptionModel: product.updateOptionSelection(params),
            CurrentVariationModel: currentVariationModel
        });

        productView.render(product.getTemplate() || 'product/productdetail');
    } else {
        // @FIXME Correct would be to set a 404 status code but that breaks the page as it utilizes
        // remote includes which the WA won't resolve
        response.setStatus(410);
        app.getView().render('error/notfound');
    }

}

/**
 * Returns product availability data as a JSON object.
 *
 * Gets a ProductModel and gets the product ID from the httpParameterMap. If the product is online,
 * renders product availability data as a JSON object.
 * If the product is not online, sets the response status to 401,and renders an error page (error/notfound template).
 */
function getAvailability() {

    var Product = app.getModel('Product');
    var product = Product.get(params.pid.stringValue);

    if (product.isVisible()) {
        let r = require('~/cartridge/scripts/util/Response');

        r.renderJSON(product.getAvailability(params.Quantity.stringValue));
    } else {
        // @FIXME Correct would be to set a 404 status code but that breaks the page as it utilizes
        // remote includes which the WA won't resolve
        response.setStatus(410);
        app.getView().render('error/notfound');
    }

}

/**
 * Renders a product tile. This is used within recommendation and search grid result pages.
 *
 * Gets a ProductModel and gets a product using the product ID in the httpParameterMap.
 * If the product is online, renders a product tile (product/producttile template), used within family and search result pages.
 */
function hitTile() {

    var Product = app.getModel('Product');
    var product = Product.get(params.pid.stringValue);

    if (product.isVisible()) {
        var productView = app.getView('Product', {
            product: product,
            showswatches: true,
            showpricing: true,
            showpromotion: true,
            showrating: true,
            //showcompare: true,
            showplpdescription: true
        });

        productView.product = product.object;
        productView.render(product.getTemplate() || 'product/producttile');
    }

}

/**
 * Renders a navigation include on product detail pages.
 *
 * Gets a ProductModel and gets a product using the product ID in the httpParameterMap.
 * If the product is online, constructs a search and paging model, executes the search,
 * and renders a navigation include on product detail pages (search/productnav template).
 * Also provides next/back links for customers to traverse a product
 * list, such as a search result list.
 */
function productNavigation() {

    var Product = app.getModel('Product');
    var product = Product.get(params.pid.stringValue);

    if (product.isVisible()) {
        var PagingModel;
        var productPagingModel;

        // Construct the search based on the HTTP params and set the categoryID.
        var Search = app.getModel('Search');
        var productSearchModel = Search.initializeProductSearchModel(params);

        // Reset pid in search.
        productSearchModel.setProductID(null);

        // Special handling if no category ID is given in URL.

        /*JIRA PREV-41 : Next and Previous links are not displayed in PDP for the Product Bundle and Product Set. Commented below block.*/

        /*if (!params.cgid.value) {
            var category = null;

            if (product.getPrimaryCategory()) {
                category = product.getPrimaryCategory();
            } else if (product.getVariationModel().getMaster()) {
                category = product.getVariationModel().getMaster().getPrimaryCategory();
            }

            if (category && category.isOnline()) {
                productSearchModel.setCategoryID(category.getID());
            }
        }*/

        // Execute the product searchs
        productSearchModel.search();

        // construct the paging model
        PagingModel = require('dw/web/PagingModel');
        productPagingModel = new PagingModel(productSearchModel.productSearchHits, productSearchModel.count);
        productPagingModel.setPageSize(3);
        productPagingModel.setStart(params.start.intValue - 2);

        app.getView({
            ProductPagingModel: productPagingModel,
            ProductSearchResult: productSearchModel
        }).render('search/productnav');

    } else {
        // @FIXME Correct would be to set a 404 status code but that breaks the page as it utilizes
        // remote includes which the WA won't resolve
        response.setStatus(410);
        app.getView().render('error/notfound');
    }

}

/**
 * Renders variation selection controls for a given product ID, taken from the httpParameterMap.
 *
 * If the product is online, updates variation information and gets the selected variant. If it is an ajax request, renders the
 * product content page (product/productcontent template), otherwise renders the product page (product/product template).
 * If it is a bonus product, gets information about the bonus discount line item and renders the bonus product include page
 * (pageproduct/components/bonusproduct template). If the product is offline, sets the request status to 401 and renders an
 * error page (error/notfound template).
 */
function variation() {

    var currentVariationModel;
    var Product = app.getModel('Product');
    var product = Product.get(params.pid.stringValue);
    var resetAttributes = false;

    product = getSelectedProduct(product);
    currentVariationModel = product.updateVariationSelection(params);

    if (product.isVisible()) {
        if (params.source.stringValue === 'bonus') {
            var Cart = app.getModel('Cart');
            var bonusDiscountLineItems = Cart.get().getBonusDiscountLineItems();
            var bonusDiscountLineItem = null;

            for (var i = 0; i < bonusDiscountLineItems.length; i++) {
                if (bonusDiscountLineItems[i].UUID === params.bonusDiscountLineItemUUID.stringValue) {
                    bonusDiscountLineItem = bonusDiscountLineItems[i];
                    break;
                }
            }

            app.getView('Product', {
                product: product,
                CurrentVariationModel: currentVariationModel,
                BonusDiscountLineItem: bonusDiscountLineItem
            }).render('product/components/bonusproduct');
        } else if (params.format.stringValue) {
            app.getView('Product', {
                product: product,
                GetImages: true,
                resetAttributes: resetAttributes,
                CurrentVariationModel: currentVariationModel
            }).render('product/productcontent');
        } else {
            app.getView('Product', {
                product: product,
                CurrentVariationModel: currentVariationModel
            }).render('product/product');
        }
    } else {
        // @FIXME Correct would be to set a 404 status code but that breaks the page as it utilizes
        // remote includes which the WA won't resolve
        response.setStatus(410);
        app.getView().render('error/notfound');
    }

}

/**
 * Renders variation selection controls for the product set item identified by a given product ID, taken from the httpParameterMap.
 *
 * If the product is online, updates variation information and gets the selected variant. If it is an ajax request, renders the
 * product set page (product/components/productsetproduct template), otherwise renders the product page (product/product template).
 *  If the product is offline, sets the request status to 401 and renders an error page (error/notfound template).
 *
 */
function variationPS() {

    var Product = app.getModel('Product');
    var product = Product.get(params.pid.stringValue);

    if (product.isVisible()) {

        var productView = app.getView('Product', {
            product: product
        });

        var productVariationSelections = productView.getProductVariationSelections(params);
        product = Product.get(productVariationSelections.SelectedProduct);

        if (product.isMaster()) {
            product = Product.get(product.getVariationModel().getDefaultVariant());
        }

        if (params.format.stringValue) {
            app.getView('Product', {product: product}).render('product/components/productsetproduct');
        } else {
            app.getView('Product', {product: product}).render('product/product');
        }
    } else {
        // @FIXME Correct would be to set a 404 status code but that breaks the page as it utilizes
        // remote includes which the WA won't resolve
        response.setStatus(410);
        app.getView().render('error/notfound');
    }

}

/**
 * Renders the last visited products based on the session information (product/lastvisited template).
 */
function includeLastVisited() {
    app.getView({
        LastVisitedProducts: app.getModel('RecentlyViewedItems').getRecentlyViewedProducts(3)
    }).render('product/lastvisited');
}

/**
 * Renders a list of bonus products for a bonus discount line item (product/bonusproductgrid template).
 */
function getBonusProducts() {
    var Cart = app.getModel('Cart');
    var getBonusDiscountLineItemDS = require('app_elizabetharden_core/cartridge/scripts/cart/GetBonusDiscountLineItem');
    var currentHttpParameterMap = request.httpParameterMap;
    var bonusDiscountLineItems = Cart.get().getBonusDiscountLineItems();
    var bonusDiscountLineItem;

    bonusDiscountLineItem = getBonusDiscountLineItemDS.getBonusDiscountLineItem(bonusDiscountLineItems, currentHttpParameterMap.bonusDiscountLineItemUUID);
    var bpCount = bonusDiscountLineItem.bonusProducts.length;
    var bpTotal;
    var bonusDiscountProducts;
    if (currentHttpParameterMap.pageSize && !bpCount) {

        var BPLIObj = getBonusDiscountLineItemDS.getBonusPLIs(currentHttpParameterMap.pageSize, currentHttpParameterMap.pageStart, bonusDiscountLineItem);

        bpTotal = BPLIObj.bpTotal;
        bonusDiscountProducts = BPLIObj.bonusDiscountProducts;
    } else {
        bpTotal = -1;
    }

    app.getView({
        BonusDiscountLineItem: bonusDiscountLineItem,
        BPTotal: bpTotal,
        BonusDiscountProducts: bonusDiscountProducts
    }).render('product/bonusproductgrid');

}

/**
 * Renders a set item view for a given product ID, taken from the httpParameterMap pid parameter.
 * If the product is online, get a ProductView and renders the product set page (product/components/productsetproduct template).
*  If the product is offline, sets the request status to 401 and renders an error page (error/notfound template).
*/
function getSetItem() {
    var currentVariationModel;
    var Product = app.getModel('Product');
    var product = Product.get(params.pid.stringValue);
    product = getSelectedProduct(product);
    currentVariationModel = product.updateVariationSelection(params);

    if (product.isVisible()) {
        app.getView('Product', {
            product: product,
            CurrentVariationModel: currentVariationModel,
            isSet: true
        }).render('product/components/productsetproduct');
    } else {
        // @FIXME Correct would be to set a 404 status code but that breaks the page as it utilizes
        // remote includes which the WA won't resolve
        response.setStatus(410);
        app.getView().render('error/notfound');
    }

}

/**
 * Checks whether a given product has all required attributes selected, and returns the selected variant if true
 *
 * @param {dw.catalog.Product} product
 * @returns {dw.catalog.Product} - Either input product or selected product variant if all attributes selected
 */
function getSelectedProduct (product) {
    var currentVariationModel = product.updateVariationSelection(params);

    if (currentVariationModel) {
        var selectedVariant = currentVariationModel.getSelectedVariant();
        if (selectedVariant) {
            product = app.getModel('Product').get(selectedVariant);
        }
    }

    return product;
}

/**
 * Renders the product detail page within the context of a category.
 * Calls the {@link module:controllers/Product~show|show} function.
 * __Important:__ this function is not obsolete and must remain as it is used by hardcoded platform rewrite rules.
 */
function showInCategory() {
    show();
}

/**
 * Renders the findation data
 */
function findation(){
	var countryCode = !empty(request.getHttpCookies()['bfx.country']) && request.getHttpCookies()['bfx.country'].value != null ? request.getHttpCookies()['bfx.country'].value : "";
	app.getView({
		CountryCode : countryCode
	}).render('product/findation');
}

/*
 * Web exposed methods
 */
/**
 * Renders the product template.
 * @see module:controllers/Product~show
 */
exports.Show = guard.ensure(['https'], show);

/**
 * Renders the product detail page within the context of a category.
 * @see module:controllers/Product~showInCategory
 */
exports.ShowInCategory = guard.ensure(['get'], showInCategory);

/**
 * Renders the productdetail template.
 * @see module:controllers/Product~detail
 */
exports.Detail = guard.ensure(['get'], detail);

/**
 * Returns product availability data as a JSON object.
 * @see module:controllers/Product~getAvailability
 */
exports.GetAvailability = guard.ensure(['get'], getAvailability);

/**
 * Renders a product tile, used within family and search result pages.
 * @see module:controllers/Product~hitTile
 */
exports.HitTile = guard.ensure(['get'], hitTile);

/**
 * Renders a navigation include on product detail pages.
 * @see module:controllers/Product~productNavigation
 */
exports.Productnav = guard.ensure(['get'], productNavigation);

/**
 * Renders variation selection controls for a given product ID.
 * @see module:controllers/Product~variation
 */
exports.Variation = guard.ensure(['get'], variation);

/**
 * Renders variation selection controls for the product set item identified by the given product ID.
 * @see module:controllers/Product~variationPS
 */
exports.VariationPS = guard.ensure(['get'], variationPS);

/**
 * Renders the last visited products based on the session information.
 * @see module:controllers/Product~includeLastVisited
 */
exports.IncludeLastVisited = guard.ensure(['get'], includeLastVisited);

/**
 * Renders a list of bonus products for a bonus discount line item.
 * @see module:controllers/Product~getBonusProducts
 */
exports.GetBonusProducts = guard.ensure(['get'], getBonusProducts);

/**
 * Renders a set item view for the given product ID.
 * @see module:controllers/Product~getSetItem
 */
exports.GetSetItem = guard.ensure(['get'], getSetItem);
exports.GetZoomImage = guard.ensure(['get'], getZoomImage);
/**
 * Renders the findation data
 */
exports.Findation = guard.ensure(['get'], findation);

/** 
 * Renders bundle max date
 * */
exports.GetbundleInStockMaxDate = guard.ensure(['include'],getbundleInStockMaxDate);
