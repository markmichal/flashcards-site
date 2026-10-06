// Keeps the app's own files on the phone so the installed app opens fast.
//
// - Pages: always ask the server first (so a new publish shows up right away),
//   and fall back to the saved copy only when there's no connection.
// - /assets/ files have a fingerprint in their name, so a saved copy is always
//   right: use it if we have it. When a new version is published, the old saved
//   files are cleared and the new ones are saved as they're used.
// - Sounds and icons: use the saved copy, and refresh it in the background.
// - Everything else (sign-in, your decks and cards from the database) is never
//   touched here; it always goes straight to the internet.

const SHELL = 'shell-v1'
const ASSETS = 'assets-v1'
const MEDIA = 'media-v2'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  const keep = [SHELL, ASSETS, MEDIA]
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // The Sound Board lives in /soundboard/ and has its own service worker.
  if (url.pathname.startsWith('/soundboard/')) return

  if (req.mode === 'navigate') {
    event.respondWith(page(req))
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req, ASSETS))
  } else if (url.pathname.startsWith('/sounds/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(staleWhileRevalidate(req, MEDIA))
  }
})

async function page(req) {
  const shell = await caches.open(SHELL)
  try {
    const res = await fetch(req)
    if (res.ok) {
      const html = await res.clone().text()
      const old = await shell.match('/')
      // A new version was published: drop the old version's saved files.
      if (old && (await old.text()) !== html) await caches.delete(ASSETS)
      await shell.put('/', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
    }
    return res
  } catch (err) {
    const saved = await shell.match('/')
    if (saved) return saved
    throw err
  }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name)
  const saved = await cache.match(req)
  if (saved) return saved
  const res = await fetch(req)
  if (res.ok) await cache.put(req, res.clone())
  return res
}

async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name)
  const saved = await cache.match(req)
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) void cache.put(req, res.clone())
      return res
    })
    .catch(() => saved)
  return saved ?? fresh
}

// Daily reminders: the server sends { title, body }, and we show it.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Flashcards', {
      body: data.body || 'Your cards are ready whenever you are.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'daily-reminder', // a new one replaces yesterday's instead of piling up
    }),
  )
})

// Tapping a reminder opens the app (or brings it to the front).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin)
      return open ? open.focus() : self.clients.openWindow('/')
    }),
  )
})
