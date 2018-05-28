const fixture = require('./fixtures.json');
var chai = require('chai');
var expect = chai.expect;
const sinon = require('sinon');
const events = require('events');
const child_process = require('child_process');


var app = require('../index');

describe('runCipherscan', () => {

  let spawnEvent;
  let sandbox;

  beforeEach(() => {

    app.init({
      hostname: 'google.com'
    });

    // i like the sandbox, or you can use sinon itself
    sandbox = sinon.sandbox.create();

    spawnEvent = new events.EventEmitter();
    spawnEvent.stdout = new events.EventEmitter();
    spawnEvent.stdout.emit('data', fixture);
    spawnEvent.stdout.emit('exit');
    sandbox.stub(child_process, 'spawn').returns(spawnEvent);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("Should get a list of tolerances", async () => {
    const response = await app.runCipherscan();

  });

  it("Should get a list of ciphers");
});
