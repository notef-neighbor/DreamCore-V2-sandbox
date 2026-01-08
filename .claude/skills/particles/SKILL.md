---
name: particles
description: Particle effects with tsParticles. Use when creating visual effects like explosions, confetti, fireworks, snow, fire, sparkles, or background particles in games and web apps. Supports presets and custom configurations.
---

# Particles with tsParticles

## CDN Setup

```html
<script src="https://cdn.jsdelivr.net/npm/tsparticles@2.12.0/tsparticles.bundle.min.js"></script>
```

ES Module:
```javascript
import { tsParticles } from 'https://cdn.jsdelivr.net/npm/tsparticles-engine@2.12.0/+esm';
import { loadFull } from 'https://cdn.jsdelivr.net/npm/tsparticles@2.12.0/+esm';
await loadFull(tsParticles);
```

## Basic Setup

```html
<div id="particles"></div>

<script>
tsParticles.load('particles', {
  particles: {
    number: { value: 80 },
    color: { value: '#ffffff' },
    size: { value: 3 },
    move: { enable: true, speed: 2 }
  }
});
</script>
```

## Common Presets

### Confetti
```javascript
tsParticles.load('confetti', {
  particles: {
    number: { value: 0 },
    color: { value: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'] },
    shape: { type: ['circle', 'square'] },
    size: { value: { min: 5, max: 10 } },
    move: {
      enable: true,
      speed: 10,
      direction: 'bottom',
      gravity: { enable: true, acceleration: 5 }
    },
    rotate: { value: { min: 0, max: 360 }, animation: { enable: true, speed: 30 } },
    tilt: { enable: true, value: { min: 0, max: 360 } },
    wobble: { enable: true, distance: 30 },
    life: { duration: { value: 3 }, count: 1 }
  },
  emitters: {
    position: { x: 50, y: 0 },
    rate: { quantity: 10, delay: 0.1 },
    size: { width: 100, height: 0 }
  }
});
```

### Fireworks
```javascript
tsParticles.load('fireworks', {
  particles: {
    number: { value: 0 },
    color: { value: ['#ff0000', '#ffff00', '#00ff00', '#00ffff'] },
    size: { value: 3 },
    move: { enable: true, speed: 15, gravity: { enable: true } },
    life: { duration: { value: 2 }, count: 1 }
  },
  emitters: {
    direction: 'top',
    rate: { quantity: 1, delay: 0.5 },
    position: { x: 50, y: 100 },
    size: { width: 0, height: 0 }
  }
});
```

### Snow
```javascript
tsParticles.load('snow', {
  particles: {
    number: { value: 100 },
    color: { value: '#ffffff' },
    shape: { type: 'circle' },
    size: { value: { min: 1, max: 5 } },
    move: {
      enable: true,
      speed: 1,
      direction: 'bottom',
      straight: false
    },
    wobble: { enable: true, distance: 10, speed: 10 },
    opacity: { value: { min: 0.3, max: 0.8 } }
  }
});
```

### Fire/Sparks
```javascript
tsParticles.load('fire', {
  particles: {
    number: { value: 0 },
    color: { value: ['#ff4500', '#ff6600', '#ff8800', '#ffaa00'] },
    size: { value: { min: 2, max: 6 } },
    move: {
      enable: true,
      speed: { min: 5, max: 15 },
      direction: 'top',
      outModes: 'destroy'
    },
    opacity: {
      value: 1,
      animation: { enable: true, speed: 1, minimumValue: 0, destroy: 'min' }
    },
    life: { duration: { value: 1 }, count: 1 }
  },
  emitters: {
    position: { x: 50, y: 100 },
    rate: { quantity: 5, delay: 0.05 },
    size: { width: 20, height: 0 }
  }
});
```

### Stars Background
```javascript
tsParticles.load('stars', {
  particles: {
    number: { value: 200 },
    color: { value: '#ffffff' },
    size: { value: { min: 0.5, max: 2 } },
    move: { enable: false },
    opacity: {
      value: { min: 0.1, max: 1 },
      animation: { enable: true, speed: 0.5, minimumValue: 0.1 }
    }
  }
});
```

## Explosion Effect

```javascript
async function explode(x, y, color = '#ff0000') {
  const container = await tsParticles.load('explosion-' + Date.now(), {
    fullScreen: false,
    particles: {
      number: { value: 30 },
      color: { value: color },
      size: { value: { min: 2, max: 5 } },
      move: {
        enable: true,
        speed: { min: 5, max: 20 },
        direction: 'none',
        outModes: 'destroy'
      },
      opacity: {
        value: 1,
        animation: { enable: true, speed: 2, minimumValue: 0 }
      },
      life: { duration: { value: 0.5 }, count: 1 }
    },
    emitters: {
      position: { x: (x / window.innerWidth) * 100, y: (y / window.innerHeight) * 100 },
      rate: { quantity: 30, delay: 0 },
      life: { count: 1, duration: 0.1 }
    }
  });
  
  // Auto-destroy after animation
  setTimeout(() => container.destroy(), 2000);
}

// Usage
element.addEventListener('click', (e) => explode(e.clientX, e.clientY, '#ffff00'));
```

## Game Integration

### Background Layer (Behind Game)
```html
<style>
  #particles { position: fixed; top: 0; left: 0; z-index: -1; }
  #game { position: relative; z-index: 1; }
</style>

<div id="particles"></div>
<div id="game">...</div>
```

### Foreground Effects (Above Game)
```html
<style>
  #effects { position: fixed; top: 0; left: 0; z-index: 100; pointer-events: none; }
</style>

<div id="game">...</div>
<div id="effects"></div>
```

## Dynamic Control

```javascript
// Get container
const container = tsParticles.domItem(0);

// Pause/Resume
container.pause();
container.play();

// Add particles at position
container.addParticle({ x: 100, y: 100 });

// Update options
container.options.particles.color.value = '#00ff00';
container.refresh();

// Destroy
container.destroy();
```

## Canvas Integration

```javascript
// Use with existing canvas
tsParticles.load('particles', {
  fullScreen: { enable: false },
  // ... options
});

// Position container
const particleDiv = document.getElementById('particles');
particleDiv.style.position = 'absolute';
particleDiv.style.left = '100px';
particleDiv.style.top = '100px';
particleDiv.style.width = '200px';
particleDiv.style.height = '200px';
```

## Interactivity

```javascript
tsParticles.load('interactive', {
  particles: { /* ... */ },
  interactivity: {
    events: {
      onHover: { enable: true, mode: 'repulse' },
      onClick: { enable: true, mode: 'push' }
    },
    modes: {
      repulse: { distance: 100, duration: 0.4 },
      push: { quantity: 4 }
    }
  }
});
```

## Performance Tips

```javascript
{
  particles: {
    number: { value: 50 },  // Keep low for mobile
  },
  detectRetina: true,        // Adjust for high-DPI
  fpsLimit: 60,              // Match game FPS
  fullScreen: { enable: false }  // For contained effects
}
```

## Common Mistakes

| Wrong | Correct |
|-------|---------|
| Not awaiting `tsParticles.load()` | Use `await` or `.then()` |
| Too many particles | Keep < 100 for mobile |
| Forgetting `pointer-events: none` | Add for overlay effects |
| Not destroying old containers | Call `.destroy()` when done |
| Using fullScreen for game effects | Set `fullScreen: { enable: false }` |
