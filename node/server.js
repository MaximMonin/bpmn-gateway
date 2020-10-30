const { ZBClient, Duration, ZBLogger } = require('zeebe-node');
const express = require('express');
const axios = require ('axios'); axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
const http = require ('http');
const formidable = require('formidable');
const FormData = require('form-data')
const fs = require('fs');

const Zeebeurl = process.env.ZeebeUrl || 'localhost:26500';
const Camundaurl = process.env.CamundaUrl || 'http://camunda:8080/engine-rest';
const loglevel = process.env.LogLevel || 'INFO';

console.log('Camunda/Zeebe api gateway is starting...')
const app = express();
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const server = app.listen(port, () =>
  console.log(`Camunda/Zeebe api gateway listening on port ${port}!`)
);
server.setTimeout(300000); // 5 minutes

// For docker enviroment it catch docker compose down/restart commands
// The signals we want to handle
// NOTE: although it is tempting, the SIGKILL signal (9) cannot be intercepted and handled
var signals = {
  'SIGHUP': 1,
  'SIGINT': 2,
  'SIGTERM': 15
};
// Do any necessary shutdown logic for our application here
const shutdown = (signal, value) => {
  server.close(() => {
    console.log(`Camunda/Zeebe api gateway stopped`);
    process.exit(128 + value);
  });
};
// Create a listener for each of the signals that we want to handle
Object.keys(signals).forEach((signal) => {
  process.on(signal, () => {
    console.log(`Camunda/Zeebe api gateway is shutdowning`);
    shutdown(signal, signals[signal]);
  });
});


const zbclient = new ZBClient(Zeebeurl, {
    retry: true,
    maxRetries: -1, // infinite retries
    maxRetryTimeout: Duration.seconds.of(30),
    onReady: () => console.log(`Zeebe Client connected to cluster`),
    onConnectionError: () => console.log(`Zeebe Client disconnected from cluster`),
    connectionTolerance: 3000 // milliseconds
});

async function main() {
  try {
    const res = await zbclient.topology()
    console.log(JSON.stringify(res, null, 2))
  } 
  catch (e) {
    console.error(e)
  }

  app.post('/camunda/process/:key/start', CamundaStartProcess);
  app.post('/camunda/process/:key/start/withresult', CamundaStartProcess);
  app.post('/camunda/message/:messagename/publish', CamundaPublishMessage);
  app.post('/camunda/deployment/:key/create', CamundaDeployWorkflow);
  app.post('/camunda/process/:id/subscribe/result', CamundaSubscribeResult);
  app.post('/camunda/process/:id/publish/result', CamundaPublishResult);

  app.post('/zeebe/process/:key/start', ZeebeStartProcess);
  app.post('/zeebe/process/:key/start/withresult', ZeebeStartProcess);
  app.post('/zeebe/message/:messagename/publish', ZeebePublishMessage);
  app.post('/zeebe/deployment/:key/create', ZeebeDeployWorkflow);
  app.post('/zeebe/process/:id/subscribe/result', ZeebeSubscribeResult);
  app.post('/zeebe/process/:id/publish/result', ZeebePublishResult);
};

// Camunda Api
async function CamundaStartProcess (req, res) {
  const ProcessKey = req.params.key;
  const iParams = Object.assign({}, req.query, req.body);

  console.log ('Starting Camunda workflow...' + ProcessKey + ' ' + JSON.stringify(iParams));
  const vars = iParams.variables;
  const timeout = iParams.timeout || 120 * 1000;
  var data;
  var result;
  var status;
  axios.post( Camundaurl + '/process-definition/key/' + ProcessKey + '/start', 
     {variables: vars}, 
     {httpAgent: new http.Agent({ keepAlive: true }), timeout: timeout})
  .then(response => {
     data = response.data;
     status = "ACTIVE";
     result = {processId: data.id, status: status, data: data };

     if (req.originalUrl.includes("withresult") == true) {
     }

     res.status(200).end(JSON.stringify({result: result}));
  })
  .catch(error => {
     console.log(error.response.data);
     res.status(200).end(JSON.stringify({error: error.response.data}));
  });
}

async function CamundaPublishMessage (req, res) {
  const messageName = req.params.messagename;
  const iParams = Object.assign({}, req.query, req.body);

  console.log ('Camunda Message published... ' + messageName + ' ' + JSON.stringify(iParams));
  const Key = iParams.correlationKey;
  const processId = iParams.processId;
  const timetolive = iParams.timeToLive || 10000;
  const vars = iParams.variables;

  axios.post( Camundaurl + '/message', 
    {messageName: messageName, processInstanceId: processId, processVariables: vars, all: true, resultEnabled: true, variablesInResultEnabled: true}, 
    {httpAgent: new http.Agent({ keepAlive: true }), timeout: 60000})
  .then(response => {
    const result = response.data;
    res.status(200).end(JSON.stringify({result: result}));
  })
  .catch(error => {
    console.log(error.response.data);
    res.status(200).end(JSON.stringify({error: error.response.data}));
  });
};

const formUrlEncoded = x =>
   Object.keys(x).reduce((p, c) => p + `&${c}=${encodeURIComponent(x[c])}`, '')

async function CamundaDeployWorkflow (req, res) {
  const ProcessKey = req.params.key;

  var filepath = '';
  var filename = '';
  var form = new formidable.IncomingForm();
  form.keepExtensions = true;     //keep file extension

  form.parse(req, function(err, fields, files) {
    filepath = files.upload.path;
    filename = files.upload.name;
    console.log ('Deploying Camunda workflow... ' + ProcessKey + ' ' + filename);

    const formData = new FormData();
    formData.append("upload", fs.createReadStream(filepath), filename);
    formData.append("deployment-name", ProcessKey);
    axios.post(Camundaurl + '/deployment/create', formData, { headers: formData.getHeaders() })
    .then(response => {
      const result = response.data;
      fs.unlinkSync(filepath);
      res.status(200).end(JSON.stringify({result: result}));
    })
    .catch(error => {
      console.log(error.response.data);
      res.status(200).end(JSON.stringify({error: error.response.data}));
    });
  });
}

async function CamundaSubscribeResult (req, res) {
  const processId = req.params.id;
  const iParams = Object.assign({}, req.query, req.body);

  console.log ('Starting Camunda subscription for process...' + processId + ' ' + JSON.stringify(iParams));
  const timeout = iParams.timeout || 120 * 1000;
}

async function CamundaPublishResult (req, res) {
  const processId = req.params.id;
  const iParams = Object.assign({}, req.query, req.body);

  if (loglevel == 'DEBUG') {
    console.log ('Result for process...' + processId + ' ' + JSON.stringify(iParams));
  }
}

// Zeebe Api
async function ZeebeStartProcess (req, res) {
  const ProcessKey = req.params.key;
  const iParams = Object.assign({}, req.query, req.body);

  console.log ('Starting Zeebe workflow...' + ProcessKey + ' ' + JSON.stringify(iParams));
  const vars = iParams.variables;
  const timeout = iParams.timeout || 120 * 1000;
  var data;
  var result;
  var status;

  try {
    if (req.originalUrl.includes("withresult") == false) {
      data = await zbclient.createWorkflowInstance(ProcessKey,vars);
      status = "ACTIVE";
      result = {processId: data.workflowInstanceKey, status: status, data: data };
      res.status(200).end(JSON.stringify({result: result}));
    }
    else {
      data = await zbclient.createWorkflowInstanceWithResult(ProcessKey, vars, {requestTimeout: timeout });
      status = "COMPLETED";
      const result = {processId: data.workflowInstanceKey, status: status, variables: data.variables, data: data };

      res.status(200).end(JSON.stringify({result: result}));
    }
  }
  catch (e) {
    console.log(e);
    res.status(200).end(JSON.stringify({error: e}));
  }
};

async function ZeebePublishMessage (req, res) {
  const messageName = req.params.messagename;
  const iParams = Object.assign({}, req.query, req.body);

  console.log ('Zeebe Message published... ' + messageName + ' ' + JSON.stringify(iParams));
  const Key = iParams.correlationKey;
  const timetolive = iParams.timeToLive || 10000;
  const vars = iParams.variables;

  try {
    await zbclient.publishMessage({
      correlationKey: Key,
      name: messageName,
      variables: vars,
      timeToLive: timetolive
    });
    res.status(200).end(JSON.stringify({result: 'message published'}));
  }
  catch (e) {
    console.error(e);
    res.status(200).end(JSON.stringify({error: e}));
  }
};

async function ZeebeDeployWorkflow (req, res) {
  const ProcessKey = req.params.key;

  var filepath = '';
  var filename = '';
  var form = new formidable.IncomingForm();
  form.keepExtensions = true;     //keep file extension

  form.parse(req, function(err, fields, files) {
    filepath = files.upload.path;
    filename = files.upload.name;
    console.log ('Deploying Zeebe workflow... ' + ProcessKey + ' ' + filename);

    try {
      (async (filepath) => {
        const data = await zbclient.deployWorkflow(filepath);
        const result = {status: 'deployed', data: data };
        fs.unlinkSync(filepath);
        res.status(200).end(JSON.stringify({result: result}));
      })(filepath)
    }
    catch (e) {
      console.error(e);
      res.status(200).end(JSON.stringify({error: e}));
    }
  });
};

async function ZeebeSubscribeResult (req, res) {
  const processId = req.params.id;
  const iParams = Object.assign({}, req.query, req.body);

  console.log ('Starting Zeebe subscription for process...' + processId + ' ' + JSON.stringify(iParams));
  const timeout = iParams.timeout || 120 * 1000;

}

async function ZeebePublishResult (req, res) {
  const processId = req.params.id;
  const iParams = Object.assign({}, req.query, req.body);

  if (loglevel == 'DEBUG') {
    console.log ('Result for process...' + processId + ' ' + JSON.stringify(iParams));
  }
}

main ();
