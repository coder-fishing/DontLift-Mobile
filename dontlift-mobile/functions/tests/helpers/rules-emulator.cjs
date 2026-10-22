'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');

async function createRulesEnvironment() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  const hostAndPort = process.env.FIRESTORE_EMULATOR_HOST;
  if (!projectId || !projectId.startsWith('demo-') || !hostAndPort) {
    throw new Error('Rules tests require a demo-* project and a running local Firestore emulator.');
  }

  const [host, portText] = hostAndPort.split(':');
  if (!host || !portText || !Number.isInteger(Number(portText))) {
    throw new Error('FIRESTORE_EMULATOR_HOST must be host:port.');
  }

  const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const environment = await initializeTestEnvironment({
    projectId,
    firestore: { host, port: Number(portText), rules },
  });
  // Mỗi test bắt đầu sạch; test:rooms chạy tuần tự để không xóa dữ liệu của suite khác.
  await environment.clearFirestore();
  return environment;
}

module.exports = { createRulesEnvironment };
