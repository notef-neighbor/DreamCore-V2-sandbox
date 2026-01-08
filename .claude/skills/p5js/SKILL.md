---
name: p5js
description: 2D game and creative coding with P5.js. Use when creating 2D games, interactive visualizations, or creative coding projects. Covers game loop, input handling, collision detection, sprites, and common game patterns.
---

# P5.js for 2D Games

## CDN Setup

```html
<script src="https://cdn.jsdelivr.net/npm/p5@1.11.0/lib/p5.min.js"></script>
```

With Sound:
```html
<script src="https://cdn.jsdelivr.net/npm/p5@1.11.0/lib/p5.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/p5@1.11.0/lib/addons/p5.sound.min.js"></script>
```

## Basic Structure

```javascript
function setup() {
  createCanvas(800, 600);
}

function draw() {
  background(220);
  // Game logic here (runs 60 FPS)
}
```

### Instance Mode (Recommended for Games)
```javascript
const game = (p) => {
  let player;

  p.setup = () => {
    p.createCanvas(800, 600);
    player = { x: 400, y: 300 };
  };

  p.draw = () => {
    p.background(0);
    p.ellipse(player.x, player.y, 50, 50);
  };
};

new p5(game);
```

## Input Handling

### Keyboard (Continuous)
```javascript
function draw() {
  if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) player.x -= 5;  // A key
  if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) player.x += 5; // D key
  if (keyIsDown(UP_ARROW) || keyIsDown(87)) player.y -= 5;    // W key
  if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) player.y += 5;  // S key
}
```

### Keyboard (Single Press)
```javascript
function keyPressed() {
  if (key === ' ') shoot();
  if (keyCode === ENTER) startGame();
  if (keyCode === ESCAPE) pauseGame();
  return false; // Prevent default
}

function keyReleased() {
  if (key === ' ') stopShooting();
}
```

### Mouse
```javascript
function draw() {
  // Mouse position
  let mx = mouseX;
  let my = mouseY;
  
  // Mouse pressed state
  if (mouseIsPressed) {
    // Dragging
  }
}

function mousePressed() {
  if (mouseButton === LEFT) shoot();
  if (mouseButton === RIGHT) specialMove();
}

function mouseReleased() { }
function mouseClicked() { }
function mouseMoved() { }
function mouseDragged() { }
function mouseWheel(event) {
  zoom += event.delta * 0.01;
}
```

### Touch (Mobile)
```javascript
function touchStarted() {
  for (let touch of touches) {
    handleTouch(touch.x, touch.y);
  }
  return false; // Prevent scrolling
}

function touchMoved() {
  return false;
}

function touchEnded() { }
```

## Collision Detection

### Circle-Circle
```javascript
function circlesCollide(x1, y1, r1, x2, y2, r2) {
  return dist(x1, y1, x2, y2) < r1 + r2;
}
```

### Rectangle-Rectangle (AABB)
```javascript
function rectsCollide(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 &&
         x1 + w1 > x2 &&
         y1 < y2 + h2 &&
         y1 + h1 > y2;
}
```

### Point-Rectangle
```javascript
function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw &&
         py >= ry && py <= ry + rh;
}
```

### Circle-Rectangle
```javascript
function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
  let nearestX = constrain(cx, rx, rx + rw);
  let nearestY = constrain(cy, ry, ry + rh);
  return dist(cx, cy, nearestX, nearestY) < r;
}
```

## Game Object Pattern

```javascript
class GameObject {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.active = true;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }

  draw() { }
  
  offscreen() {
    return this.x < 0 || this.x > width || this.y < 0 || this.y > height;
  }
}

class Player extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.size = 40;
    this.speed = 5;
  }

  update() {
    if (keyIsDown(LEFT_ARROW)) this.vx = -this.speed;
    else if (keyIsDown(RIGHT_ARROW)) this.vx = this.speed;
    else this.vx = 0;
    
    super.update();
    this.x = constrain(this.x, 0, width);
  }

  draw() {
    fill(0, 255, 0);
    rectMode(CENTER);
    rect(this.x, this.y, this.size, this.size);
  }
}

class Bullet extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.vy = -10;
    this.size = 5;
  }

  draw() {
    fill(255, 255, 0);
    ellipse(this.x, this.y, this.size);
  }
}

class Enemy extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.vy = 2;
    this.size = 30;
  }

  draw() {
    fill(255, 0, 0);
    ellipse(this.x, this.y, this.size);
  }
}
```

## Game Manager

```javascript
let player;
let bullets = [];
let enemies = [];
let score = 0;
let gameState = 'title'; // 'title', 'playing', 'gameover'

function setup() {
  createCanvas(800, 600);
  player = new Player(width / 2, height - 50);
}

function draw() {
  background(0);
  
  switch (gameState) {
    case 'title':
      drawTitle();
      break;
    case 'playing':
      updateGame();
      drawGame();
      break;
    case 'gameover':
      drawGameOver();
      break;
  }
}

function updateGame() {
  player.update();
  
  // Update bullets
  for (let b of bullets) {
    b.update();
    if (b.offscreen()) b.active = false;
  }
  bullets = bullets.filter(b => b.active);
  
  // Update enemies
  for (let e of enemies) {
    e.update();
    if (e.y > height) e.active = false;
  }
  enemies = enemies.filter(e => e.active);
  
  // Spawn enemies
  if (frameCount % 60 === 0) {
    enemies.push(new Enemy(random(width), 0));
  }
  
  // Check collisions
  checkCollisions();
}

function checkCollisions() {
  for (let e of enemies) {
    for (let b of bullets) {
      if (circlesCollide(e.x, e.y, e.size/2, b.x, b.y, b.size/2)) {
        e.active = false;
        b.active = false;
        score += 10;
      }
    }
    
    if (circlesCollide(e.x, e.y, e.size/2, player.x, player.y, player.size/2)) {
      gameState = 'gameover';
    }
  }
}

function drawGame() {
  player.draw();
  for (let b of bullets) b.draw();
  for (let e of enemies) e.draw();
  
  // HUD
  fill(255);
  textSize(24);
  text('Score: ' + score, 10, 30);
}

function drawTitle() {
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(48);
  text('SPACE SHOOTER', width/2, height/2 - 50);
  textSize(24);
  text('Press SPACE to start', width/2, height/2 + 50);
}

function drawGameOver() {
  fill(255, 0, 0);
  textAlign(CENTER, CENTER);
  textSize(48);
  text('GAME OVER', width/2, height/2 - 50);
  textSize(24);
  fill(255);
  text('Score: ' + score, width/2, height/2);
  text('Press SPACE to restart', width/2, height/2 + 50);
}

function keyPressed() {
  if (key === ' ') {
    if (gameState === 'title') {
      gameState = 'playing';
    } else if (gameState === 'playing') {
      bullets.push(new Bullet(player.x, player.y));
    } else if (gameState === 'gameover') {
      resetGame();
    }
  }
  return false;
}

function resetGame() {
  player = new Player(width / 2, height - 50);
  bullets = [];
  enemies = [];
  score = 0;
  gameState = 'playing';
}
```

## Sprites & Images

```javascript
let playerImg;

function preload() {
  playerImg = loadImage('player.png');
}

function draw() {
  imageMode(CENTER);
  image(playerImg, player.x, player.y, 50, 50);
}
```

### Sprite Animation
```javascript
class AnimatedSprite {
  constructor(spriteSheet, frameW, frameH, frames) {
    this.sheet = spriteSheet;
    this.frameW = frameW;
    this.frameH = frameH;
    this.frames = frames;
    this.currentFrame = 0;
    this.frameDelay = 5;
    this.frameCounter = 0;
  }

  update() {
    this.frameCounter++;
    if (this.frameCounter >= this.frameDelay) {
      this.currentFrame = (this.currentFrame + 1) % this.frames;
      this.frameCounter = 0;
    }
  }

  draw(x, y) {
    let sx = this.currentFrame * this.frameW;
    image(this.sheet, x, y, this.frameW, this.frameH, sx, 0, this.frameW, this.frameH);
  }
}
```

## Sound

```javascript
let shootSound, bgm;

function preload() {
  soundFormats('mp3', 'ogg');
  shootSound = loadSound('shoot');
  bgm = loadSound('music');
}

function setup() {
  createCanvas(800, 600);
  bgm.loop();
}

function shoot() {
  shootSound.play();
}
```

## Utilities

### Screen Bounds
```javascript
x = constrain(x, 0, width);
y = constrain(y, 0, height);
```

### Screen Wrap
```javascript
if (x > width) x = 0;
if (x < 0) x = width;
if (y > height) y = 0;
if (y < 0) y = height;
```

### Delta Time
```javascript
function draw() {
  let dt = deltaTime / 1000; // In seconds
  player.x += player.vx * dt * 60; // Framerate independent
}
```

### Random
```javascript
random(10);         // 0 to 10
random(5, 15);      // 5 to 15
random(['a','b']);  // Random from array
```

## Common Mistakes

| Wrong | Correct |
|-------|---------|
| `background()` in setup only | Call in `draw()` to clear each frame |
| Creating objects in `draw()` | Create in `setup()`, update in `draw()` |
| Not using `return false` in input | Prevents browser default behavior |
| Using `let` for globals in `draw()` | Declare globals outside functions |
| Forgetting `preload()` for assets | Load images/sounds in `preload()` |
