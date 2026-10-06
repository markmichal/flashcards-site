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
const MEDIA = 'media-v1'

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
