import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from "firebase/auth";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const requiredConfig: Array<keyof FirebaseOptions> = ["apiKey", "authDomain", "projectId", "appId"];
const firebaseLandlordAuthEnabled = (process.env.EXPO_PUBLIC_ENABLE_FIREBASE_LANDLORD_AUTH || "false").toLowerCase() === "true";

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

export function isFirebaseLandlordAuthEnabled() {
  return firebaseLandlordAuthEnabled;
}

export function getFirebaseConfigError() {
  if (!firebaseLandlordAuthEnabled) return "";
  const missing = requiredConfig.filter((key) => !firebaseConfig[key]);
  if (!missing.length) return "";
  return `Missing Firebase config: ${missing.join(", ")}.`;
}

function getFirebaseApp() {
  if (appInstance) return appInstance;

  if (!firebaseLandlordAuthEnabled) {
    throw new Error("Firebase landlord auth is disabled.");
  }

  const configError = getFirebaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return appInstance;
}

export function getFirebaseAuth() {
  if (authInstance) return authInstance;

  const app = getFirebaseApp();
  if (Platform.OS === "web") {
    authInstance = getAuth(app);
    return authInstance;
  }

  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    authInstance = getAuth(app);
  }

  return authInstance;
}
