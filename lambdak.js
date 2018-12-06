const request = require('request');
const traceHeaders = ['x-request-id', 'x-b3-traceid', 'x-b3-spanid', 'x-b3-parentspanid', 'x-b3-sampled', 'x-b3-Flags', 'x-ot-span-context']

module.exports = {
    main: function(event, context) {


        //event = create order
        if (event.data.orderCode) {

            var orderId = event.data.orderCode;
            var url = `${process.env.GATEWAY_URL}/electronics/orders/${orderId}`;
            var userEnvironment = `${process.env.USER_ENVIRONMENT}`;
            if (userEnvironment === undefined) {
                console.log('Environment variable USER_ENVIRONMENT is not defined')
            }

            var traceCtxHeaders = extractTraceHeaders(event.extensions.request.headers)
            request.get({
                headers: traceCtxHeaders,
                url: url,
                json: true
            }, function(error, response, body) {
                //products for current order
                var productArray = [];
                if (error === null) {
                    if (response.statusCode == '200') {

                        body.entries.forEach(function(entry) {
                            var product = entry.product.name
                            productArray.push(product)
                            console.log('product:' + product + '  has been added to the order' + orderId);
                        });


                        //get all the orders
                        var allOrders = []
                        var correlated = [];
                        var orderServiceUrl = "http://orders-cloudlab4." + userEnvironment + ":8017/orders"
                        request.get({
                            headers: traceCtxHeaders,
                            url: orderServiceUrl,
                            json: true
                        }, function(error, response, body) {
                            if (error === null) {
                                body.forEach(function(order) {
                                    if (parseProducts(order.town).length !== 0) {
                                        allOrders.push(order);
                                    }
                                });

                                allOrders.forEach(function(order) {
                                    console.log("order with product" + simpleStringify(order));

                                })

                                //now we can call to get coorelated products
                                console.log("---------correlated: ", getCorrelatedProducts(productArray, allOrders).toString());
                            } else {
                                console.log("this error" + error)
                            }
                        })


                        //keep the list of products in town filed after the name seperated by a comma
                        var order = {
                            orderId: orderId,
                            total: body.totalPriceWithTax.value,
                            postalCode: "" + body.deliveryAddress.postalCode + "",
                            town: body.deliveryAddress.town + ',' + productArray.toString(),
                        }

                        // Call our orders-cloudlab4 service to persist the data
                        console.log('Order service Url is ' + orderServiceUrl)
                        request.post({
                            headers: traceCtxHeaders,
                            url: orderServiceUrl,
                            json: order
                        }, function(error, response, body) {
                            console.log("In Lambda with response.statusCode: " + response.statusCode)
                        })
                    } else {
                        console.log('Call to EC webservice failed with status code ' + response.statusCode)
                    }
                } else {
                    console.log(error)
                }
            })

        }


        //if event === add to cart
        if (event.data.productId) {

            console.log("envent ---> " + simpleStringify(event.data));
            var productCode = event.data.productId;
            var urlp = `${process.env.GATEWAY_URL}/electronics/products/${productCode}`;
            var tracepCtxHeaders = extractTraceHeaders(event.extensions.request.headers);
            request.get({
                headers: tracepCtxHeaders,
                url: urlp,
                json: true
            }, function(error, response, body) {

                if (response.statusCode == '200') {
                    // console.log('body--------------' +  simpleStringify(body));
                    console.log('response body--------------' + body.name);
                }


            });

        }

    }
}

function simpleStringify(object) {
    var simpleObject = {};
    for (var prop in object) {
        if (!object.hasOwnProperty(prop)) {
            continue;
        }
        if (typeof(object[prop]) == 'object') {
            continue;
        }
        if (typeof(object[prop]) == 'function') {
            continue;
        }
        simpleObject[prop] = object[prop];
    }
    return JSON.stringify(simpleObject); // returns cleaned up JSON
}


function parseProducts(str) {
    var products = [];
    var res = str.split(",");
    for (const [i, value] of res.entries()) {
        if (i > 0) {
            products.push(value);
        }
    }

    return products;
}


function getCorrelatedProducts(orderProducts, listOFOrders) {
    var occured = [];
    listOFOrders.forEach(function(order) {
        var productsInOrderArr = parseProducts(order.town);
        var found = false;
        for (var i = 0; i < productsInOrderArr.length; i++) {
            if (orderProducts.indexOf(productsInOrderArr[i]) > -1) {
                found = true;
                break;
            }
        }
        var newProducts = [];
        if (found) {
            productsInOrderArr.forEach(function(pr) {
                if (orderProducts.indexOf(pr) < 0) {
                    occured.push(pr);
                }
            });
        }

    })

    return occured.filter(onlyUnique).slice(0, 3);

}


//filter syntax
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}


function extractTraceHeaders(headers) {
    // Used to pass the headers through to the next calls, so that tracing will work
    console.log(headers);
    var map = {};
    for (var i in traceHeaders) {
        h = traceHeaders[i]
        headerVal = headers[h]
        console.log('header' + h + "-" + headerVal)
        if (headerVal !== undefined) {
            console.log('if not undefined header' + h + "-" + headerVal)
            map[h] = headerVal
        }
    }
    return map;
}
