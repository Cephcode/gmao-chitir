// Service worker des notifications push (Firebase Cloud Messaging), servi à la racine
// (/firebase-messaging-sw.js) pour couvrir toute l'application.
// Généré par une route pour y injecter la configuration Firebase publique (NEXT_PUBLIC_*,
// déjà visible dans le navigateur ; aucune clé secrète ici).
// Application en arrière-plan : le SDK affiche la notification et ouvre le lien
// (webpush.fcm_options.link) au clic. Exclu du proxy de session (proxy.ts).
const FIREBASE_VERSION = "12.19.0"; // même version que le paquet npm « firebase »

export function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const script = `importScripts("https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js");
firebase.initializeApp(${JSON.stringify(config)});
firebase.messaging();
`;
  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
