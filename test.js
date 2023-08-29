var base64 = require('base-64');
var utf8 = require('utf8');
var crypto = require("crypto");

var customer = {
    contact : "012-3456789",
    memberReferenceNo : "10077",
    name : "CK",
  }

  var order = {
      amount : 100,
      callbackUrl : "www.google.com",
      currency : "MYR",
      customer : customer,
      description : "Buy Coin",
      orderReferenceNo : "YAMEI123456789",
      remarks : "",
      title : "Top Up",
  }

  var payload = {
      channel : "GOBIZ",
      mode : 21,
      order : order,
      storeId : process.env.STORE_ID,
      type: "ECOMMERCE"
  }

  var bytes = utf8.encode(JSON.stringify(payload));
  var encoded = base64.encode(bytes);

  var unix = Math.round(+new Date()/1000);
  var nonce = "Dpjczql20RuZRsUblzMB3hOjdPfiZZfS";

  var param = "data="+encoded+"&timestamp="+unix+"&nonce="+nonce;
  var hmac = crypto.createHmac("sha512", "a1b6d087-f977-5c5c-a8d1-793a3e6784b2");
  var signed = hmac.update(new Buffer(param, 'utf-8')).digest("base64");

  console.log("-----------------------------------------------------------------")
  console.log(signed);
  console.log("-----------------------------------------------------------------")
