// Service worker des notifications push (Firebase Cloud Messaging), servi à la racine
// (/firebase-messaging-sw.js). Généré par une route pour injecter la config Firebase publique.
// Les messages sont de type "data" seulement : le service worker affiche la notification
// et, au clic, ouvre la page précise (data.link). Exclu du proxy de session (proxy.ts).
const FIREBASE_VERSION = "12.19.0"; // même version que le paquet npm « firebase »

// Code du service worker (sans backticks ni ${} : c'est du texte injecté tel quel)
const HANDLERS = `
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  var d = payload.data || {};
  return self.registration.showNotification(d.title || "GMAO", {
    body: d.body || "",
    icon: d.icon || undefined,
    data: { link: d.link || "/" },
  });
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var raw = (event.notification.data && event.notification.data.link) || "/";
  var link = new URL(raw, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (fenetres) {
      for (var i = 0; i < fenetres.length; i++) {
        if (new URL(fenetres[i].url).origin === new URL(link).origin) {
          return fenetres[i].focus().then(function (w) {
            return w && "navigate" in w ? w.navigate(link) : w;
          });
        }
      }
      return self.clients.openWindow(link);
    })
  );
});
`;

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
${HANDLERS}`;
  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}