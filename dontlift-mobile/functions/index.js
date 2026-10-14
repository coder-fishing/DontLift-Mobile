'use strict';

const { getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall } = require('firebase-functions/v2/https');
const { buildCompleteRegistrationProfile } = require('./src/profile-contract.cjs');

const app = getApps().length > 0 ? getApps()[0] : initializeApp();
const auth = getAuth(app);
const firestore = getFirestore(app);

exports.completeRegistrationProfile = onCall(
  { region: 'asia-southeast1' },
  buildCompleteRegistrationProfile({ auth, firestore, fieldValue: FieldValue }),
);
