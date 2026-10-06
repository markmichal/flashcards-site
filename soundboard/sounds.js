// 20 sound effects, all made live with the browser's audio engine.
// No sound files needed, so the app is tiny and works offline.
// Each sound is play(ctx, out, T): ctx is the audio context, out is where
// the sound goes, and T is the start time in seconds.
(function () {
  var R = Math.random

  function noiseBuffer(c) {
    if (c._nb) return c._nb
    var len = c.sampleRate * 2
    var b = c.createBuffer(1, len, c.sampleRate)
    var d = b.getChannelData(0)
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    c._nb = b
    return b
  }

  // One note: a wave with a quick fade in and a fade out.
  function tone(c, out, o) {
    var t = o.t || 0
    var d = o.d || 0.3
    var g = Math.max(0.0002, o.g == null ? 0.3 : o.g)
    var a = o.a == null ? 0.005 : o.a
    var osc = c.createOscillator()
    osc.type = o.type || 'sine'
    osc.frequency.setValueAtTime(o.f, t)
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.fd || d))
    var env = c.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(g, t + a)
    if (o.sustain) env.gain.setValueAtTime(g, t + d - (o.r || 0.05))
    env.gain.exponentialRampToValueAtTime(0.0001, t + d)
    osc.connect(env)
    var last = env
    if (o.lp) {
      var lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = o.lp
      last.connect(lp)
      last = lp
    }
    if (o.hp) {
      var hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = o.hp
      last.connect(hp)
      last = hp
    }
    last.connect(out)
    osc.start(t)
    osc.stop(t + d + 0.02)
    return osc
  }

  // A burst of noise through a filter (drums, wind, claps, explosions).
  function noise(c, out, o) {
    var t = o.t || 0
    var d = o.d || 0.2
    var g = Math.max(0.0002, o.g == null ? 0.3 : o.g)
    var a = o.a == null ? 0.003 : o.a
    var s = c.createBufferSource()
    s.buffer = noiseBuffer(c)
    s.loop = true
    var f = c.createBiquadFilter()
    f.type = o.type || 'bandpass'
    f.Q.value = o.q || 1
    f.frequency.setValueAtTime(o.f, t)
    if (o.f2 && o.back) {
      f.frequency.exponentialRampToValueAtTime(o.f2, t + d * 0.4)
      f.frequency.exponentialRampToValueAtTime(o.f, t + d)
    } else if (o.f2) {
      f.frequency.exponentialRampToValueAtTime(o.f2, t + d)
    }
    var env = c.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(g, t + a)
    env.gain.exponentialRampToValueAtTime(0.0001, t + d)
    s.connect(f)
    f.connect(env)
    env.connect(out)
    s.start(t, R() * 1.5)
    s.stop(t + d + 0.02)
  }

  // Plays a pitch that follows a list of values over time.
  function curveTone(c, out, o) {
    var osc = c.createOscillator()
    osc.type = o.type || 'sine'
    osc.frequency.setValueCurveAtTime(Float32Array.from(o.curve), o.t, o.d)
    var env = c.createGain()
    env.gain.setValueAtTime(0.0001, o.t)
    env.gain.exponentialRampToValueAtTime(o.g, o.t + (o.a || 0.01))
    if (o.sustain) env.gain.setValueAtTime(o.g, o.t + o.d - 0.1)
    env.gain.exponentialRampToValueAtTime(0.0001, o.t + o.d)
    osc.connect(env)
    var last = env
    if (o.lp) {
      var lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = o.lp
      env.connect(lp)
      last = lp
    }
    last.connect(out)
    osc.start(o.t)
    osc.stop(o.t + o.d + 0.02)
  }

  function cymbal(c, out, T, k) {
    k = k || 1
    noise(c, out, { t: T, d: 1.8, g: 0.4 * k, type: 'highpass', f: 6000, q: 0.7, a: 0.002 })
    noise(c, out, { t: T, d: 1.2, g: 0.25 * k, f: 9000, q: 0.6, a: 0.002 })
    ;[205, 304, 369, 522, 540, 800].forEach(function (f) {
      tone(c, out, { t: T, type: 'square', f: f, d: 1.2, g: 0.03 * k, hp: 7000, a: 0.002 })
    })
  }

  function snare(c, out, T, k) {
    k = k || 1
    noise(c, out, { t: T, d: 0.18, g: 0.55 * k, f: 1900, q: 0.7 })
    tone(c, out, { t: T, f: 220, f2: 150, d: 0.1, g: 0.4 * k })
  }

  function kick(c, out, T, k) {
    tone(c, out, { t: T, f: 160, f2: 45, d: 0.28, g: 0.9 * (k || 1) })
  }

  function bell(c, out, T, f, d, k) {
    k = k || 1
    tone(c, out, { t: T, f: f, d: d, g: 0.4 * k, a: 0.002 })
    tone(c, out, { t: T, f: f * 2.76, d: d * 0.6, g: 0.18 * k, a: 0.002 })
    tone(c, out, { t: T, f: f * 5.4, d: d * 0.35, g: 0.08 * k, a: 0.002 })
  }

  function brass(c, out, T, f, d, g, f2) {
    ;[0, 7, -7].forEach(function (det) {
      var osc = tone(c, out, {
        t: T, type: 'sawtooth', f: f, f2: f2, d: d, g: g / 2, a: 0.04, sustain: true, r: 0.08, lp: 1800,
      })
      osc.detune.value = det
    })
  }

  var SOUNDS = [
    {
      name: 'Airhorn', emoji: '📢', dur: 2,
      play: function (c, out, T) {
        ;[[0, 0.2], [0.27, 0.2], [0.54, 1.1]].forEach(function (p) {
          ;[466, 622, 932].forEach(function (f) {
            var o = tone(c, out, {
              t: T + p[0], type: 'sawtooth', f: f * 1.06, f2: f, fd: 0.06, d: p[1], g: 0.2,
              a: 0.01, sustain: true, r: 0.04, lp: 3500,
            })
            o.detune.value = R() * 10 - 5
          })
          tone(c, out, { t: T + p[0], type: 'square', f: 233, d: p[1], g: 0.15, a: 0.01, sustain: true, r: 0.04, lp: 1500 })
        })
      },
    },
    {
      name: 'Rimshot', emoji: '🥁', dur: 2.4,
      play: function (c, out, T) {
        tone(c, out, { t: T, f: 200, f2: 90, d: 0.2, g: 0.8 })
        snare(c, out, T + 0.22)
        kick(c, out, T + 0.4)
        cymbal(c, out, T + 0.4, 0.9)
      },
    },
    {
      name: 'Sad Trombone', emoji: '🎺', dur: 3.2,
      play: function (c, out, T) {
        brass(c, out, T, 233, 0.5, 0.5)
        brass(c, out, T + 0.55, 220, 0.5, 0.5)
        brass(c, out, T + 1.1, 208, 0.5, 0.5)
        brass(c, out, T + 1.65, 196, 1.4, 0.5, 170)
      },
    },
    {
      name: 'Ta-Da!', emoji: '🎉', dur: 2.2,
      play: function (c, out, T) {
        brass(c, out, T, 392, 0.14, 0.45)
        brass(c, out, T + 0.15, 523, 0.14, 0.45)
        ;[523, 659, 784, 1047].forEach(function (f) {
          brass(c, out, T + 0.32, f, 1.6, 0.4)
        })
        cymbal(c, out, T + 0.32, 0.5)
      },
    },
    {
      name: 'Drumroll', emoji: '🪘', dur: 3.4,
      play: function (c, out, T) {
        var n = 38
        for (var i = 0; i < n; i++) {
          var p = i / n
          noise(c, out, { t: T + i * 0.045, d: 0.07, g: 0.12 + 0.4 * p, f: 1700, q: 0.6, a: 0.002 })
          tone(c, out, { t: T + i * 0.045, f: 170, f2: 120, d: 0.06, g: 0.1 + 0.25 * p, a: 0.002 })
        }
        kick(c, out, T + 1.75)
        snare(c, out, T + 1.75)
        cymbal(c, out, T + 1.75)
      },
    },
    {
      name: 'Cymbal Crash', emoji: '💫', dur: 2.2,
      play: function (c, out, T) {
        cymbal(c, out, T)
      },
    },
    {
      name: 'Applause', emoji: '👏', dur: 3.4,
      play: function (c, out, T) {
        noise(c, out, { t: T, d: 3, g: 0.07, f: 2200, q: 0.5, a: 0.9 })
        for (var i = 0; i < 160; i++) {
          var x = R() * 2.8
          var swell = Math.sin(Math.PI * (x / 3))
          noise(c, out, {
            t: T + x, d: 0.025 + R() * 0.03, g: 0.05 + 0.35 * swell * (0.4 + R() * 0.6),
            f: 1200 + R() * 3200, q: 0.8, a: 0.002,
          })
        }
      },
    },
    {
      name: 'Buzzer', emoji: '❌', dur: 1.2,
      play: function (c, out, T) {
        tone(c, out, { t: T, type: 'square', f: 120, d: 0.9, g: 0.4, a: 0.01, sustain: true, r: 0.05, lp: 1800 })
        tone(c, out, { t: T, type: 'sawtooth', f: 123, d: 0.9, g: 0.3, a: 0.01, sustain: true, r: 0.05, lp: 1800 })
      },
    },
    {
      name: 'Correct!', emoji: '✅', dur: 1.8,
      play: function (c, out, T) {
        bell(c, out, T, 1047, 0.5, 0.8)
        bell(c, out, T + 0.14, 1568, 1.5, 0.9)
      },
    },
    {
      name: 'Doorbell', emoji: '🚪', dur: 2.6,
      play: function (c, out, T) {
        bell(c, out, T, 659, 1.3, 1)
        bell(c, out, T + 0.6, 523, 1.8, 1)
      },
    },
    {
      name: 'Boing', emoji: '🌀', dur: 1.2,
      play: function (c, out, T) {
        var n = 256
        var curve = []
        for (var i = 0; i < n; i++) {
          var x = i / n
          curve.push(260 + 230 * Math.exp(-3.2 * x) * Math.sin(2 * Math.PI * 7 * x * (1 + 0.5 * x)))
        }
        curveTone(c, out, { t: T, d: 1, curve: curve, g: 0.7, a: 0.01 })
        curveTone(c, out, { t: T, d: 1, curve: curve.map(function (v) { return v * 2 }), g: 0.15, a: 0.01 })
      },
    },
    {
      name: 'Laser', emoji: '👾', dur: 1,
      play: function (c, out, T) {
        ;[0, 0.28].forEach(function (o) {
          tone(c, out, { t: T + o, type: 'sawtooth', f: 2400, f2: 180, d: 0.22, g: 0.35, a: 0.003, lp: 5000 })
          tone(c, out, { t: T + o, type: 'square', f: 1200, f2: 90, d: 0.22, g: 0.12, a: 0.003, lp: 3000 })
        })
      },
    },
    {
      name: 'Explosion', emoji: '💥', dur: 2.6,
      play: function (c, out, T) {
        noise(c, out, { t: T, d: 2.2, g: 1, type: 'lowpass', f: 3000, f2: 70, q: 0.7, a: 0.004 })
        noise(c, out, { t: T, d: 0.5, g: 0.5, f: 1200, q: 0.5, a: 0.002 })
        tone(c, out, { t: T, f: 90, f2: 28, d: 1.6, g: 1, a: 0.005 })
      },
    },
    {
      name: 'Coin', emoji: '🪙', dur: 1,
      play: function (c, out, T) {
        tone(c, out, { t: T, type: 'square', f: 988, d: 0.08, g: 0.25, a: 0.003, sustain: true, r: 0.01 })
        tone(c, out, { t: T + 0.08, type: 'square', f: 1319, d: 0.7, g: 0.25, a: 0.003 })
      },
    },
    {
      name: 'Power-Up', emoji: '🍄', dur: 1.3,
      play: function (c, out, T) {
        ;[262, 330, 392, 523, 659, 784, 1047, 1319].forEach(function (f, i) {
          tone(c, out, { t: T + i * 0.07, type: 'square', f: f, d: i === 7 ? 0.5 : 0.09, g: 0.22, a: 0.003, sustain: true, r: 0.02 })
        })
      },
    },
    {
      name: 'Game Over', emoji: '🎮', dur: 2.8,
      play: function (c, out, T) {
        ;[[392, 0], [330, 0.25], [262, 0.5]].forEach(function (n) {
          tone(c, out, { t: T + n[1], type: 'square', f: n[0], d: 0.23, g: 0.25, a: 0.005, sustain: true, r: 0.03, lp: 2500 })
        })
        tone(c, out, { t: T + 0.8, type: 'square', f: 196, f2: 110, d: 1.5, g: 0.28, a: 0.01, sustain: true, r: 0.2, lp: 2500 })
      },
    },
    {
      name: 'Whoosh', emoji: '💨', dur: 1.2,
      play: function (c, out, T) {
        noise(c, out, { t: T, d: 1, g: 0.9, f: 300, f2: 4000, back: true, q: 1.2, a: 0.4 })
      },
    },
    {
      name: 'Crickets', emoji: '🦗', dur: 3.6,
      play: function (c, out, T) {
        for (var g = 0; g < 6; g++) {
          ;[[4400, 0], [4800, 0.2]].forEach(function (cr) {
            for (var p = 0; p < 3; p++) {
              tone(c, out, { t: T + g * 0.6 + cr[1] + p * 0.075, f: cr[0], d: 0.05, g: 0.12, a: 0.006 })
            }
          })
        }
      },
    },
    {
      name: 'Siren', emoji: '🚨', dur: 3.2,
      play: function (c, out, T) {
        var n = 300
        var curve = []
        for (var i = 0; i < n; i++) {
          curve.push(850 + 350 * Math.sin(2 * Math.PI * 2.5 * (i / n) - Math.PI / 2))
        }
        curveTone(c, out, { t: T, d: 3, curve: curve, type: 'sawtooth', g: 0.25, a: 0.05, sustain: true, lp: 2200 })
      },
    },
    {
      name: 'Camera', emoji: '📸', dur: 0.6,
      play: function (c, out, T) {
        noise(c, out, { t: T, d: 0.03, g: 0.7, type: 'highpass', f: 2500, q: 0.7, a: 0.001 })
        tone(c, out, { t: T, f: 1800, f2: 900, d: 0.03, g: 0.3, a: 0.001 })
        noise(c, out, { t: T + 0.09, d: 0.06, g: 0.6, f: 1100, q: 0.9, a: 0.001 })
        tone(c, out, { t: T + 0.09, f: 700, f2: 300, d: 0.05, g: 0.3, a: 0.001 })
      },
    },
  ]

  // Loudness leveling so every button feels about equally loud.
  var LEVEL = [1.2, 0.75, 1.2, 0.7, 0.65, 1.4, 3.2, 1, 1.4, 1.3, 1, 2.2, 0.55, 3, 2.6, 2.2, 1.3, 5, 2.6, 1.1]
  SOUNDS.forEach(function (s, i) { s.level = LEVEL[i] })

  window.SOUNDS = SOUNDS
})()
