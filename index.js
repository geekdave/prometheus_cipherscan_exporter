const _ = require('lodash');
const express = require('express');
const prometheusClient = require('prom-client');
const { spawn } = require('child_process');

const metricsServer = express();

var hostname;

const DEBUG = process.env['CIPHERSCAN_EXPORTER_DEBUG'] || false;

const collectDefaultMetrics = prometheusClient.collectDefaultMetrics;
collectDefaultMetrics();

const up = new prometheusClient.Gauge({name: 'up', help: 'UP Status'});

const ciphers = new prometheusClient.Gauge({
  name: 'cipherscan_ciphers',
  help: 'Number of enabled ciphers',
  labelNames: ['protocol', 'cipher', 'priority']
});

if (require.main === module) {
  const options = {};

  startServer();
}

function init (options) {
  hostname = options.hostname;
}

function startServer () {
  metricsServer.get('/probe', async (req, res) => {
    res.contentType(prometheusClient.register.contentType);

    try {
      if (!req.query.target) {
        throw new Error("hostname must be provided as query param");
      }
      hostname = req.query.target;

      resetStats();
      const response = await runCipherscan(hostname);

      res.send(prometheusClient.register.metrics());
    } catch (error) {
      // error connecting
      up.set(0);
      res.header('X-Error', error.message || error);
      res.send(prometheusClient.register.getSingleMetricAsString(up.name));
    }
  });

  console.log('Server listening to 9209, metrics exposed on /metrics endpoint');
  metricsServer.listen(9209);
}

function shutdown () {
  metricsServer.close();
}

function resetStats () {
  up.set(1);
  ciphers.reset()
}

async function runCipherscan (hostname) {
  const child = await spawn('./cipherscan/cipherscan', ['-j', 'google.com']);

  process.stdin.pipe(child.stdin)

  var jsonString = "";
  child.stdout.on('data', (data) => {
    jsonString += data;
  });

  const promise = new Promise((resolve, reject) => {
    child.on('exit', function (code, signal) {
      var response = JSON.parse(jsonString);
  
      if (!response) {
        throw new Error('error retrieving response from cipherscan process');
      }
  
      if (!response.ciphersuite) {
        throw new Error('ciphersuite not found in cipherscan result');
      }
  
      _.each(response.ciphersuite, (ciphersuite, priority) => {
        const cipher = ciphersuite.cipher;

        if (!ciphersuite.protocols) {
          throw new Error('protocols not found in ciphersuite object');
        }

        _.each(ciphersuite.protocols, (protocol) => {
          ciphers.set({
            protocol: protocol,
            cipher: cipher,
            priority: (priority + 1)
          }, 1);
        });
      });
  
      resolve();
    });
  });


  return promise;
};

module.exports = {
  init: init,
  runCipherscan: runCipherscan,
  shutdown: shutdown
};
