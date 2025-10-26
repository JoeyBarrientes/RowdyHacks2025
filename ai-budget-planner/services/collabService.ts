import type { SavedPlan } from '../types';

// Lightweight collaboration service with optional Firebase integration.
// If Firebase env vars are provided, we enable real-time shared plans.
// Otherwise, the feature is disabled gracefully and the UI can hide or show a hint.

export type SharedPlanDoc = SavedPlan & {
  id: string; // plan id used as document id
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const collabEnabled = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

export function getCollabStatus(): { enabled: boolean; missing: string[] } {
  const envAny: any = (import.meta as any).env || {};
  const missing: string[] = [];
  if (!envAny.VITE_FIREBASE_API_KEY) missing.push('VITE_FIREBASE_API_KEY');
  if (!envAny.VITE_FIREBASE_AUTH_DOMAIN) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!envAny.VITE_FIREBASE_PROJECT_ID) missing.push('VITE_FIREBASE_PROJECT_ID');
  if (!envAny.VITE_FIREBASE_APP_ID) missing.push('VITE_FIREBASE_APP_ID');
  // Optional but recommended
  if (!envAny.VITE_FIREBASE_STORAGE_BUCKET) missing.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!envAny.VITE_FIREBASE_MESSAGING_SENDER_ID) missing.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  return { enabled: missing.length === 0, missing };
}

let _app: any;
let _db: any;

async function ensureFirebase() {
  if (!collabEnabled) throw new Error('Collaboration disabled: missing Firebase config.');
  if (_app && _db) return { app: _app, db: _db };

  const { initializeApp, onLog } = await import("firebase/app");
  const { getFirestore, enableIndexedDbPersistence } = await import("firebase/firestore");
  
  _app = initializeApp(firebaseConfig as any);
  _db = getFirestore(_app);

  // Enable detailed logging for debugging connection issues
  onLog((log: { level: string; message: string; args?: any[] }) => {
    if (log.level === 'debug' || log.level === 'warn' || log.level === 'error') {
      console.log(`[Firebase ${log.level}]:`, log.message, ...(log.args || []));
    }
  }, { level: 'debug' });

  try {
    await enableIndexedDbPersistence(_db);
    console.log('[Firebase] Offline persistence enabled.');
  } catch (err: any) {
    if (err.code == 'failed-precondition') {
      console.warn('[Firebase] Multiple tabs open, persistence can only be enabled in one. Other tabs will be read-only.');
    } else if (err.code == 'unimplemented') {
      console.warn('[Firebase] The current browser does not support all of the features required to enable persistence.');
    }
  }

  return { app: _app, db: _db };
}

// Collection name for shared plans
const COLLECTION = 'shared_plans';

export async function upsertSharedPlan(plan: SavedPlan): Promise<void> {
  const { db } = await ensureFirebase();
  const { doc, setDoc } = await import("firebase/firestore");
  const ref = doc(db, COLLECTION, plan.id);
  await setDoc(ref, { ...plan, shared: true }, { merge: true });
}

export async function getSharedPlan(planId: string): Promise<SharedPlanDoc | null> {
  const { db } = await ensureFirebase();
  const { doc, getDoc } = await import("firebase/firestore");
  const ref = doc(db, COLLECTION, planId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as SharedPlanDoc) : null;
}

export async function listSharedPlansForEmail(email: string): Promise<SharedPlanDoc[]> {
  const { db } = await ensureFirebase();
  const { collection, query, where, getDocs } = await import("firebase/firestore");
  const col = collection(db, COLLECTION);
  const q = query(col, where('collaborators', 'array-contains', email));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d: any) => d.data() as SharedPlanDoc);
}

export async function inviteCollaborator(planId: string, email: string): Promise<void> {
  const plan = await getSharedPlan(planId);
  if (!plan) throw new Error('Shared plan not found');
  const collaborators = Array.from(new Set([...(plan.collaborators || []), email.toLowerCase()]));
  await upsertSharedPlan({ ...plan, collaborators, shared: true });
}

export async function removeCollaborator(planId: string, email: string): Promise<void> {
  const plan = await getSharedPlan(planId);
  if (!plan) return;
  const collaborators = (plan.collaborators || []).filter(e => e.toLowerCase() !== email.toLowerCase());
  await upsertSharedPlan({ ...plan, collaborators, shared: true });
}
