'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

test('exports the registration callable and reuses one Admin app', () => {
  process.env.GCLOUD_PROJECT = 'demo-dontlift-sl003-bootstrap';
  const adminApp = require('firebase-admin/app');
  const first = require('../index.js');

  assert.equal(typeof first.completeRegistrationProfile, 'function');
  assert.equal(adminApp.getApps().length, 1);

  delete require.cache[require.resolve('../index.js')];
  const second = require('../index.js');

  assert.equal(typeof second.completeRegistrationProfile, 'function');
  assert.equal(adminApp.getApps().length, 1);
});
