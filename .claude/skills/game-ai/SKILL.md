---
name: game-ai
description: Game AI implementation with Yuka.js. Use when creating games that need enemy AI, pathfinding, steering behaviors (chase/flee/wander), state machines, or navigation meshes. Works standalone or with Three.js.
---

# Game AI with Yuka

## CDN Setup

```html
<script type="importmap">
{
  "imports": {
    "yuka": "https://unpkg.com/yuka@0.7.8/build/yuka.module.js"
  }
}
</script>
<script type="module">
import * as YUKA from 'yuka';
</script>
```

## Core Concepts

### Entity Manager (Game Loop)

```javascript
import { EntityManager, Time } from 'yuka';

const entityManager = new EntityManager();
const time = new Time();

function update() {
  const delta = time.update().getDelta();
  entityManager.update(delta);
  requestAnimationFrame(update);
}
update();
```

### Vehicle (Moving Entity)

```javascript
import { Vehicle, Vector3 } from 'yuka';

const enemy = new Vehicle();
enemy.position.set(0, 0, 0);
enemy.maxSpeed = 5;
entityManager.add(enemy);
```

## Steering Behaviors

### Seek (Chase Target)

```javascript
import { SeekBehavior } from 'yuka';

const seekBehavior = new SeekBehavior(targetPosition);
enemy.steering.add(seekBehavior);

// Update target dynamically
function update() {
  seekBehavior.target = player.position;
}
```

### Flee (Run Away)

```javascript
import { FleeBehavior } from 'yuka';

const fleeBehavior = new FleeBehavior(player.position, 10); // panic distance
enemy.steering.add(fleeBehavior);
```

### Pursue (Predict & Chase)

```javascript
import { PursuitBehavior } from 'yuka';

const pursuit = new PursuitBehavior(playerVehicle);
enemy.steering.add(pursuit);
```

### Wander (Random Movement)

```javascript
import { WanderBehavior } from 'yuka';

const wander = new WanderBehavior();
wander.radius = 2;
wander.distance = 5;
wander.jitter = 100;
enemy.steering.add(wander);
```

### Obstacle Avoidance

```javascript
import { ObstacleAvoidanceBehavior } from 'yuka';

const avoidance = new ObstacleAvoidanceBehavior(obstacles);
enemy.steering.add(avoidance);
```

### Combining Behaviors

```javascript
// Weight-based priority
const seek = new SeekBehavior(target);
const avoid = new ObstacleAvoidanceBehavior(obstacles);

seek.weight = 0.5;
avoid.weight = 1.0;  // Higher = more priority

enemy.steering.add(seek);
enemy.steering.add(avoid);
```

## State Machine

```javascript
import { StateMachine, State } from 'yuka';

class PatrolState extends State {
  enter(entity) {
    entity.steering.clear();
    entity.steering.add(new WanderBehavior());
  }
  
  execute(entity) {
    if (entity.canSeePlayer()) {
      entity.stateMachine.changeTo('chase');
    }
  }
}

class ChaseState extends State {
  enter(entity) {
    entity.steering.clear();
    entity.steering.add(new SeekBehavior(player.position));
  }
  
  execute(entity) {
    if (!entity.canSeePlayer()) {
      entity.stateMachine.changeTo('patrol');
    }
  }
}

// Setup
const stateMachine = new StateMachine(enemy);
stateMachine.add('patrol', new PatrolState());
stateMachine.add('chase', new ChaseState());
stateMachine.changeTo('patrol');

enemy.stateMachine = stateMachine;
```

## Pathfinding with NavMesh

```javascript
import { NavMesh, NavMeshLoader } from 'yuka';

// Load NavMesh (glTF format)
const loader = new NavMeshLoader();
const navMesh = await loader.load('navmesh.glb');

// Find path
const from = new Vector3(0, 0, 0);
const to = new Vector3(10, 0, 10);
const path = navMesh.findPath(from, to);

// Follow path
import { FollowPathBehavior } from 'yuka';
const followPath = new FollowPathBehavior(path);
enemy.steering.add(followPath);
```

## Grid-based Pathfinding (A*)

```javascript
import { Graph, AStar } from 'yuka';

// Create grid graph
const graph = new Graph();
const width = 10, height = 10;

// Add nodes
for (let x = 0; x < width; x++) {
  for (let y = 0; y < height; y++) {
    graph.addNode({ index: y * width + x, x, y });
  }
}

// Add edges (4-directional)
for (let x = 0; x < width; x++) {
  for (let y = 0; y < height; y++) {
    const i = y * width + x;
    if (x > 0) graph.addEdge({ from: i, to: i - 1, cost: 1 });
    if (x < width - 1) graph.addEdge({ from: i, to: i + 1, cost: 1 });
    if (y > 0) graph.addEdge({ from: i, to: i - width, cost: 1 });
    if (y < height - 1) graph.addEdge({ from: i, to: i + width, cost: 1 });
  }
}

// Find path
const astar = new AStar(graph, startIdx, endIdx);
astar.search();
const path = astar.getPath();
```

## Vision & Memory

```javascript
import { Vision, MemorySystem } from 'yuka';

// Vision cone
enemy.vision = new Vision(enemy);
enemy.vision.range = 10;
enemy.vision.fieldOfView = Math.PI * 0.5; // 90 degrees

// Memory
enemy.memorySystem = new MemorySystem(enemy);
enemy.memorySystem.memorySpan = 5; // Remember for 5 seconds

// Check visibility
if (enemy.vision.visible(player.position)) {
  enemy.memorySystem.record(player);
}

// Get last known position
const record = enemy.memorySystem.getRecord(player);
if (record) {
  const lastSeen = record.position;
}
```

## Integration with Three.js

```javascript
import * as THREE from 'three';
import * as YUKA from 'yuka';

// Sync helper
function sync(entity, renderComponent) {
  renderComponent.matrix.copy(entity.worldMatrix);
}

// Create enemy
const enemy = new YUKA.Vehicle();
const mesh = new THREE.Mesh(geometry, material);
mesh.matrixAutoUpdate = false;
enemy.setRenderComponent(mesh, sync);

entityManager.add(enemy);
scene.add(mesh);
```

## Common Patterns

### Enemy with Multiple States
```javascript
class Enemy extends Vehicle {
  constructor() {
    super();
    this.health = 100;
    this.stateMachine = new StateMachine(this);
    this.stateMachine.add('idle', new IdleState());
    this.stateMachine.add('patrol', new PatrolState());
    this.stateMachine.add('chase', new ChaseState());
    this.stateMachine.add('attack', new AttackState());
    this.stateMachine.add('flee', new FleeState());
    this.stateMachine.changeTo('idle');
  }
}
```

### Distance Check
```javascript
const distance = enemy.position.distanceTo(player.position);
if (distance < attackRange) {
  // Attack
} else if (distance < detectionRange) {
  // Chase
}
```

## Common Mistakes

| Wrong | Correct |
|-------|---------|
| Forgetting to call `entityManager.update(delta)` | Always update in game loop |
| Not setting `maxSpeed` | Set `vehicle.maxSpeed` for movement |
| Directly modifying `position` | Use steering behaviors |
| Creating new behaviors every frame | Reuse and update existing behaviors |
