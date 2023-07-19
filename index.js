const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cors = require('cors')
const app = express();
const PORT = process.env.PORT || 8081;
const qrcode = require('qrcode');
const crypto = require("crypto");
require('dotenv').config();

const config = {
  connectionString:
    "postgres://paysystemdb_user:NImIQdhh8I8sWXJb79Z24uQTI5oJQqUD@dpg-cir0bbdiuie930j5d8lg-a.singapore-postgres.render.com/paysystemdb?ssl=true",
};

const { Client } = require('pg');
const { constants } = require("buffer");
const { stringify } = require("querystring");
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
    var data = [];
    client.query("SELECT * FROM requests")
          .then((result) => {

          var income = [];
          var expense = [];
          
          for(var i = 0; i < result.rows.length; i++)
          {
            if(result.rows[i].request_type == 0)
            {
              income.push(result.rows[i]);
            }
            else
            {
              expense.push(result.rows[i]);
            }
          }
          
          console.log("income = "+income);
          console.log("expense = "+expense);

          data['income'] = new Array(income.slice(0, 5));
          data['expense'] = new Array(expense.slice(0, 5));

          console.log("data = "+data);
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

app.get('/request/get', verifyToken, async (req, res) => {
  
  if(req.user.userId == 1)
  {
    //client.query("SELECT * FROM requests WHERE deleted_at IS NULL ORDER BY id")
    client.query("SELECT * FROM requests ORDER BY id")
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
    client.query("SELECT * FROM settings")
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
