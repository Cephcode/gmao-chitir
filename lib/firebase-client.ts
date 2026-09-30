// Firebase côté navigateur : uniquement le module messaging, chargé à la demande
// (quand on active les notifications), pour ne pas alourdir les autres pages.
// Configuration publique (NEXT_PUBLIC_*), sans secret.

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Ce navigateur sait-il recevoir des push ? (iPhone : seulement une fois l'app ajoutée
// à l'écran d'accueil.)
export async function pushSupported() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    return false;
  }
  const { isSupported } = await import("firebase/messaging");
  return isSupported();
}

async function messaging() {
  const [{ initializeApp, getApps }, { getMessaging }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  const app = getApps()[0] ?? initializeApp(config);
  return getMessaging(app);
}

// Demande l'autorisation puis renvoie le jeton de cet appareil (null si refusé).
export async function obtenirJetonPush(): Promise<string | null> {
  if ((await Notification.requestPermission()) !== "granted") return null;
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  const { getToken } = await import("firebase/messaging");
  return getToken(await messaging(), {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

// Désactive les push sur cet appareil (le jeton devient invalide).
export async function supprimerJetonPush() {
  const { deleteToken } = await import("firebase/messaging");
  await deleteToken(await messaging());
}
