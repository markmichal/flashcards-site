(function () {
  var SOUNDS = window.SOUNDS
  var KEYS = '1234567890qwertyuiop'.split('')
  var ctx, master
  var active = new Set()
  var vol = 0.8

  try {
    var saved = localStorage.getItem('soundboard-volume')
    if (saved !== null && !isNaN(parseFloat(saved))) vol = Math.min(1, Math.max(0, parseFloat(saved)))
  } catch (e) {}

  var grid = document.getElementById('grid')
  var volEl = document.getElementById('vol')
  volEl.value = Math.round(vol * 100)

  // The audio engine can only start after the first click or key press.
  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      master = ctx.createGain()
      master.gain.value = vol
      var comp = ctx.createDynamicsCompressor()
      master.connect(comp)
      comp.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  function play(i) {
    var c = ensure()
    var s = SOUNDS[i]
    var out = c.createGain()
    out.gain.value = 0.8 * (s.level || 1)
    out.connect(master)
    s.play(c, out, c.currentTime + 0.02)
    active.add(out)
    setTimeout(function () {
      try { out.disconnect() } catch (e) {}
      active.delete(out)
    }, (s.dur + 0.4) * 1000)
    var btn = grid.children[i]
    btn.classList.add('hit')
    setTimeout(function () { btn.classList.remove('hit') }, 110)
  }

  function stopAll() {
    if (!ctx) return
    active.forEach(function (out) {
      out.gain.cancelScheduledValues(ctx.currentTime)
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
      setTimeout(function () { try { out.disconnect() } catch (e) {} }, 150)
    })
    active.clear()
  }

  SOUNDS.forEach(function (s, i) {
    var b = document.createElement('button')
    b.className = 'pad'
    b.style.setProperty('--h', String(Math.round((i * 360) / SOUNDS.length + 8)))
    b.innerHTML =
      '<kbd>' + KEYS[i] + '</kbd><span class="emoji" aria-hidden="true">' + s.emoji + '</span>' +
      '<span class="name">' + s.name + '</span>'
    b.addEventListener('click', function () { play(i) })
    grid.appendChild(b)
  })

  document.getElementById('stop').addEventListener('click', stopAll)

  volEl.addEventListener('input', function () {
    vol = volEl.value / 100
    if (master) master.gain.setTargetAtTime(vol, ctx.currentTime, 0.01)
    try { localStorage.setItem('soundboard-volume', String(vol)) } catch (e) {}
  })

  document.addEventListener('keydown', function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.target && e.target.tagName === 'INPUT') return
    if (e.key === 'Escape' || e.key === ' ') {
      e.preventDefault()
      stopAll()
      return
    }
    var i = KEYS.indexOf(e.key.toLowerCase())
    if (i >= 0) {
      e.preventDefault()
      play(i)
    }
  })

  // One-click install button (Chrome and Edge offer this when the app qualifies).
  var deferred
  var installBtn = document.getElementById('install')
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault()
    deferred = e
    installBtn.hidden = false
  })
  installBtn.addEventListener('click', function () {
    if (!deferred) return
    deferred.prompt()
    deferred.userChoice.then(function () {
      deferred = null
      installBtn.hidden = true
    })
  })
  window.addEventListener('appinstalled', function () { installBtn.hidden = true })

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {})
  }
})()
