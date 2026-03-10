// src/utils/firebase.ts

import 'dotenv/config';
import admin from 'firebase-admin';
import fs from 'node:fs';

// --- helpers ---
function readJson(path?: string) {
  if (!path) return undefined;
  const txt = fs.readFileSync(path, 'utf8');
  return JSON.parse(txt);
}
function must<T>(v: T | undefined, name: string): T {
  if (v === undefined || v === null || v === '') {
    throw new Error(`[firebase] Missing required env: ${name}`);
  }
  return v;
}

// --- ENV (aligned with your .env) ---
const DATA_PROJECT_ID = must(process.env.FIREBASE_PROJECT_ID, 'FIREBASE_PROJECT_ID'); // e-spark-ccs
const DATA_CREDS_FILE = must(process.env.GOOGLE_APPLICATION_CREDENTIALS_DATA, 'GOOGLE_APPLICATION_CREDENTIALS_DATA');

const AUTH_PROJECT_ID = must(process.env.AUTH_PROJECT_ID, 'AUTH_PROJECT_ID'); // e-spark-app
const AUTH_CREDS_FILE = must(process.env.GOOGLE_APPLICATION_CREDENTIALS_AUTH, 'GOOGLE_APPLICATION_CREDENTIALS_AUTH');

// --- DATA APP (Firestore: e-spark-ccs) ---
const dataCred = admin.credential.cert(readJson(DATA_CREDS_FILE) as any);
const dataApp =
  admin.apps.find(a => a?.name === 'data') ||
  admin.initializeApp({ credential: dataCred, projectId: DATA_PROJECT_ID }, 'data');

// --- AUTH APP (verify tokens: e-spark-app) ---
const authCred = admin.credential.cert(readJson(AUTH_CREDS_FILE) as any);
const authApp =
  admin.apps.find(a => a?.name === 'auth') ||
  admin.initializeApp({ credential: authCred, projectId: AUTH_PROJECT_ID }, 'auth');

// --- Exports ---
export const db = admin.firestore(dataApp);
export const auth = admin.auth(authApp);

// Helpful boot logs (no secrets)
console.log(
  `[firebase] Firestore→project=${DATA_PROJECT_ID} (app='data'); Auth→project=${AUTH_PROJECT_ID} (app='auth').`
);
