const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require('cors')
const app = express();
const PORT = process.env.PORT || 8081;
require('dotenv').config();
const TronWeb = require('tronweb');

const config = {
  connectionString:
    "postgres://paysystemdb_user:NImIQdhh8I8sWXJb79Z24uQTI5oJQqUD@dpg-cir0bbdiuie930j5d8lg-a.singapore-postgres.render.com/paysystemdb?ssl=true",
};

const contractAddress = process.env.CONTRACT_ADDRESS;
const privateKey = process.env.TRONGRID_PRIVATE_KEY;

const tronWeb = new TronWeb({
  fullHost: 'https://api.shasta.trongrid.io',
  privateKey,
});
let abi = [CONTRACT_ABI];
const contract = tronWeb.contract(abi).at(contractAddress);

const { Client } = require('pg');
const client = new Client(config);
client.connect()

app.use(cors())
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

app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});

app.get('/', async (req, res) => {
  res.status(200).send("OK");
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

app.get('/home/get', verifyToken, async (req, res) => {
  
  if(req.user.userId == 1)
  {
    const data = [];

    client.query("SELECT * FROM settings ORDER BY id ASC")
          .then(async (result) => {

            var walletString = result.rows[0].setting_value;
            var wallet_address = walletString.split(',');

            const promises = wallet_address.map(async (address) => {
              const record = {};
              record['wallet_address'] = address;
              record['total_in'] = await getTotalIn(address);
              record['total_out'] = await getTotalOut(address);
              return record;
            });
        
            const data = await Promise.all(promises);

            res.send(JSON.stringify(data));
          })
          .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
          });          
  }
  else
  {
    res.status(401).send("UnAuthorized");
  }
})

async function getTotalIn(address)
{
  const result = await client.query("SELECT SUM(amount) AS total_amount FROM requests WHERE receiver_address = '"+address+"'")
  return result.rows[0].total_amount;
}

async function getTotalOut(address)
{
  const result = await client.query("SELECT SUM(amount) AS total_amount FROM requests WHERE sender_address = '"+address+"'")
  return result.rows[0].total_amount;
}

app.get('/request/latest', verifyToken, async (req, res) => {
  
  if(req.user.userId == 1)
  {
    client.query("SELECT * FROM requests ORDER BY datetime DESC LIMIT 5")
          .then((result) => {

            res.send(JSON.stringify(result.rows));

          })
          .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
          })
  }
  else
  {
    res.status(401).send("UnAuthorized");
  }
})

app.get('/request/get/:type', verifyToken, async (req, res) => {
  
  if(req.user.userId == 1)
  {
    client.query("SELECT * FROM requests WHERE request_type = "+req.params.type+" ORDER BY id")
          .then((result) => {

            const perPage = 15; // Number of items per page
            const page = parseInt(req.query.page) || 1; // Current page number
            const startIndex = (page - 1) * perPage;
            const endIndex = page * perPage;

            const data = result.rows.slice(startIndex, endIndex);

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
  }
  else
  {
    res.status(401).send("UnAuthorized");
  }
})

app.get('/action_log/get', verifyToken, async (req, res) => {
  
  if(req.user.userId == 1)
  {
    client.query("SELECT * FROM action_log")
          .then((result) => {
           
            const perPage = 15; // Number of items per page
            const page = parseInt(req.query.page) || 1; // Current page number
            const startIndex = (page - 1) * perPage;
            const endIndex = page * perPage;

            const data = result.rows.slice(startIndex, endIndex);

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
  }
  else
  {
    res.status(401).send("UnAuthorized");
  }
})

app.get('/setting/get', verifyToken, async (req, res) => {
  
  if(req.user.userId == 1)
  {
    var data = {};

    client.query("SELECT * FROM settings ORDER BY id")
          .then((result) => {
           
            var wallet_address = result.rows[0].setting_value.split(',');

            for(var i = 0; i < wallet_address.length; i++)
            {
              data['wallet_address'].push(wallet_address[i]);
            }

            data['union_pay'] = result.rows[1].setting_value;
            data['auto_approve_amount'] = result.rows[2].setting_value;

            res.send(JSON.stringify(data));

          })
          .catch((e) => {
            console.error(e.stack);
            res.status(500).send(e.stack);
          })
  }
  else
  {
    res.status(401).send("UnAuthorized");
  }
})

app.get('/wallet_address/get', async (req, res) => {
  
  client.query("SELECT * FROM settings ORDER BY id ASC")
        .then((result) => {
        
          var walletString = result.rows[0].setting_value;
          var wallet_address = walletString.split(',');
          var random = Math.floor(Math.random() * wallet_address.length);

          res.send(JSON.stringify(wallet_address[random]));

        })
        .catch((e) => {
          console.error(e.stack);
          res.status(500).send(e.stack);
        })
})

// -------------------------------------------------------------------------------------------------------------------------

app.get('/contract/balance', async (req, res) => {
  try {
    const balance = await contract.getBalance().call();
    res.json({ balance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/contract/deposit', async (req, res) => {
  try {

    const amount = req.body.amount;
    const options = { from: req.body.wallet_address };

    const approveTx = await tronWeb.trx.sendTransaction(
      contractAddress,
      amount,
      options,
      contract.approve(contractAddress, amount).encodeABI()
    );

    await tronWeb.trx.getTransaction(approveTx.txid);

    const depositTx = await contract.depositUSDT(amount).send(options);

    res.json({ transaction: depositTx.txid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/contract/withdraw', async (req, res) => {
  try {
    const options = { from: process.env.CONTRACT_OWNER }; // Replace with your contract owner address

    // Call the contract's withdraw function
    const withdrawTx = await contract.withdraw().send(options);

    res.json({ transaction: withdrawTx.txid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});