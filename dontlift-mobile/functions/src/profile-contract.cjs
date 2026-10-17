'use strict';

const { createHash } = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateRequest(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || Object.keys(data).some((key) => !['version', 'requestId', 'displayName'].includes(key))
    || data.version !== 1
    || typeof data.requestId !== 'string'
    || !UUID_PATTERN.test(data.requestId)
    || typeof data.displayName !== 'string') {
    throw new HttpsError('invalid-argument', 'Invalid registration profile request.');
  }

  const displayName = data.displayName.trim();
  const codePointLength = Array.from(displayName).length;
  if (codePointLength < 1 || codePointLength > 40) {
    throw new HttpsError('invalid-argument', 'Invalid registration profile request.');
  }

  return {
    requestId: data.requestId,
    displayName,
    payloadHash: createHash('sha256')
      .update(JSON.stringify({ version: 1, displayName }))
      .digest('hex'),
  };
}

function profileResponse(uid, profile, authEmail, fallbackCreatedAtUtcMs) {
  const createdAt = profile.createdAt;
  const createdAtUtcMs = createdAt && typeof createdAt.toMillis === 'function'
    ? createdAt.toMillis()
    : fallbackCreatedAtUtcMs;

  return {
    uid,
    displayName: typeof profile.displayName === 'string' ? profile.displayName : '',
    email: typeof profile.email === 'string' ? profile.email : authEmail,
    isPremium: profile.isPremium === true,
    createdAtUtcMs,
  };
}

function buildCompleteRegistrationProfile({ auth, firestore, fieldValue, now = Date.now }) {
  return async (request) => {
    if (!request.auth || typeof request.auth.uid !== 'string' || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'Authentication is required.');
    }

    const validated = validateRequest(request.data);
    const uid = request.auth.uid;

    try {
      const authUser = await auth.getUser(uid);
      if (typeof authUser.email !== 'string' || !authUser.email) {
        throw new HttpsError('failed-precondition', 'The authenticated account has no email.');
      }

      const userRef = firestore.collection('users').doc(uid);
      const receiptRef = userRef.collection('commandReceipts').doc(validated.requestId);
      const createdAtUtcMs = now();

      return await firestore.runTransaction(async (transaction) => {
        const receiptSnapshot = await transaction.get(receiptRef);
        if (receiptSnapshot.exists) {
          const receipt = receiptSnapshot.data();
          if (receipt.payloadHash !== validated.payloadHash) {
            throw new HttpsError('already-exists', 'Request ID was already used.');
          }
          return receipt.outcome;
        }

        const userSnapshot = await transaction.get(userRef);
        let profile;
        let responseCreatedAt = createdAtUtcMs;

        if (userSnapshot.exists) {
          profile = userSnapshot.data();
          const existingCreatedAt = profile.createdAt;
          if (existingCreatedAt && typeof existingCreatedAt.toMillis === 'function') {
            responseCreatedAt = existingCreatedAt.toMillis();
          }
        } else {
          profile = {
            displayName: validated.displayName,
            email: authUser.email,
            isPremium: false,
            createdAt: fieldValue.serverTimestamp(),
            updatedAt: fieldValue.serverTimestamp(),
          };
          transaction.create(userRef, profile);
        }

        const outcome = {
          version: 1,
          requestId: validated.requestId,
          profile: profileResponse(uid, profile, authUser.email, responseCreatedAt),
        };
        transaction.create(receiptRef, {
          payloadHash: validated.payloadHash,
          outcome,
          createdAt: fieldValue.serverTimestamp(),
        });
        return outcome;
      });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('unavailable', 'Profile completion can be retried.');
    }
  };
}

module.exports = { buildCompleteRegistrationProfile, validateRequest };
