---
name: game-audio
description: Game audio implementation with Howler.js. Use when creating games that need sound effects, background music, 3D positional audio, or audio sprites. Covers CDN setup, common patterns for game sounds, and mobile audio handling.
---

# Game Audio with Howler.js

## CDN Setup

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.4/howler.min.js"></script>
```

ES Module:
```javascript
import { Howl, Howler } from 'https://unpkg.com/howler@2.2.4/dist/howler.esm.js';
```

## Basic Usage

### Sound Effect
```javascript
const sfx = new Howl({
  src: ['shoot.webm', 'shoot.mp3'],
  volume: 0.5
});
sfx.play();
```

### Background Music
```javascript
const bgm = new Howl({
  src: ['music.webm', 'music.mp3'],
  loop: true,
  volume: 0.3
});
bgm.play();
```

## Audio Sprites (Multiple SFX in One File)

```javascript
const sounds = new Howl({
  src: ['sprites.webm', 'sprites.mp3'],
  sprite: {
    jump: [0, 500],      // start: 0ms, duration: 500ms
    coin: [600, 300],
    hit: [1000, 400],
    gameover: [1500, 2000]
  }
});

sounds.play('jump');
sounds.play('coin');
```

## Game Audio Manager Pattern

```javascript
class AudioManager {
  constructor() {
    this.sfx = {};
    this.bgm = null;
    this.muted = false;
  }

  loadSFX(name, src) {
    this.sfx[name] = new Howl({ src, volume: 0.5 });
  }

  playSFX(name) {
    if (!this.muted && this.sfx[name]) {
      this.sfx[name].play();
    }
  }

  playBGM(src, volume = 0.3) {
    if (this.bgm) this.bgm.stop();
    this.bgm = new Howl({ src, loop: true, volume });
    if (!this.muted) this.bgm.play();
  }

  toggleMute() {
    this.muted = !this.muted;
    Howler.mute(this.muted);
    return this.muted;
  }

  setVolume(vol) {
    Howler.volume(vol);
  }
}

const audio = new AudioManager();
audio.loadSFX('jump', ['jump.webm', 'jump.mp3']);
audio.playSFX('jump');
```

## 3D Positional Audio

```javascript
const enemy = new Howl({
  src: ['enemy.webm', 'enemy.mp3'],
  loop: true
});

const id = enemy.play();

// Set listener position (player)
Howler.pos(playerX, playerY, playerZ);

// Set sound position
enemy.pos(enemyX, enemyY, enemyZ, id);
```

## Mobile Audio Unlock

Mobile browsers require user interaction before playing audio:

```javascript
function unlockAudio() {
  const silent = new Howl({
    src: ['data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////'],
    volume: 0,
    onend: () => silent.unload()
  });
  silent.play();
  document.removeEventListener('touchstart', unlockAudio);
  document.removeEventListener('click', unlockAudio);
}

document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('click', unlockAudio, { once: true });
```

## Fade Effects

```javascript
// Fade in BGM
bgm.fade(0, 0.5, 2000);

// Fade out and stop
bgm.fade(0.5, 0, 1000);
bgm.once('fade', () => bgm.stop());
```

## Common Patterns

### Play with Pitch Variation
```javascript
function playWithVariation(sound) {
  const id = sound.play();
  sound.rate(0.9 + Math.random() * 0.2, id); // 0.9-1.1
}
```

### Pool for Rapid Sounds
```javascript
const pool = Array.from({ length: 5 }, () => 
  new Howl({ src: ['rapid.webm', 'rapid.mp3'] })
);
let poolIndex = 0;

function playPooled() {
  pool[poolIndex].play();
  poolIndex = (poolIndex + 1) % pool.length;
}
```

## File Format Priority

Use WebM/Opus first, MP3 fallback:
```javascript
src: ['sound.webm', 'sound.mp3']
```

- WebM/Opus: Smaller, better quality
- MP3: Universal fallback

## Common Mistakes

| Wrong | Correct |
|-------|---------|
| `new Howl('file.mp3')` | `new Howl({ src: ['file.mp3'] })` |
| Playing without user interaction on mobile | Use unlock pattern |
| Creating new Howl on every play | Reuse Howl instances |
| Using only one format | Provide webm + mp3 fallback |
