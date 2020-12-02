const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const uniquid = require('uniqid');
const nodemailer = require('nodemailer');
const path = require('path');
const Config = require('../config/config');
const SqliteDriver = require('../data-drivers/sqlitedb');
const FirestoreDriver = require('../data-drivers/firestoredb');
const MysqlDriver = require('../data-drivers/mysqldb');
const StorageDriver = require('../storage-drivers/gcpstorage');
const LocalStorage = require('../storage-drivers/localstorage');

const router = express.Router();

const config = new Config();

let data;
let storage;

function removeDir (path) {
  if (fs.existsSync(path)) {
    const files = fs.readdirSync(path);

    files.forEach(function(filename) {
      if (fs.statSync(path + "/" + filename).isDirectory()) {
        removeDir(path + "/" + filename);
      } else {
        fs.unlinkSync(path + "/" + filename);
      }
    });
    fs.rmdirSync(path);
  } else {
    console.log("Directory path not found.")
  }
}

async function initialize() {
  await config.initialize();

  const dbType = await config.getDatabaseType();

  if (dbType === 'firestore') {
    data = new FirestoreDriver();
    storage = new StorageDriver();
  } else if (dbType === 'mysql') {
    data = new MysqlDriver();
    storage = new StorageDriver();
  } else if (dbType === 'local') {
    data = new SqliteDriver();
    storage = new LocalStorage();
  }
  await data.initialize(config);
  await storage.initialize(config, data);
}

initialize();

express().use(express.static('./config'));

router.get('/isConnected', function (req, res) {
  if (data.isConnected()) {
    res.send(true);
  } else {
    res.send(false);
  }
});

router.get('/getDatabaseType', async function (req, res) {
  const type = await config.getDatabaseType();
  res.json(type);
});

router.get('/hasAdmin', function (req, res) {
  const options = {
    where: [['role', '=', 'Administrator']],
    limit: parseInt(1),
  };

  data
    .getDocs('acsys_users', options)
    .then((result, reject) => {
      if (result.length > 0) {
        res.send((rData = { value: true }));
      } else {
        res.send((rData = { value: false }));
      }
    })
    .catch(() => {
      res.send((rData = { value: false }));
    });
});

router.post('/register', function (req, res) {
  res.send([]);
});

router.post('/verifyPassword', function (req, res) {
  data.verifyPassword(req.body.acsys_id).then((result) => {
    bcrypt.compare(req.body.password, result, function (err, outcome) {
      if (outcome) {
        res.send({ value: true });
      } else {
        res.send({ value: false });
      }
    });
  });
});

router.post('/sendResetLink', function (req, res) {
  res.send({ message: 'Not available in demo.' });
});

router.post('/resetPassword', function (req, res) {
  res.send({ message: 'Not available in demo.' });
});

router.post('/createUser', function (req, res) {
  res.send([]);
});

router.post('/updateUser', function (req, res) {
  res.send([]);
});

router.post('/authenticate', function (req, res) {
  const cUsername = req.body.username.username;
  const cPassword = `${req.body.password.password}`;

  const options = {
    where: [['username', '=', cUsername]],
  };
  data
    .getDocs('acsys_users', options)
    .then((result) => {
      bcrypt.compare(cPassword, result[0].acsys_cd, async function (err, outcome) {
        if (outcome) {
          const token = jwt.sign(
            { sub: result[0].acsys_cd },
            await config.getSecret(),
            {
              expiresIn: '1d',
            }
          );
          const refreshToken = jwt.sign(
            { sub: result[0].acsys_cd },
            await config.getSecret(),
            {
              expiresIn: '3d',
            }
          );
          res.json({
            acsys_id: result[0].acsys_id,
            role: result[0].role,
            mode: result[0].mode,
            username: result[0].username,
            email: result[0].email,
            token,
            refreshToken,
          });
        } else {
          res.status(400).json({
            message: 'Username or password is incorrect.',
          });
        }
      });
    })
    .catch((result) => {
      res.status(400).json({
        message: 'Username or password is incorrect.',
      });
    });
});

router.post('/refresh', async function (req, res) {
  const token = jwt.sign({ sub: await config.getSecret() }, await config.getSecret(), {
    expiresIn: '1d',
  });
  const refreshToken = jwt.sign({ sub: await config.getSecret() }, await config.getSecret(), {
    expiresIn: '3d',
  });
  res.json({ token, refreshToken });
});

router.get('/getProjectName', function (req, res) {
  data
    .getProjectName()
    .then((result) => {
      res.send((rData = { value: result }));
    })
    .catch(() => {
      res.send((rData = { value: false }));
    });
});

router.get('/getUrl', function (req, res) {
  const url = req.protocol + '://' + req.get('host') + '/api/readData?table=' + req.query.table + '&options=' + req.query.options;
  res.send((rdata = {url: url}));
});

router.get('/getOpenUrl', function (req, res) {
  const url = req.protocol + '://' + req.get('host') + '/api/readOpenData?table=' + req.query.table + '&options=' + req.query.options;
  res.send((rdata = {url: url}));
});

router.get('/getAll', function (req, res) {
  userService
    .getAll()
    .then((users) => res.json(users))
    .catch((err) => next(err));
});

router.get('/getUsers', function (req, res) {
  data.getUsers(req.query.user).then((result, reject) => {
    res.send(result);
  });
});

router.post('/increment', function (req, res) {
  res.send([]);
});

router.post('/repositionViews', function (req, res) {
  res.send([]);
});

router.post('/createTable', function (req, res) {
  res.send([]);
});

router.post('/dropTable', function (req, res) {
  res.send([]);
});

router.get('/readData', function (req, res) {
  const options = JSON.parse(req.query.options);
  data.getDocs(req.query.table, options).then((result, reject) => {
    res.send(result);
  });
});

router.get('/readPage', function (req, res) {
  data.getPage(req.query.table, req.query.options).then((result, reject) => {
    res.send(result);
  });
});

router.post('/insertData', function (req, res) {
  res.send([]);
});

router.post('/updateData', function (req, res) {
  res.send([]);
});

router.post('/deleteData', function (req, res) {
  res.send([]);
});

router.get('/readOpenData', function (req, res) {
  const { table } = req.query;
  const options = JSON.parse(req.query.options);
  data
    .checkOpenTable(table)
    .then((result) => {
      if (result) {
        data.getDocs(table, options).then((result, reject) => {
          res.send(result);
        });
      } else {
        res.send('Error: Table must be unlocked before it can be accessed.');
      }
    })
    .catch(() => {
      res.send(false);
    });
});

router.post('/insertOpenData', function (req, res) {
  res.send([]);
});

router.post('/updateOpenData', function (req, res) {
  res.send([]);
});

router.post('/deleteOpenData', function (req, res) {
  res.send([]);
});

router.post('/deleteView', function (req, res) {
  res.send([]);
});

router.get('/getTableData', function (req, res) {
  data.getTableData().then((result) => {
    res.send(result);
  });
});

router.get('/getTables', function (req, res) {
  data.listTables().then((result) => {
    res.send(result);
  });
});

router.get('/getTableSize', function (req, res) {
  data.getTableSize(req.query.table).then((result, reject) => {
    res.send((rData = { value: result }));
  });
});

router.post('/unlockTable', function (req, res) {
  res.send([]);
});

router.post('/lockTable', function (req, res) {
  res.send([]);
});

router.post('/syncFiles', function (req, res) {
  res.send([]);
});

router.post('/createNewFolder', function (req, res) {
  res.send([]);
});

router.post('/uploadFile', function (req, res) {
  res.send([]);
});

router.get('/getStorageURL', function (req, res) {
  storage.getStorageURL(req).then((result, reject) => {
    res.send(
      JSON.stringify({
        data: result,
      })
    );
  });
});

router.get('/getFile', async function (req, res) {
  const file = path.resolve('files/' + req.query.file);
  if(req.query.token !== undefined) {
    const token = req.query.token;
    try {
      const decoded = jwt.verify(token, await config.getSecret());
      if (decoded) {
        const today = parseInt(new Date().getTime().toString().substr(0, 10));
        const difference = decoded.exp - today;
        if (difference <= 0) {
          res.send('Link has expired.');
        }
        res.sendFile(file);
      }
      else {
        res.send('File could not be retrieved.');
      }
    } catch (error) {
      res.send('File could not be retrieved.');
    }
  }
  else {
    res.sendFile(file);
  }
});

router.post('/makeFilePublic', function (req, res) {
  res.send([]);
});

router.post('/makeFilePrivate', function (req, res) {
  res.send([]);
});

router.post('/deleteFile', function (req, res) {
  res.send([]);
});

router.post('/restart', function (req, res) {
  res.send([]);
});

router.post('/setInitialLocalDatabaseConfig', async function (req, res) {
  res.send([]);
});

router.post('/setLocalDatabaseConfig', async function (req, res) {
  res.send([]);
});

router.post('/setInitialFirestoreConfig', async function (req, res) {
  res.send([]);
});

router.post('/setFirestoreConfig', async function (req, res) {
  res.send([]);
});

router.post('/setInitialMysqlConfig', async function (req, res) {
  res.send([]);
});

router.post('/setMysqlConfig', async function (req, res) {
  res.send([]);
});

router.get('/loadDatabaseConfig', async function (req, res) {
  res.send([]);
});

router.get('/getDatabaseConfig', async function (req, res) {
  res.send([]);
});

router.get('/loadStorageConfig', async function (req, res) {
  const type = await config.getStorageType();
  if ((type) === 'gcp') {
    try {
      fs.readFile('./acsys.service.config.json', function (
        err,
        dataConfig
      ) {
        if (err) {
          res.send((rData = { value: false }));
        } else {
          storage
            .initialize(config, data)
            .then((result) => {
              res.send((rData = { value: true }));
            })
            .catch((result) => {
              res.send((rData = { value: false }));
            });
        }
      });
    } catch (error) {
      res.send((rData = { value: false }));
    }
  } 
  else if((type) === 'local') {
    res.send((rData = { value: true }));
  }
  else {
    res.send((rData = { value: false }));
  }
});

router.get('/getCurrentBucket', async function (req, res) {
  res.send([]);
});

router.post('/setStorageBucket', async function (req, res) {
  res.send([]);
});

router.get('/getStorageBuckets', async function (req, res) {
  res.send([]);
});

router.post('/setEmailConfig', async function (req, res) {
  res.send([]);
});

router.get('/getEmailConfig', async function (req, res) {
  res.send([]);
});

module.exports = router;
