// Saves the Sound Board's files so it opens fast and works with no internet.
// Always tries the internet first (so updates show up), then falls back to the saved copy.
// This lives in /soundboard/ and only controls /soundboard/, so it never touches the flashcards app.

const CACHE = 'soundboard-v1'
const FILES = ['./', 'index.html', 'app.js', 'sounds.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./'))),
  )
})
