'use strict';

/**
 * Controller that manages the order history of a registered user.
 *
 * @module controllers/Order
 */

/* API Includes */
var ContentMgr = require('dw/content/ContentMgr');
var OrderMgr = require('dw/order/OrderMgr');
var Shipment = require('dw/order/Order');
var PagingModel = require('dw/web/PagingModel');
var Transaction = require('dw/system/Transaction');

/* Script Modules */
var app = require('~/cartridge/scripts/app');
var guard = require('~/cartridge/scripts/guard');


/**
 * Renders a page with the order history of the current logged in customer.
 *
 * Creates a PagingModel for the orders with information from the httpParameterMap.
 * Invalidates and clears the orders.orderlist form. Updates the page metadata. Sets the
 * ContinueURL property to Order-Orders and renders the order history page (account/orderhistory/orders template).
 */
function history() {
    var orders = OrderMgr.searchOrders('customerNo={0} AND status!={1}', 'creationDate desc',
                                        customer.profile.customerNo, dw.order.Order.ORDER_STATUS_REPLACED);

    /*****************************PREVAIL - Order History Integration*****************************************/
    var count = orders.count;
    var OMSOrders = getOrderHistory(orders);
    count = OMSOrders.size();
    orders = OMSOrders.iterator();

    var parameterMap = request.httpParameterMap;
    var pageSize = parameterMap.sz.intValue || 5;
    var start = parameterMap.start.intValue || 0;
    var orderPagingModel = new PagingModel(orders, count);
    orderPagingModel.setPageSize(pageSize);
    orderPagingModel.setStart(start);

    var orderListForm = app.getForm('orders.orderlist');
    orderListForm.invalidate();
    orderListForm.clear();
    orderListForm.copyFrom(orderPagingModel.pageElements);

    var pageMeta = require('~/cartridge/scripts/meta');
    pageMeta.update(ContentMgr.getContent('myaccount-orderhistory'));

    app.getView({
        OrderPagingModel: orderPagingModel,
        ContinueURL: dw.web.URLUtils.https('Order-Orders')
    }).render('account/orderhistory/orders');
}


/**
 * Gets an OrderView and renders the order detail page (account/orderhistory/orderdetails template). If there is an error,
 * redirects to the {@link module:controllers/Order~history|history} function.
 */
function orders() {
    var orderListForm = app.getForm('orders.orderlist');
    var dwOrder;
    var Order;
    var dwOrderStatus;
    orderListForm.handleAction({
        show: function (formGroup, action) {
        	 Order = action.object;
        	 if(!(Order instanceof dw.order.Order))
        	 dwOrderStatus = Order.OrderStatus;

            /*****************************PREVAIL - Order Detail Integration*****************************************/
            if('OrderStatus' in Order){
            	var status = Order.OrderStatus;
            }
            Order = getOrderDetail(Order);
            if(typeof status !== "undefined" && !empty(status)){
            	Order.OrderStatus = status;
            }
            app.getView({Order: Order}).render('account/orderhistory/orderdetails');
            
            /* EA-496 Mapping shipment tracking number and shipping status DW order object */
            if (!(Order instanceof dw.order.Order) && !(dwOrderStatus == 'CANCELLED' || dwOrderStatus == 'FAILED' || dwOrderStatus == 'ON HOLD')){ 
              	 dwOrder =  OrderMgr.getOrder(Order.orderNo);
              	 
              	Transaction.wrap(function () {
                	var ShipmentTrackingNumber = '';
                	var trackingNumbers = [];
                	var trackNo;
                	var isExist;
                	var shipmentStatusNumbers = [];
                	for each(var obj in Order.completeOrderSummaryDetail){
                		if(empty(trackingNumbers)){
                			if(obj.CarrierTrackingNumber != null){
                				trackNo = obj.CarrierTrackingNumber;
                    			trackingNumbers.push(trackNo);
                			}
                		}
                		else if(!empty(trackingNumbers)){
                			if(obj.CarrierTrackingNumber != null){
                				trackNo = obj.CarrierTrackingNumber;
                				for(var i in trackingNumbers){
                    				if(trackingNumbers[i].equalsIgnoreCase(trackNo)){
                    					isExist = true;
                    					break;
                    				}else if(!trackingNumbers[i].equalsIgnoreCase(trackNo)){
                    					isExist = false;
                    				}
                    			}
                    			if(!isExist){
                    				trackingNumbers.push(trackNo);
                    			}
                			}
                		}
                		if(obj.LineStatus != null){
                			shipmentStatusNumbers.push(obj.LineStatus);
                		}
                	}
                	for(var track1 = 0; track1 < trackingNumbers.length; track1++){
                		if(track1 == 0){
                			ShipmentTrackingNumber = trackingNumbers[track1];
                		}
                		else if(track1 > 0){
                			ShipmentTrackingNumber += ',';
                			ShipmentTrackingNumber += trackingNumbers[track1];
                		}
                	}
                	for(var shipStatus = 0; shipStatus < shipmentStatusNumbers.length; shipStatus++){
                		if(shipmentStatusNumbers[shipStatus].equalsIgnoreCase('Shipped')){
                			dwOrder.shippingStatus = 2;
                    		dwOrder.shipments[0].shippingStatus = 2;
                		}
                		else if(shipmentStatusNumbers[shipStatus].equalsIgnoreCase('Not Shipped')){
                			dwOrder.shippingStatus = 0;
                    		dwOrder.shipments[0].shippingStatus = 0;
                		}
                	}
                		dwOrder.shipments[0].trackingNumber = ShipmentTrackingNumber;
                });
              }
        },
        error: function () {
            response.redirect(dw.web.URLUtils.https('Order-History'));
        }
    });
    
}


/**
 * Renders a page with details of a single order. This function
 * renders the order details by the UUID of the order, therefore it can also be used
 * for unregistered customers to track the status of their orders. It
 * renders the order details page (account/orderhistory/orderdetails template), even
 * if the order cannot be found.
 */
function track () {
    var parameterMap = request.httpParameterMap;

    if (empty(parameterMap.orderID.stringValue)) {
        app.getView().render('account/orderhistory/orderdetails');
        return response;
    }

    var uuid = parameterMap.orderID.stringValue;

    /*****************************PREVAIL - Guest Order Detail Integration*****************************************/
   
        var pdict = getGuestOrderDetail();
        if (pdict.EndNodeName === 'OK') {
            app.getView({
                Order: pdict.Order
            }).render('account/orderhistory/orderdetails');
            return response;
        }
    

    var orders = OrderMgr.searchOrders('UUID={0} AND status!={1}', 'creationDate desc', uuid, dw.order.Order.ORDER_STATUS_REPLACED);

    if (empty(orders)) {
        app.getView().render('account/orderhistory/orderdetails');
    }

    var Order = orders.next();
    app.getView({Order: Order}).render('account/orderhistory/orderdetails');
}


/**
 * PREVAIL - Order history integration
 */
function getOrderHistory(orders) {
    var pdict = dw.system.Pipeline.execute('OrderHistory-Show', {
        OrdersUnpaged: orders
    });
    return pdict.OrdersUnpaged;
}

/**
 * PREVAIL - Order detail integration
 */
function getOrderDetail(order) {
    if (!(order instanceof dw.order.Order)) {
        var pdict = dw.system.Pipeline.execute('OrderHistory-Detail', {
            Order: order
        });
        return pdict.Order;
    } else {
        return order;
    }
}


/**
 * PREVAIL - Guest Order detail integration
 */
function getGuestOrderDetail() {
    var pdict = dw.system.Pipeline.execute('OrderHistory-OrderDetailsGuest');
    return pdict;
}

/*
 * Module exports
 */

/*
 * Web exposed methods
 */
/** Renders a page with the order history of the current logged in customer.
 * @see module:controllers/Order~history */
exports.History = guard.ensure(['get', 'https', 'loggedIn'], history);
/** Renders the order detail page.
 * @see module:controllers/Order~orders */
exports.Orders = guard.ensure(['post', 'https', 'loggedIn'], orders);
/** Renders a page with details of a single order.
 * @see module:controllers/Order~track */
exports.Track = guard.ensure(['get', 'https'], track);
