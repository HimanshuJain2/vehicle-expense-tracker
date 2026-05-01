const CACHE_NAME = "vehicle-expense-tracker-v4";
const ASSETS = [
  "./",
  "./login.html",
  "./register.html",
  "./dashboard.html",
  "./add-expense.html",
  "./add-vehicle.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/firebaseClient.js",
  "./js/api.js",
  "./js/ui.js",
  "./js/auth.js",
  "./js/dashboard.js",
  "./js/addExpense.js",
  "./js/addVehicle.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
