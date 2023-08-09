const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require('cors')
const app = express();
const PORT = process.env.PORT || 8082;
require('dotenv').config();
const TronWeb = require('tronweb');
var base64 = require('base-64');
var utf8 = require('utf8');

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});

const config = {
  connectionString:
    "postgres://paysystemdb_user:NImIQdhh8I8sWXJb79Z24uQTI5oJQqUD@dpg-cir0bbdiuie930j5d8lg-a.singapore-postgres.render.com/paysystemdb?ssl=true",
};

const { Client } = require('pg');
const client = new Client(config);
client.connect();

var mysql = require('mysql');

var con = mysql.createConnection({
  host: "119.45.167.2",
  user: "admin",
  password: "yamei666888@"
});

app.use(cors({ origin: true, credentials: true }))
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false, parameterLimit:50000 }));

function GenerateJWT(_userId, _username)
{
  return jwt.sign(
      { userId: _userId, username: _username},
      process.env.TOKEN_KEY,
      { expiresIn: "24h" }
    );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.TOKEN_KEY, (err, user) =>
    {
      if (err)
      {
        return res.sendStatus(403);
      }

      req.user = user;
      next();
    });
  }
  else
  {
    res.sendStatus(401);
  }
}

app.get('/', async (req, res) => {
  res.status(200).send("OK");
})

app.get('/port/get', async (req, res) => {
  res.status(200).send(PORT);
})

app.get('/user/get/:id', verifyToken, async (req, res) => {
  client.query("SELECT * FROM users WHERE id = '"+req.params.id)
        .then((result) => {
          res.send(JSON.stringify(result.rows[0].username));
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

app.post('/user/login', async (req, res) => {

  if( typeof(req.body.username) == 'undefined' || typeof(req.body.password) == 'undefined')
  {
    return res.status(500).send("错误: 请键入您的用户名和密码以登录。");
  }

  client.query("SELECT * FROM users WHERE username = '"+req.body.username+"' AND password = crypt('"+req.body.password+"', password)")
        .then((result) => {
          if(result.rows.length > 0)
          {
            const token = GenerateJWT(result.rows[0].id, result.rows[0].username);

            client.query("UPDATE users SET last_login = NOW() WHERE id = "+result.rows[0].id)
            client.query("INSERT INTO action_log (user_id, action, datetime) VALUES ("+result.rows[0].id+", 'login', NOW())")

            res.status(200).json({
                success: true,
                data: {
                  userId: result.rows[0].id,
                  token: token,
                },
              });
          }
          else
          {
            res.status(500).send("错误：用户名或密码错误。");
          }
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

app.get('/request/latest', verifyToken, async (req, res) => {
  
  client.query("SELECT * FROM requests ORDER BY datetime DESC LIMIT 5")
          .then((result) => {

            res.send(JSON.stringify(result.rows));

          })
          .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
          })
})

app.get('/request/get/', verifyToken, async (req, res) => {
  
  const page = req.query.page || 1;
  const type = req.query.type;
  const orderId = req.query.orderId;
  const sender = req.query.sender;
  const receiver = req.query.receiver;
  const uid = req.query.uid;
  const startTime = req.query.startTime;
  const endTime = req.query.endTime;
  const amount = req.query.amount;
  
  var sql = "SELECT * FROM requests WHERE request_type = "+type;
  if(orderId)
    sql += " AND id = "+orderId;
  if(sender)
    sql += " AND sender_address LIKE '%"+sender+"%'";
  if(receiver)
    sql += " AND receiver_address LIKE '%"+receiver+"%'";
  if(amount)
    sql += " AND uid = "+uid;
  if(amount)
    sql += " AND amount = "+amount;
  if(startTime && endTime)
    sql += " AND datetime BETWEEN '"+startTime+" 00:00:00' AND '"+endTime+" 23:59:59'";
  
  sql += " ORDER BY id ASC";

  client.query(sql)
        .then((result) => {

          const perPage = 30; // Number of items per page
          const startIndex = (page - 1) * perPage;
          const endIndex = page * perPage;

          const data = result.rows.slice(startIndex, endIndex);
          var total = 0;
          
          for(var i = 0; i < result.rows.length; i++)
          {
            total += result.rows[i]['amount'];
          }

          res.header('Access-Control-Allow-Origin', "*");
          res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
          res.header("Access-Control-Allow-credentials", true);
          res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, UPDATE");
          
          res.json({
            currentPage: page,
            perPage: perPage,
            totalItems: result.rows.length,
            totalPages: Math.ceil(result.rows.length / perPage),
            data: data,
            total : total
          });
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
})

app.get('/changelog/get/', verifyToken, async (req, res) => {
  
  const page = req.query.page || 1;
  const orderId = req.query.orderId;
  const address = req.query.address;
  const uid = req.query.uid;
  const startTime = req.query.startTime;
  const endTime = req.query.endTime;
  const amount = req.query.amount;
  
  var sql = "SELECT * FROM requests"
  
  if(orderId || address || uid || amount || startTime || endTime || amount)
    sql += " WHERE";

  if(orderId)
    sql += " id = "+orderId;
  if(address)
    sql += " AND (sender_address LIKE '%"+address+"%' OR receiver_address LIKE '%"+address+"%')";
  if(uid)
    sql += " AND uid = "+uid;
  if(amount)
    sql += " AND amount = "+amount;
  if(startTime && endTime)
    sql += " AND datetime BETWEEN '"+startTime+" 00:00:00' AND '"+endTime+" 23:59:59'";
 
  sql += " ORDER BY id ASC";

  client.query(sql)
        .then((result) => {
           
          const perPage = 30; // Number of items per page
          const startIndex = (page - 1) * perPage;
          const endIndex = page * perPage;
          
          var before = 0;

          var processedData = [];

          for(var i = 0; i < result.rows.length; i++)
          {
            var temp = {};
            temp['id'] = result.rows[i].id;
            temp['uid'] = result.rows[i].uid;
            temp['request_type'] = result.rows[i].request_type;

            temp['before'] = before;
            temp['amount'] = result.rows[i].amount;
            
            if(result.rows[i].request_type == 0)
            {
              temp['address'] = result.rows[i].sender_address;
              temp['after'] = (before + result.rows[i].amount);
            }
            else
            {
              temp['address'] = result.rows[i].receiver_address;
              temp['after'] = (before - result.rows[i].amount);
            }

            before = temp['after'];
            temp['time'] = result.rows[i].datetime;

            processedData.push(temp);
          }

          const data = processedData.slice(startIndex, endIndex);

          res.json({
            currentPage: page,
            perPage: perPage,
            totalItems: result.rows.length,
            totalPages: Math.ceil(result.rows.length / perPage),
            data: data,
          });

        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

app.get('/actionlog/get/', verifyToken, async (req, res) => {
  
  var sql = "SELECT * FROM action_log"

  const page = req.query.page || 1;
  const action_id = req.query.action_id;
  const user_id = req.query.user_id;
  const startTime = req.query.startTime;
  const endTime = req.query.endTime;
  
  if(action_id || user_id || startTime || endTime)
    sql += " WHERE";
  if(action_id)
    sql += " id = "+action_id;
  if(user_id)
    sql += " AND user_id = "+user_id;
  if(startTime && endTime)
    sql += " AND datetime BETWEEN '"+startTime+" 00:00:00' AND '"+endTime+" 23:59:59'";

  client.query(sql)
        .then((result) => {
           
          const perPage = 30; // Number of items per page
          const page = parseInt(req.params.page) || 1; // Current page number
          const startIndex = (page - 1) * perPage;
          const endIndex = page * perPage;

          var data = [];
          data = result.rows.slice(startIndex, endIndex);

          for(var i = 0; i < data.length; i++)
          {
            client.query("SELECT username FROM users WHERE id = "+data[i].user_id)
                  .then((result2) => {
                    var username = result2.rows[0];
                    data.rows[i].push(username);
            }); 
          }

          res.json({
            currentPage: page,
            perPage: perPage,
            totalItems: result.rows.length,
            totalPages: Math.ceil(result.rows.length / perPage),
            data: data
          });
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

app.get('/alarm/get/', verifyToken, async (req, res) => {
  
  client.query("SELECT * FROM alarms ORDER BY id")
        .then((result) => {
          res.send(result.rows);
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

app.get('/setting/get/', verifyToken, async (req, res) => {
  
    client.query("SELECT * FROM settings ORDER BY id")
          .then((result) => {
            res.send(result.rows);
          })
          .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
          })
})

app.post('/setting/save/', verifyToken, async (req, res) => {
  
  client.query("UPDATE settings SET setting_value ='"+req.body.contract_address+"' WHERE id = 1")
        .then((result) => {
          client.query("UPDATE settings SET setting_value ="+req.body.exchange_rate+" WHERE id = 2")
                .then((result2) => {
                  client.query("INSERT INTO action_log (user_id, action, datetime) VALUES ("+req.userId+", 'changeSetting', NOW())")
                  res.send("修改成功!"); 
                })
                .catch((e) => {
                  console.error(e.stack);
                  res.status(500).send(e.stack);
                })
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

app.post('/createPayment', async (req, res) => {
  
    var customer = {
        contact : req.body.contact,
        email : "",
        memberReferenceNo : req.body.userId,
        name : req.body.username,
    }

    var order = {
        amount : 100,
        callbackUrl : "www.google.com",
        currency : "MYR",
        customer : customer,
        description : "购买金币",
        orderReferenceNo : req.body.orderReferenceNo,
        redirectUrl : "",
        remarks : "",
        title : "充值",
    }

    CreateNewPayment(order);
})

function GetCurrentTime()
{
    const currentTimeStamp = Date.now();
    const date = new Date(currentTimeStamp);
    const formattedDateTime = date.toISOString().slice(0, 19).replace('T', ' ') + '.' + ('00' + date.getMilliseconds())

    return formattedDateTime;
}

function CheckAlarm(uid)
{
  const date = new Date();

  let currentDay= String(date.getDate()).padStart(2, '0');
  let currentMonth = String(date.getMonth()+1).padStart(2,"0");
  let currentYear = date.getFullYear();

  let today = `${currentDay}-${currentMonth}-${currentYear}`;

  client.query("SELECT * FROM requests WHERE uid = "+uid+" AND request_type = 1 AND datetime BETWEEN '"+today+" 00:00:00' AND '"+today+" 23:59:59'")
        .then((result) => {

          var sum = 0;
          var order_list = [];

          for(var i = 0; i < result.rows.length; i++)
          {
            sum += result.rows[i].amount;
            order_list.push(result.rows[i].orderId);
          }

          if(result.rows.length >= 3 && sum >= 1000)
          {
            client.query("SELECT * FROM alarms WHERE uid = "+uid+" AND datetime BETWEEN '"+today+" 00:00:00' AND '"+today+" 23:59:59'")
             .then((result2) => {
              
              if(result2.rows[0])
              {
                client.query("UPDATE alarms SET set order_list = "+JSON.stringify(order_list)+", status = 0 WHERE id = "+result2.rows[0].id);
              }
              else
              {
                client.query("INSERT INTO alarms (uid, order_list, datetime, status) VALUES ("+uid+", "+JSON.stringify(order_list)+", NOW(), 0)");
              }
            });
          }
  })
  .catch((e) => {
    console.error(e.stack);
    res.status(500).send(e.stack);
  })
}

// -------------------------------------------------------------------------------------------------------------------------

const contractAddress = process.env.CONTRACT_ADDRESS;
const apiKey = process.env.TRONGRID_PRIVATE_KEY;

var privateKey = process.env.CONTRACT_OWNER_PRIVATE_KEY;

const tronWeb = new TronWeb({
  // fullHost: 'https://api.shasta.trongrid.io',
  // solidityNode : 'https://api.shasta.trongrid.io',
  // eventServer : 'https://api.shasta.trongrid.io',
  //headers: { "TRON-PRO-API-KEY": apiKey },
  fullHost: 'https://api.trongrid.io',
  solidityNode : 'https://api.trongrid.io',
  eventServer : 'https://api.trongrid.io',
  privateKey: privateKey,
});
let abi = [process.env.CONTRACT_ABI];

ListenToContract();

app.get('/test', async (req, res) => {
  
  tronWeb.trx.getTransaction("3a875147518a55a1c57a114f630043fc8615b183cf43d2b2e82c83c1924b8c8d")
             .then(result => {

              const encodedData = result.raw_data.contract[0].parameter.value.data;
              const valueHex = "0x" + encodedData.substring(100);

              const valueDecimal = parseInt(valueHex, 16);
              res.send("valueDecimal ="+valueDecimal);
              
             });

});


app.post('/getCoin', async (req, res) => {
  var hash = req.body.hash;

  tronWeb.trx.getTransaction(hash)
             .then(result => {
                if(result.ret[0].contractRet == "SUCCESS")
                {
                  client.query("SELECT * FROM requests WHERE hash = "+hash)
                        .then((result2) => {

                          if(result2.rows.length > 0)
                          {
                            res.send("错误：此订单已被领取");
                          }
                          else
                          {
                            var data = result.raw_data.contract[0].parameter.value.data;

                            con.connect(function(err)
                            {
                              if (err) throw err;
                                console.log("Connected!");

                                con.query("SELECT amount FROM cmf_user WHERE id = "+req.userId, function (err, oldAmount) {
                                  if (err) throw err;

                                  var sql = "UPDATE cmf_user SET score ="+(oldAmount + amount)+" WHERE id = "+req.userId+";";
                                  con.query(sql, function (err, result3) {
                                    if (err) throw err;
                                      console.log("Result: " + result3);
                                      client.query("INSERT INTO requests (request_type, sender_address, receiver_address, amount, datetime, uid, hash) VALUES (0, '"+sender+"', '"+receiver+"', "+amount+", NOW(), '"+hash+"')");
                                  });
                                });
                            });
                          }
                    });
                }
                else
                {
                  res.send("错误：此订单未完成");
                }
             });
});

app.get('/contract/balance', async (req, res) => {
  try {

    let contract = await tronWeb.contract(abi).at(contractAddress);
    let result = await contract.getBalance().call();
    let data = tronWeb.toDecimal(result._hex) / 1000000;

    res.json(data);

  } catch (error) {
    console.error(error);
    res.status(500).send(error.stack);
  }
});

// app.post('/contract/deposit', async (req, res) => {
//   try {

//     let contract = await tronWeb.contract(abi).at(contractAddress);
//     let result = await contract.deposit(req.body.uid, (req.body.amount * 1000000)).send();
    
//     res.json(result);

//   } catch (error) {
//     console.error(error);
//     res.status(500).send(error.stack);
//   }
// });

// app.post('/contract/withdraw', async (req, res) => {
//   try {

//     let contract = await tronWeb.contract(abi).at(contractAddress);
//     let result = await contract.withdraw(req.body.recipient, req.body.uid, (req.body.amount * 1000000)).send();
    
//     res.json(result);

//   } catch (error) {
//     console.error(error);
//     res.status(500).send(error.stack);
//   }
// });

async function ListenToContract()
{
  let instance = await tronWeb.contract().at(contractAddress);

  instance["Deposit"]().watch((err, eventResult) => {
    if (err) {
        return console.error('Error with "Deposit" event:', err);
    }
    if (eventResult) { 
        console.log('eventResult:',eventResult);

        client.query("INSERT INTO requests VALUES (0, "+tronWeb.address.fromHex(eventResult.account)+", "+contractAddress+", "+(eventResult.amount / 1000000)+", NOW(), "+eventResult.uid)
        .then((result) => {
          ModifyUserCoin((eventResult.amount / 1000000), eventResult.uid)
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
    }
  });

  instance["Withdrawal"]().watch((err, eventResult) => {
    if (err) {
        return console.error('Error with "Withdrawal" event:', err);
    }
    if (eventResult) { 
        console.log('eventResult:',eventResult);

        client.query("INSERT INTO requests VALUES (1, "+contractAddress+", "+tronWeb.address.fromHex(eventResult.account)+", "+(eventResult.amount / 1000000)+", NOW(), "+eventResult.uid)
        .then((result) => {
          ModifyUserCoin((eventResult.amount / 1000000), eventResult.uid)
          CheckAlarm(eventResult.uid);
        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
    }
  });
}

function ModifyUserCoin(amount, userId)
{
  // con.connect(function(err) {
  //   if (err) throw err;
  //   console.log("Connected!");

  //   var sql = "UPDATE cmf_user SET score ="+amount+" WHERE id = "+userId+";";
  //   con.query(sql, function (err, result) {
  //     if (err) throw err;
  //     console.log("1 record updated");
  //   });
  // });
}

// GLYPAY -------------------------------------------------------------------------------------------------------------------------

// var authenticationServer = 'https://sb-sso.glypay.com';
// var restAPIServer = 'https://sb-api.glypay.com';

// function CreateNewPayment(order)
// {
//     axios.post(authenticationServer+"/auth/token", {
//             grant_type : "client_credentials"
//         }, {
//             headers: {
//                 'Authorization': `Basic ` + base64.encode(process.env.CLIENT_ID+":"+process.env.CLIENT_SECRET),
//                 'Content-Type' : `application/x-www-form-urlencoded`,
//             }
//         })
//         .then(function (response) {
        
//             var payload = {
//                 order : order,
//                 storeId : process.env.STORE_ID,
//                 type: "ECOMMERCE"
//             }
        
//             var bytes = utf8.encode(JSON.stringify(payload));
//             var encoded = base64.encode(bytes);
        
//             var unix = Math.round(+new Date()/1000);
//             var nonce = "Dpjczql20RuZRsUblzMB3hOjdPfiZZfS";
        
//             var param = "data="+encoded+"&timestamp="+unix+"&nonce="+nonce;
//             var hmac = crypto.createHmac("sha512", process.env.STORE_KEY);
//             var signed = hmac.update(new Buffer(param, 'utf-8')).digest("base64");
        
//             axios.post(restAPIServer+"/payment/order", payload, {
//                 headers: {
//                     'Authorization': `BEARER ${response.data.access_token}`,
//                     'x-signature' : signed,
//                     'x-timestamp' : unix,
//                     'x-nonce' : nonce,
//                 }
//               })
//                 .then(function (response2) {
//                     console.log(response2.data);
//               })
//                 .catch(function (error) {
//                     console.log(error);
//               });
//         })
//         .catch(function (error) {
//             console.log(error);
//     });
// }

// function VoidPayment(transaction_id, amount, reason)
// {
//     axios.post(authenticationServer+"/auth/token", {
//             grant_type : "client_credentials"
//         }, {
//             headers: {
//                 'Authorization': `Basic ` + base64.encode(process.env.CLIENT_ID+":"+process.env.CLIENT_SECRET),
//                 'Content-Type' : `application/x-www-form-urlencoded`,
//             }
//         })
//         .then(function (response) {
        
//             var payload = {
//                 amount : amount,
//                 currency : "MYR",
//                 reason : reason,
//                 transactionId : transaction_id
//             }
        
//             var bytes = utf8.encode(JSON.stringify(payload));
//             var encoded = base64.encode(bytes);
        
//             var unix = Math.round(+new Date()/1000);
//             var nonce = "Dpjczql20RuZRsUblzMB3hOjdPfiZZfS";
        
//             var param = "data="+encoded+"&timestamp="+unix+"&nonce="+nonce;
//             var hmac = crypto.createHmac("sha512", process.env.STORE_KEY);
//             var signed = hmac.update(new Buffer(param, 'utf-8')).digest("base64");
        
//             axios.post(restAPIServer+"/payment/order/transaction/void", payload, {
//                 headers: {
//                     'Authorization': `BEARER ${response.data.access_token}`,
//                     'x-signature' : signed,
//                     'x-timestamp' : unix,
//                     'x-nonce' : nonce,
//                 }
//               })
//                 .then(function (response2) {
//                     console.log(response2.data);
//               })
//                 .catch(function (error) {
//                     console.log(error);
//               });
//         })
//         .catch(function (error) {
//             console.log(error);
//     });
// }

// function RefundPayment(transaction_id, amount, reason)
// {
//     axios.post(authenticationServer+"/auth/token", {
//             grant_type : "client_credentials"
//         }, {
//             headers: {
//                 'Authorization': `Basic ` + base64.encode(process.env.CLIENT_ID+":"+process.env.CLIENT_SECRET),
//                 'Content-Type' : `application/x-www-form-urlencoded`,
//             }
//         })
//         .then(function (response) {
        
//             var payload = {
//                 amount : amount,
//                 currency : "MYR",
//                 reason : reason,
//                 transactionId : transaction_id
//             }
        
//             var bytes = utf8.encode(JSON.stringify(payload));
//             var encoded = base64.encode(bytes);
        
//             var unix = Math.round(+new Date()/1000);
//             var nonce = "Dpjczql20RuZRsUblzMB3hOjdPfiZZfS";
        
//             var param = "data="+encoded+"&timestamp="+unix+"&nonce="+nonce;
//             var hmac = crypto.createHmac("sha512", process.env.STORE_KEY);
//             var signed = hmac.update(new Buffer(param, 'utf-8')).digest("base64");
        
//             axios.post(restAPIServer+"/payment/order/transaction/void", payload, {
//                 headers: {
//                     'Authorization': `BEARER ${response.data.access_token}`,
//                     'x-signature' : signed,
//                     'x-timestamp' : unix,
//                     'x-nonce' : nonce,
//                 }
//               })
//                 .then(function (response2) {
//                     console.log(response2.data);
//               })
//                 .catch(function (error) {
//                     console.log(error);
//               });
//         })
//         .catch(function (error) {
//             console.log(error);
//     });
// }

// function GetStatusByTransaction(transaction_id)
// {
//     axios.post(authenticationServer+"/auth/token", {
//             grant_type : "client_credentials"
//         }, {
//             headers: {
//                 'Authorization': `Basic ` + base64.encode(process.env.CLIENT_ID+":"+process.env.CLIENT_SECRET),
//                 'Content-Type' : `application/x-www-form-urlencoded`,
//             }
//         })
//         .then(function (response) {
        
//             axios.get(restAPIServer+"/payment/order/transaction/"+transaction_id, {
//                 headers: {
//                     'Authorization': `BEARER ${response.data.access_token}`,
//                 }
//               })
//                 .then(function (response2) {
//                     console.log(response2.data);
//               })
//                 .catch(function (error) {
//                     console.log(error);
//               });
//         })
//         .catch(function (error) {
//             console.log(error);
//     });
// }

// function GetStatusByOrder(orderReferenceNo)
// {
//     axios.post(authenticationServer+"/auth/token", {
//             grant_type : "client_credentials"
//         }, {
//             headers: {
//                 'Authorization': `Basic ` + base64.encode(process.env.CLIENT_ID+":"+process.env.CLIENT_SECRET),
//                 'Content-Type' : `application/x-www-form-urlencoded`,
//             }
//         })
//         .then(function (response) {
        
//             axios.get(restAPIServer+"/payment/order/"+orderReferenceNo, {
//                 headers: {
//                     'Authorization': `BEARER ${response.data.access_token}`,
//                 }
//               })
//                 .then(function (response2) {
//                     console.log(response2.data);
//               })
//                 .catch(function (error) {
//                     console.log(error);
//               });
//         })
//         .catch(function (error) {
//             console.log(error);
//     });
// }