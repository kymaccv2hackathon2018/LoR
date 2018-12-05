const request = require('request');
const traceHeaders = ['x-request-id', 'x-b3-traceid', 'x-b3-spanid', 'x-b3-parentspanid', 'x-b3-sampled', 'x-b3-Flags', 'x-ot-span-context']
const nodemailer = require('nodemailer');

module.exports = {
    main: function(event, context) {

        var tName = 'Chris';
        var tOrderNumber = '123';
        var tEmail = 'testnodemailer589@gmail.com';
        var tProducts = [
            'DSC-HX1',
            'DSC-T90',
            'FinePix S1500'
        ];


        // var emailContent = constructEmail(tName, tOrderNumber, tProducts);
        // sendEmail(tEmail, emailContent);

        console.log("In Lambda with event.data.orderCode: " + event.data.orderCode);
        var orderId = event.data.orderCode;
        var url = `${process.env.GATEWAY_URL}/electronics/orders/${orderId}`;
        var userEnvironment = `${process.env.USER_ENVIRONMENT}`;
        if (userEnvironment === undefined) {
            console.log('Environment variable USER_ENVIRONMENT is not defined')
        }
        console.log("In Lambda with userEnvironment: " + userEnvironment)
        console.log("In Lambda with url: " + url)


        // Pass the headers through to the next calls, so that tracing will work
        var traceCtxHeaders = extractTraceHeaders(event.extensions.request.headers)
        request.get({
            headers: traceCtxHeaders,
            url: url,
            json: true
        }, function(error, response, body) {
            var productArray = [];
            
          
          console.log('body.deliveryMode.description' , body.deliveryMode.description)
          console.log('body.deliveryMode.name' , body.deliveryMode.name)
          console.log('body.deliveryStatus' , body.deliveryStatus)
          console.log('body.deliveryStatusDisplay' , body.deliveryStatusDisplay)
          
            
            if (error === null) {
                console.log("In Lambda with response.statusCode: " + response.statusCode)
                if (response.statusCode == '200') {
                    // Construct the order data that we want to persist
                    
                    
                    body.entries.forEach(function(entry) {
                        var product = entry.product.name
                        productArray.push(product)
                        console.log('product:' + product + '  has been added to the order' + orderId);
                    });

                    //start of new code

                    var allOrders = []
                    var correlated = [];
                    var orderServiceUrl = "http://orders-cloudlab4." + userEnvironment + ":8017/orders"
                    request.get({
                        headers: traceCtxHeaders,
                        url: orderServiceUrl,
                        json: true
                    }, function(error, response, allorders) {
                        if (error === null) {
                            allorders.forEach(function(order) {
                                if (parseProducts(order.town).length !== 0) {
                                    allOrders.push(order);
                                }
                            });

                            allOrders.forEach(function(order) {
                                console.log("order with product" + simpleStringify(order));

                            })

                            //now we can call to get coorelated products
                            var correlatedItems = getCorrelatedProducts(productArray, allOrders);
                            console.log("---------correlated: ", correlatedItems.toString());
                            
                            var deliveryStatus = body.deliveryMode;

                            console.log(deliveryStatus.name);
                            constructEmail(
                                body.user.uid,
                                body.deliveryAddress.firstName,
                                orderId,
                                productArray,
                                correlatedItems,
                                deliveryStatus
                            );



                        } else {
                            console.log("this error" + error)
                        }
                    })

                    //end of new code


                    // Call our orders-cloudlab4 service to persist the data

                } else {
                    console.log('Call to EC webservice failed with status code ' + response.statusCode)
                    console.log(response.body)
                }
            } else {
                console.log(error)
            }
        })
    }
}

function extractTraceHeaders(headers) {
    // Used to pass the headers through to the next calls, so that tracing will work
    console.log(headers)
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

function constructEmail(email, name, orderNumbner, products, correlatedItems, deliveryStatus) {

    getVideoForProducts(products).then(function(ytLinks) {
        console.log("Inside constructEmail,  are all the links", ytLinks);
        var productLinks = '<ul>';
        ytLinks.forEach(function(ytLink) {
            productLinks += `<li>${ytLink}</li>`;
            console.log("inside ytLinks ForEach" + productLinks);
        });
        productLinks += '</ul>';
        console.log("final links before adding to the emailContent" + productLinks);
        
        var productList = '<ul>';
        products.forEach(function(product) {
            productList += `<li>${product}</li>`;
        });
        productList += '</ul>';
        
        var correlatedItemsList = '<ul>';
        correlatedItems.forEach(function(item) {
            correlatedItemsList += `<li>${item}</li>`;
        });
        correlatedItemsList += '</ul>';
        console.log(`final correlated items: ${correlatedItemsList}`);

        var emailContent = `<p>Hello ${name}</p>
        <br><br>
        <p>Your order ${orderNumbner} has been created and will soon be shipped. Expected Delivery will be in ${deliveryStatus.description} - (${deliveryStatus.name})</p>
        <P> Order Detail</p>
        ${productList}
        <br><br>
        <p>While you wait, here are some videos that you might find useful:</p>
        ${productLinks}
        <br><br>
        <p>Other customers also bought: 
        ${correlatedItemsList}`;
        
        console.log(emailContent);

        sendEmail(email, emailContent);
    });



    // products.forEach(function(product) {
    //     productLinks += '<li>' + getVideoForProduct(product) + '</li>';
    // });



}

function sendEmail(email, emailContent) {

    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'testnodemailer589@gmail.com',
            pass: 'testnodemailer999'
        }
    });

    var mailOptions = {
        from: 'testnodemailer589@gmail.com', // sender address
        to: email, // list of receivers
        subject: 'Your B2C Accelerator order has been created', // Subject line
        html: emailContent // plain text body
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err)
            console.log(err)
        else
            console.log(info);
    });
}

function getVideoForProduct(productName) {
    return new Promise(resolve => {
        var ytRequest = 'https://www.googleapis.com/youtube/v3/search?part=snippet&q=' +
            productName.replace(/ /g, "+") +
            '&type=video&key=AIzaSyD_3UfxiLjYm18uZAQITTzlU39_xWuYFa8&maxResults=1';

        console.log('before yt request');
        request.get({
            url: ytRequest,
            json: true
        }, function(error, response, body) {
            if (error === null) {
                console.log("inside yt request");
                console.log("In Lambda with response.statusCode: " + response.statusCode)
                if (response.statusCode == '200') {
                    var link = `<table><tr><td>${productName}</td></tr>
                        <tr><td>
                        <a href="https://www.youtube.com/watch?v=${body.items[0].id.videoId}"><img src="${body.items[0].snippet.thumbnails.default.url}"/></a>
                        </td></tr></table>`;
                    console.log(link);
                    resolve(link);
                } else {
                    console.log(response.body)
                    resolve(false);
                }
            } else {
                console.log(error)
                resolve(false);
            }
        });
        console.log('after yt request');
    });
}

function getVideoForProducts(products) {
    const promises = [];
    products.forEach(function(product) {
        console.log("inside getVideoForProducts: ---" + product)
        promises.push(getVideoForProduct(product));
    });
    // for(let product in products) {

    // }
    return Promise.all(promises);
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
