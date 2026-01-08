---
name: tween-animation
description: Animation and tweening with GSAP (GreenSock). Use when creating smooth UI animations, score counters, fade effects, sequenced animations, or any property interpolation in games and web apps. Covers DOM, Canvas, and Three.js integration.
---

# Tween Animation with GSAP

## CDN Setup

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
```

ES Module:
```javascript
import gsap from 'https://unpkg.com/gsap@3.12.5/dist/gsap.min.js';
```

## Basic Tweens

### To (Animate to Target)
```javascript
gsap.to('.box', {
  x: 100,
  y: 50,
  rotation: 360,
  duration: 1,
  ease: 'power2.out'
});
```

### From (Animate from Start)
```javascript
gsap.from('.box', {
  opacity: 0,
  y: -50,
  duration: 0.5
});
```

### FromTo (Explicit Start & End)
```javascript
gsap.fromTo('.box',
  { opacity: 0, scale: 0 },
  { opacity: 1, scale: 1, duration: 0.5 }
);
```

### Set (Instant, No Animation)
```javascript
gsap.set('.box', { x: 100, opacity: 0.5 });
```

## Transform Shortcuts

| GSAP | CSS Equivalent |
|------|----------------|
| `x: 100` | `translateX(100px)` |
| `y: 100` | `translateY(100px)` |
| `rotation: 360` | `rotate(360deg)` |
| `scale: 2` | `scale(2)` |
| `scaleX: 1.5` | `scaleX(1.5)` |

## Easing

```javascript
// Built-in eases
gsap.to('.box', { x: 100, ease: 'power1.out' });  // Gentle
gsap.to('.box', { x: 100, ease: 'power4.out' });  // Strong
gsap.to('.box', { x: 100, ease: 'elastic.out' }); // Bounce
gsap.to('.box', { x: 100, ease: 'back.out' });    // Overshoot
gsap.to('.box', { x: 100, ease: 'bounce.out' });  // Bouncy

// Directions: .in, .out, .inOut
ease: 'power2.in'    // Start slow
ease: 'power2.out'   // End slow
ease: 'power2.inOut' // Both
```

## Timelines (Sequencing)

```javascript
const tl = gsap.timeline();

tl.to('.box1', { x: 100, duration: 0.5 })
  .to('.box2', { y: 100, duration: 0.5 })     // After box1
  .to('.box3', { opacity: 0, duration: 0.3 }) // After box2
;
```

### Position Parameter
```javascript
tl.to('.a', { x: 100 })
  .to('.b', { y: 100 }, '<')        // Same time as previous
  .to('.c', { opacity: 0 }, '<0.2') // 0.2s after previous start
  .to('.d', { scale: 2 }, '+=0.5')  // 0.5s after previous end
  .to('.e', { rotation: 360 }, 2)   // At absolute 2s
;
```

### Timeline Controls
```javascript
const tl = gsap.timeline({ paused: true });
tl.to('.box', { x: 100 });

tl.play();
tl.pause();
tl.reverse();
tl.restart();
tl.progress(0.5);  // Jump to 50%
tl.timeScale(2);   // 2x speed
```

## Callbacks

```javascript
gsap.to('.box', {
  x: 100,
  duration: 1,
  onStart: () => console.log('Started'),
  onUpdate: () => console.log('Updating'),
  onComplete: () => console.log('Done'),
  onRepeat: () => console.log('Repeating')
});
```

## Looping & Yoyo

```javascript
gsap.to('.box', {
  y: 100,
  duration: 1,
  repeat: -1,      // Infinite
  yoyo: true,      // Go back and forth
  repeatDelay: 0.5 // Wait between repeats
});
```

## Stagger (Multiple Elements)

```javascript
gsap.to('.card', {
  y: 50,
  opacity: 1,
  duration: 0.5,
  stagger: 0.1  // 0.1s between each
});

// Advanced stagger
gsap.to('.grid-item', {
  scale: 1,
  stagger: {
    each: 0.1,
    from: 'center',  // 'start', 'end', 'center', 'edges'
    grid: [4, 4]     // For grid layouts
  }
});
```

## Game UI Patterns

### Score Counter
```javascript
const score = { value: 0 };

gsap.to(score, {
  value: 1000,
  duration: 1,
  ease: 'power1.out',
  onUpdate: () => {
    document.getElementById('score').textContent = Math.floor(score.value);
  }
});
```

### Health Bar
```javascript
function updateHealth(current, max) {
  gsap.to('#health-fill', {
    width: `${(current / max) * 100}%`,
    duration: 0.3,
    ease: 'power2.out'
  });
}
```

### Hit Flash
```javascript
function flashRed(element) {
  gsap.to(element, {
    filter: 'brightness(2) saturate(2)',
    duration: 0.1,
    yoyo: true,
    repeat: 1
  });
}
```

### Screen Shake
```javascript
function screenShake(intensity = 10) {
  gsap.to('#game-container', {
    x: `random(-${intensity}, ${intensity})`,
    y: `random(-${intensity}, ${intensity})`,
    duration: 0.05,
    repeat: 5,
    yoyo: true,
    onComplete: () => gsap.set('#game-container', { x: 0, y: 0 })
  });
}
```

### Popup Animation
```javascript
function showPopup(el) {
  gsap.fromTo(el,
    { scale: 0, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
  );
}

function hidePopup(el) {
  gsap.to(el, {
    scale: 0.8, opacity: 0, duration: 0.2,
    onComplete: () => el.style.display = 'none'
  });
}
```

## Animating Any Object

```javascript
// Works with any JS object
const gameObject = { x: 0, y: 0, hp: 100 };

gsap.to(gameObject, {
  x: 500,
  y: 300,
  duration: 2,
  onUpdate: () => {
    // Update canvas or game state
    drawObject(gameObject.x, gameObject.y);
  }
});
```

## Canvas Animation

```javascript
const ball = { x: 50, y: 50, radius: 20 };

gsap.to(ball, {
  x: 400,
  duration: 1,
  ease: 'bounce.out'
});

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  requestAnimationFrame(render);
}
render();
```

## Three.js Integration

```javascript
import * as THREE from 'three';

const mesh = new THREE.Mesh(geometry, material);

// Position
gsap.to(mesh.position, { x: 5, y: 2, duration: 1 });

// Rotation
gsap.to(mesh.rotation, { y: Math.PI * 2, duration: 2, repeat: -1, ease: 'none' });

// Scale
gsap.to(mesh.scale, { x: 2, y: 2, z: 2, duration: 0.5 });

// Material
gsap.to(mesh.material, { opacity: 0, duration: 1 });
gsap.to(mesh.material.color, { r: 1, g: 0, b: 0, duration: 0.5 });
```

## Killing/Overwriting Tweens

```javascript
// Kill all tweens on target
gsap.killTweensOf('.box');

// Kill specific properties
gsap.killTweensOf('.box', 'x,y');

// Auto-overwrite (default behavior)
gsap.to('.box', { x: 100 });
gsap.to('.box', { x: 200 }); // Kills previous x tween
```

## Common Mistakes

| Wrong | Correct |
|-------|---------|
| `rotation: '360deg'` | `rotation: 360` (degrees by default) |
| Creating tweens in game loop | Create once, control with `.play()` |
| Not using `ease` | Always specify appropriate easing |
| Animating layout properties | Use transforms (x, y) for performance |
