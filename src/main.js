import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  initAudio, unlockAudio,
  playToss, playBlockToss, playEat, playBounce, playThud, playHappy,
  playBlockHit, startMusic, setBlobHum, setBlobHumPitch, NOTE_HZ,
  playEvolve, playAttack, playFoeAttack, playVictory, playDefeat,
} from './audio.js';

// ---------- constants ----------
const FRUITS = {
  strawberry: { color: 0xff4d6d, scale: 0.45, emoji: '🍓' },
  blueberry:  { color: 0x4a6bff, scale: 0.38, emoji: '🫐' },
  orange:     { color: 0xff9a3c, scale: 0.5,  emoji: '🍊' },
  grape:      { color: 0x8e44ff, scale: 0.4,  emoji: '🍇' },
};
const BLOB_COLORS = [0xffd54a, 0xff5fa2, 0x6ee7b7, 0x7fb3ff, 0xc792ff, 0xffa07a];

// ---------- DOM ----------
const app = document.getElementById('app');
const snacksEl = document.getElementById('snacks');
const blocksEl = document.getElementById('blocks');
const helpEl = document.getElementById('help');
const startEl = document.getElementById('start');
const picker = document.getElementById('fruit-picker');

let selectedTool = 'strawberry';
picker.addEventListener('click', (e) => {
  const btn = e.target.closest('.fruit-btn');
  if (!btn) return;
  selectedTool = btn.dataset.fruit;
  picker.querySelectorAll('.fruit-btn').forEach(b => b.classList.toggle('selected', b === btn));
});

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x9be7ff);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9be7ff, 30, 80);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 9, 16);
camera.lookAt(0, 1, 0);

// ---------- lighting ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0xb0e0ff, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4d6, 1.2);
sun.position.set(10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 60;
scene.add(sun);

// ---------- physics ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

const groundMat = new CANNON.Material('ground');
const fruitMat = new CANNON.Material('fruit');
const blockMat = new CANNON.Material('block');
const blobMat = new CANNON.Material('blob');

world.addContactMaterial(new CANNON.ContactMaterial(groundMat, fruitMat, { friction: 0.4, restitution: 0.55 }));
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, blockMat, { friction: 0.6, restitution: 0.05 }));
world.addContactMaterial(new CANNON.ContactMaterial(blockMat, blockMat,   { friction: 0.6, restitution: 0.05 }));
world.addContactMaterial(new CANNON.ContactMaterial(fruitMat, blockMat,   { friction: 0.4, restitution: 0.4 }));
world.addContactMaterial(new CANNON.ContactMaterial(blobMat, groundMat,   { friction: 0.3, restitution: 0.2 }));
world.addContactMaterial(new CANNON.ContactMaterial(blobMat, blockMat,    { friction: 0.3, restitution: 0.4 }));
world.addContactMaterial(new CANNON.ContactMaterial(blobMat, fruitMat,    { friction: 0.4, restitution: 0.2 }));

// ground
const groundBody = new CANNON.Body({ mass: 0, material: groundMat, shape: new CANNON.Plane() });
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

const groundGeo = new THREE.CircleGeometry(40, 64);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x7ed957, roughness: 0.95 });
const groundMesh = new THREE.Mesh(groundGeo, groundMaterial);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// decorative trees + flowers (groupable so they can hide during battle)
const playgroundDeco = new THREE.Group();
scene.add(playgroundDeco);
function addDeco() {
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    const r = 18 + Math.random() * 12;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.5, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 })
    );
    trunk.position.y = 1.2;
    trunk.castShadow = true;
    tree.add(trunk);
    const leafColors = [0x4ec96a, 0x6ed87f, 0x3aa856];
    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.6 + Math.random() * 0.4, 0),
      new THREE.MeshStandardMaterial({ color: leafColors[i % leafColors.length], roughness: 0.85, flatShading: true })
    );
    leaves.position.y = 3;
    leaves.castShadow = true;
    tree.add(leaves);
    tree.position.set(x, 0, z);
    playgroundDeco.add(tree);
  }
  // flowers
  const flowerColors = [0xff5fa2, 0xffd54a, 0xff9a3c, 0xc792ff, 0xffffff];
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 14;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const f = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.6 })
    );
    f.position.set(x, 0.18, z);
    playgroundDeco.add(f);
  }
  // clouds
  for (let i = 0; i < 6; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(1.2 + Math.random() * 0.6, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
      );
      puff.position.set(j * 1.3 - 2, Math.random() * 0.4, Math.random() * 0.6);
      cloud.add(puff);
    }
    cloud.position.set((Math.random() - 0.5) * 50, 14 + Math.random() * 6, (Math.random() - 0.5) * 50);
    playgroundDeco.add(cloud);
  }
}
addDeco();

// ---------- blob (the buddy) ----------
class Blob {
  constructor(color = 0xffd54a, position = new THREE.Vector3(0, 1.2, 0)) {
    this.color = color;
    this.targetColor = new THREE.Color(color);
    this.currentColor = new THREE.Color(color);
    this.happiness = 0;

    // visual
    this.group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    this.bodyMat = bodyMat;
    const bodyGeo = new THREE.SphereGeometry(1, 32, 24);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.castShadow = true;
    this.group.add(this.body);

    // eyes
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const eyeBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const eyeGeo = new THREE.SphereGeometry(0.22, 16, 12);
    const pupilGeo = new THREE.SphereGeometry(0.12, 12, 10);
    this.eyeL = new THREE.Mesh(eyeGeo, eyeWhite);
    this.eyeR = new THREE.Mesh(eyeGeo, eyeWhite);
    this.eyeL.position.set(-0.32, 0.35, 0.78);
    this.eyeR.position.set(0.32, 0.35, 0.78);
    this.pupilL = new THREE.Mesh(pupilGeo, eyeBlack);
    this.pupilR = new THREE.Mesh(pupilGeo, eyeBlack);
    this.pupilL.position.set(-0.32, 0.35, 0.92);
    this.pupilR.position.set(0.32, 0.35, 0.92);
    this.group.add(this.eyeL, this.eyeR, this.pupilL, this.pupilR);

    // mouth
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 16, Math.PI), mouthMat);
    this.mouth.position.set(0, 0.05, 0.92);
    this.mouth.rotation.z = Math.PI;
    this.group.add(this.mouth);

    // cheeks
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff8aa8, transparent: true, opacity: 0.55 });
    const cheekGeo = new THREE.CircleGeometry(0.18, 16);
    this.cheekL = new THREE.Mesh(cheekGeo, cheekMat);
    this.cheekR = new THREE.Mesh(cheekGeo, cheekMat);
    this.cheekL.position.set(-0.5, 0.05, 0.84);
    this.cheekR.position.set(0.5, 0.05, 0.84);
    this.cheekL.rotation.y = -0.3;
    this.cheekR.rotation.y = 0.3;
    this.group.add(this.cheekL, this.cheekR);

    // ---------- evolution accessories (all start hidden) ----------
    // Sprout (stage 1+): little leaf on top
    const sprout = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0x4ec96a })
    );
    stem.position.y = 0.11;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x6ed87f })
    );
    leaf.scale.set(1, 0.4, 1.7);
    leaf.position.set(0, 0.3, 0.1);
    leaf.rotation.z = 0.3;
    sprout.add(stem, leaf);
    sprout.position.set(0, 1.0, 0);
    this.sprout = sprout;
    this.group.add(sprout);

    // Horns (stage 2+)
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xfff5d0, roughness: 0.4 });
    const hornGeo = new THREE.ConeGeometry(0.1, 0.45, 8);
    this.hornL = new THREE.Mesh(hornGeo, hornMat);
    this.hornR = new THREE.Mesh(hornGeo, hornMat);
    this.hornL.position.set(-0.4, 0.85, 0.3);
    this.hornR.position.set(0.4, 0.85, 0.3);
    this.hornL.rotation.z = 0.35;
    this.hornR.rotation.z = -0.35;
    this.hornL.castShadow = true;
    this.hornR.castShadow = true;
    this.group.add(this.hornL, this.hornR);

    // Wings (stage 2+) — small petal-shaped fins on back
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xffd6e8, transparent: true, opacity: 0.9, roughness: 0.3 });
    const wingGeo = new THREE.SphereGeometry(0.4, 14, 10);
    this.wingL = new THREE.Mesh(wingGeo, wingMat);
    this.wingR = new THREE.Mesh(wingGeo, wingMat);
    this.wingL.scale.set(0.25, 1.1, 0.6);
    this.wingR.scale.set(0.25, 1.1, 0.6);
    this.wingL.position.set(-0.75, 0.4, -0.35);
    this.wingR.position.set(0.75, 0.4, -0.35);
    this.wingL.rotation.z = -0.4;
    this.wingR.rotation.z = 0.4;
    this.group.add(this.wingL, this.wingR);

    // Crown (stage 3+)
    const crown = new THREE.Group();
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.7, roughness: 0.25 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 10, 24), crownMat);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    crown.add(ring);
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 6), crownMat);
      const a = (i / 6) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.4, 0.12, Math.sin(a) * 0.4);
      spike.castShadow = true;
      crown.add(spike);
    }
    // gem on the front spike
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 0),
      new THREE.MeshStandardMaterial({ color: 0xff3366, emissive: 0xaa0044, emissiveIntensity: 0.5 })
    );
    gem.position.set(0, 0.08, 0.4);
    crown.add(gem);
    crown.position.set(0, 1.05, 0);
    this.crown = crown;
    this.group.add(crown);

    // Aura (stage 3+) — glowing sphere
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffffaa, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.aura = new THREE.Mesh(new THREE.SphereGeometry(1.45, 24, 16), auraMat);
    this.group.add(this.aura);

    // Mega tier: second pair of horns (stage 4+)
    const horn2Geo = new THREE.ConeGeometry(0.08, 0.35, 6);
    this.horn2L = new THREE.Mesh(horn2Geo, hornMat);
    this.horn2R = new THREE.Mesh(horn2Geo, hornMat);
    this.horn2L.position.set(-0.22, 1.18, 0.25);
    this.horn2R.position.set(0.22, 1.18, 0.25);
    this.horn2L.rotation.z = 0.25;
    this.horn2R.rotation.z = -0.25;
    this.horn2L.castShadow = true;
    this.horn2R.castShadow = true;
    this.group.add(this.horn2L, this.horn2R);

    // Mega crown: top-tier spike crown (stage 4+) — sits above the regular crown
    const crown2 = new THREE.Group();
    const crown2Mat = new THREE.MeshStandardMaterial({ color: 0xffd54a, metalness: 0.85, roughness: 0.18 });
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.32, 6), crown2Mat);
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      spike.position.set(Math.cos(a) * 0.25, 0.28, Math.sin(a) * 0.25);
      spike.castShadow = true;
      crown2.add(spike);
    }
    const topGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 0),
      new THREE.MeshStandardMaterial({ color: 0x00eaff, emissive: 0x00aacc, emissiveIntensity: 0.8 })
    );
    topGem.position.y = 0.48;
    crown2.add(topGem);
    crown2.position.set(0, 1.05, 0);
    this.crown2 = crown2;
    this.group.add(crown2);

    // Cosmic tier: star ring (stage 5+)
    const starRing = new THREE.Group();
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffff80, blending: THREE.AdditiveBlending, depthWrite: false });
    this.stars = [];
    for (let i = 0; i < 6; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), starMat);
      const a = (i / 6) * Math.PI * 2;
      star.userData.angle = a;
      star.position.set(Math.cos(a) * 1.7, 0.4 + Math.sin(a * 2) * 0.3, Math.sin(a) * 1.7);
      starRing.add(star);
      this.stars.push(star);
    }
    this.starRing = starRing;
    this.group.add(starRing);

    // Cosmic tier: second pair of wings (stage 5+)
    this.wing2L = new THREE.Mesh(wingGeo, wingMat);
    this.wing2R = new THREE.Mesh(wingGeo, wingMat);
    this.wing2L.scale.set(0.22, 0.95, 0.55);
    this.wing2R.scale.set(0.22, 0.95, 0.55);
    this.wing2L.position.set(-0.55, 0.75, -0.2);
    this.wing2R.position.set(0.55, 0.75, -0.2);
    this.wing2L.rotation.z = -0.7;
    this.wing2R.rotation.z = 0.7;
    this.group.add(this.wing2L, this.wing2R);

    // accessory anim state — current scales lerp toward target
    this.stage = 0;
    this.bodyScale = 1;
    this.bodyScaleTarget = 1;
    this.accessories = [
      { mesh: this.sprout,  target: 0, current: 0, showAt: 1 },
      { mesh: this.hornL,   target: 0, current: 0, showAt: 2 },
      { mesh: this.hornR,   target: 0, current: 0, showAt: 2 },
      { mesh: this.wingL,   target: 0, current: 0, showAt: 2 },
      { mesh: this.wingR,   target: 0, current: 0, showAt: 2 },
      { mesh: this.crown,   target: 0, current: 0, showAt: 3 },
      { mesh: this.aura,    target: 0, current: 0, showAt: 3 },
      { mesh: this.horn2L,  target: 0, current: 0, showAt: 4 },
      { mesh: this.horn2R,  target: 0, current: 0, showAt: 4 },
      { mesh: this.crown2,  target: 0, current: 0, showAt: 4 },
      { mesh: this.starRing,target: 0, current: 0, showAt: 5 },
      { mesh: this.wing2L,  target: 0, current: 0, showAt: 5 },
      { mesh: this.wing2R,  target: 0, current: 0, showAt: 5 },
    ];
    for (const a of this.accessories) {
      a.mesh.scale.setScalar(0);
      a.mesh.visible = false;
    }

    this.group.position.copy(position);
    scene.add(this.group);

    // physics body (sphere)
    this.physBody = new CANNON.Body({
      mass: 2,
      shape: new CANNON.Sphere(0.95),
      material: blobMat,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.4,
      angularDamping: 0.9,
      fixedRotation: true,
    });
    world.addBody(this.physBody);

    // state
    this.target = null;
    this.wanderTimer = 0;
    this.wanderTarget = new THREE.Vector3();
    this.bounceTime = 0;
    this.squish = 0;
    this.bounceCooldown = 0;
    this.manualMove = false;
    this.speedMult = 1;
    this.jumpMult = 1;
  }

  setColor(hex) {
    this.targetColor = new THREE.Color(hex);
  }

  feedBoost() {
    this.happiness = Math.min(this.happiness + 1, 12);
    this.bounceTime = 1.2;
    this.squish = 1.0;
  }

  setStage(n) {
    if (n === this.stage) return false;
    this.stage = n;
    for (const a of this.accessories) a.target = n >= a.showAt ? 1 : 0;
    const SCALES = [1.0, 1.13, 1.28, 1.42, 1.6, 1.85, 2.15];
    this.bodyScaleTarget = SCALES[Math.min(n, SCALES.length - 1)];
    // stage 6: glowing eyes
    if (n >= 6) {
      this.pupilL.material.emissive = new THREE.Color(0xff2288);
      this.pupilL.material.emissiveIntensity = 0.9;
      this.pupilR.material.emissive = new THREE.Color(0xff2288);
      this.pupilR.material.emissiveIntensity = 0.9;
    } else {
      this.pupilL.material.emissive = new THREE.Color(0x000000);
      this.pupilL.material.emissiveIntensity = 0;
      this.pupilR.material.emissive = new THREE.Color(0x000000);
      this.pupilR.material.emissiveIntensity = 0;
    }
    this.cosmic = n >= 5;
    // pop animation
    this.squish = 0.9;
    this.bounceTime = 1.8;
    return true;
  }

  update(dt, fruits) {
    if (!this.manualMove) {
      // pick a target: nearest fruit if any
      let nearest = null;
      let nearestDist = Infinity;
      for (const f of fruits) {
        const d = this.physBody.position.distanceTo(f.physBody.position);
        if (d < nearestDist && d < 22) { nearest = f; nearestDist = d; }
      }

      let goal;
      if (nearest) {
        goal = new THREE.Vector3(nearest.physBody.position.x, 0, nearest.physBody.position.z);
      } else {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 3 + Math.random() * 3;
          const a = Math.random() * Math.PI * 2;
          const r = 2 + Math.random() * 5;
          this.wanderTarget.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        }
        goal = this.wanderTarget;
      }

      // move toward goal
      const here = new THREE.Vector3(this.physBody.position.x, 0, this.physBody.position.z);
      const toGoal = new THREE.Vector3().subVectors(goal, here);
      const dist = toGoal.length();
      if (dist > 0.3) {
        toGoal.normalize();
        const speed = (nearest ? 8 : 3.5) * this.speedMult;
        this.physBody.velocity.x = toGoal.x * speed;
        this.physBody.velocity.z = toGoal.z * speed;

        // hop when on ground
        this.bounceCooldown -= dt;
        if (this.physBody.position.y < 1.05 && this.bounceCooldown <= 0) {
          this.physBody.velocity.y = (nearest ? 7.5 : 5.5) * this.jumpMult;
          this.bounceCooldown = nearest ? 0.35 : 0.55;
          this.squish = 0.6;
        }
      } else {
        this.physBody.velocity.x *= 0.6;
        this.physBody.velocity.z *= 0.6;
      }
    } else {
      this.bounceCooldown = (this.bounceCooldown ?? 0) - dt;
    }

    // sync visual to physics
    this.group.position.set(
      this.physBody.position.x,
      this.physBody.position.y,
      this.physBody.position.z
    );

    // face direction of motion
    const vx = this.physBody.velocity.x;
    const vz = this.physBody.velocity.z;
    if (vx * vx + vz * vz > 0.1) {
      const targetYaw = Math.atan2(vx, vz);
      const cur = this.group.rotation.y;
      let diff = targetYaw - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y = cur + diff * Math.min(1, dt * 6);
    }

    // squish anim
    this.squish = Math.max(0, this.squish - dt * 2);
    this.bounceTime = Math.max(0, this.bounceTime - dt);
    this.bodyScale += (this.bodyScaleTarget - this.bodyScale) * Math.min(1, dt * 4);
    const happyWobble = Math.sin(performance.now() * 0.012) * 0.05 * (this.bounceTime > 0 ? 1 : 0);
    const sy = (1 - this.squish * 0.3 + happyWobble) * this.bodyScale;
    const sxz = (1 + this.squish * 0.25 - happyWobble * 0.5) * this.bodyScale;
    this.group.scale.set(sxz, sy, sxz);

    // evolve accessories: lerp scale toward target
    for (const a of this.accessories) {
      a.current += (a.target - a.current) * Math.min(1, dt * 6);
      a.mesh.scale.setScalar(a.current);
      a.mesh.visible = a.current > 0.01;
    }
    // wings flap (stage 2+)
    if (this.wingL && this.wingL.visible) {
      const flap = Math.sin(performance.now() * 0.015) * 0.4;
      this.wingL.rotation.z = -0.4 + flap;
      this.wingR.rotation.z = 0.4 - flap;
    }
    // crown gently rotates (stage 3)
    if (this.crown && this.crown.visible) this.crown.rotation.y += dt * 0.5;
    if (this.crown2 && this.crown2.visible) this.crown2.rotation.y -= dt * 0.8;
    // aura pulses
    if (this.aura && this.aura.visible) {
      const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.08;
      this.aura.scale.setScalar(this.accessories.find(a => a.mesh === this.aura).current * pulse);
      this.aura.material.opacity = 0.12 + Math.sin(performance.now() * 0.005) * 0.06;
    }
    // star ring orbits
    if (this.starRing && this.starRing.visible) {
      this.starRing.rotation.y += dt * 1.3;
      for (const s of this.stars) {
        const a = s.userData.angle + performance.now() * 0.0015;
        s.position.y = 0.4 + Math.sin(a * 2) * 0.35;
      }
    }
    // cosmic color cycle
    if (this.cosmic) {
      const hue = (performance.now() * 0.0004) % 1;
      this.targetColor.setHSL(hue, 0.85, 0.62);
    }

    // smooth color
    this.currentColor.lerp(this.targetColor, dt * 2);
    this.bodyMat.color.copy(this.currentColor);

    // eye blink
    const t = performance.now() * 0.001;
    const blink = (Math.sin(t * 0.7) > 0.97) ? 0.1 : 1;
    this.eyeL.scale.y = blink;
    this.eyeR.scale.y = blink;
    this.pupilL.scale.y = blink;
    this.pupilR.scale.y = blink;

    // mouth smile bigger when happy
    const smile = 0.05 + this.bounceTime * 0.08;
    this.mouth.scale.set(1, 1 + smile * 4, 1);
  }

  checkEat(fruits, onAte) {
    const eatRadius = 1.3 * this.bodyScale;
    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      const d = this.physBody.position.distanceTo(f.physBody.position);
      if (d < eatRadius) {
        this.setColor(f.color);
        this.feedBoost();
        onAte(f);
        // remove fruit
        scene.remove(f.mesh);
        world.removeBody(f.physBody);
        fruits.splice(i, 1);
      }
    }
  }
}

const blob = new Blob(0xffd54a, new THREE.Vector3(0, 1.5, 0));

// ---------- fruits ----------
const fruits = [];
let snackCount = 0;

function spawnFruit(kind, fromPos, dir) {
  const def = FRUITS[kind];
  const geo = new THREE.SphereGeometry(def.scale, 20, 16);
  const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.35, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  scene.add(mesh);

  // strawberry gets a tiny green stem
  if (kind === 'strawberry') {
    const stem = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.18, 6),
      new THREE.MeshStandardMaterial({ color: 0x4caf50 })
    );
    stem.position.y = def.scale * 0.9;
    mesh.add(stem);
  }

  const body = new CANNON.Body({
    mass: 0.3,
    shape: new CANNON.Sphere(def.scale),
    material: fruitMat,
    position: new CANNON.Vec3(fromPos.x, fromPos.y, fromPos.z),
    linearDamping: 0.05,
    angularDamping: 0.05,
  });
  body.velocity.set(dir.x * 14, dir.y * 14 + 4, dir.z * 14);
  body.angularVelocity.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
  world.addBody(body);

  // soft musical bounce on impact
  body.addEventListener('collide', (e) => {
    const v = e.contact.getImpactVelocityAlongNormal();
    if (v > 2.5) playBounce(Math.min(1.5, v / 8));
  });

  fruits.push({ mesh, physBody: body, color: def.color, kind });
}

// ---------- blocks ----------
const blocks = [];
let blockCount = 0;

// Each block colour gets its own pentatonic note → tower crash = xylophone tune
const BLOCK_COLORS = [
  { color: 0xffd54a, note: NOTE_HZ.C5 }, // yellow
  { color: 0xff9a3c, note: NOTE_HZ.D5 }, // orange
  { color: 0xff5fa2, note: NOTE_HZ.E5 }, // pink
  { color: 0x4ec96a, note: NOTE_HZ.G5 }, // green
  { color: 0x4a6bff, note: NOTE_HZ.A5 }, // blue
  { color: 0xc792ff, note: NOTE_HZ.C6 }, // purple
];

function spawnBlock(fromPos, dir) {
  const size = 0.8;
  const choice = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
  const color = choice.color;
  const noteHz = choice.note;
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const half = size / 2;
  const body = new CANNON.Body({
    mass: 0.6,
    shape: new CANNON.Box(new CANNON.Vec3(half, half, half)),
    material: blockMat,
    position: new CANNON.Vec3(fromPos.x, fromPos.y, fromPos.z),
    linearDamping: 0.05,
    angularDamping: 0.1,
  });
  if (dir) {
    body.velocity.set(dir.x * 9, dir.y * 9 + 3, dir.z * 9);
    body.angularVelocity.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
  }
  world.addBody(body);

  // xylophone hit — pitch from colour, strength from impact
  let lastHit = 0;
  body.addEventListener('collide', (e) => {
    const v = e.contact.getImpactVelocityAlongNormal();
    const now = performance.now();
    if (v > 1.8 && now - lastHit > 70) {
      lastHit = now;
      playBlockHit(noteHz, Math.min(1.5, v / 6));
    }
  });

  blocks.push({ mesh, physBody: body, note: noteHz });
  blockCount++;
  blocksEl.textContent = '🧱 ' + blockCount;
}

// pre-stack a starter tower
function buildStarterTower() {
  for (let y = 0; y < 4; y++) {
    spawnBlock({ x: 5, y: 0.5 + y * 0.85, z: -2 }, null);
  }
  for (let y = 0; y < 3; y++) {
    spawnBlock({ x: -5, y: 0.5 + y * 0.85, z: -3 }, null);
  }
}
buildStarterTower();

// ---------- input: tap to toss ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function tossFrom(clientX, clientY) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);

  // intersect ground plane y=0
  const planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const targetPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeY, targetPoint);
  if (!targetPoint) return;

  const origin = new THREE.Vector3(0, 4, 12);
  const dir = new THREE.Vector3().subVectors(targetPoint, origin).normalize();

  if (selectedTool === 'block') {
    spawnBlock(origin, dir);
    playBlockToss();
  } else {
    spawnFruit(selectedTool, origin, dir);
    playToss(selectedTool);
    snackCount++;
    snacksEl.textContent = FRUITS[selectedTool].emoji + ' ' + snackCount;
  }
}

let hasInteracted = false;
function onPointer(e) {
  if (e.target.closest('#fruit-picker') || e.target.closest('#start') ||
      e.target.closest('#battle-btn') || e.target.closest('#battle-ui') ||
      e.target.closest('#powers') || e.target.closest('#dpad') ||
      e.target.closest('#screen-attack')) return;
  const x = e.clientX ?? (e.touches && e.touches[0]?.clientX);
  const y = e.clientY ?? (e.touches && e.touches[0]?.clientY);
  if (x == null) return;
  if (battle.active) {
    setBattleMoveFromTap(x, y);
    return;
  }
  tossFrom(x, y);
  if (!hasInteracted) { hasInteracted = true; helpEl.classList.remove('show'); }
}
window.addEventListener('pointerdown', onPointer);

function setBattleMoveFromTap(clientX, clientY) {
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(planeY, hit);
  if (!hit) return;
  // if tap is near a foe, target that foe (chase it close enough to bump)
  let nearest = null, nearestDist = Infinity;
  for (const foe of battle.foes) {
    if (foe.dead) continue;
    const d = Math.hypot(hit.x - foe.physBody.position.x, hit.z - foe.physBody.position.z);
    if (d < 2.5 && d < nearestDist) { nearest = foe; nearestDist = d; }
  }
  if (nearest) {
    battle.moveTarget = new THREE.Vector3(nearest.physBody.position.x, 0, nearest.physBody.position.z);
  } else {
    battle.moveTarget = hit.clone();
  }
}

// start screen — also unlocks audio (must happen on a user gesture)
startEl.addEventListener('click', () => {
  initAudio();
  unlockAudio();
  startEl.style.display = 'none';
  helpEl.classList.add('show');
  setTimeout(() => helpEl.classList.remove('show'), 4000);
  playHappy();
  setTimeout(startMusic, 600);
  setTimeout(showKeysHint, 1200);
});

// ---------- blob: visual-only tick (used during battle) ----------
function updateBlobVisualOnly(b, dt) {
  b.group.position.set(b.physBody.position.x, b.physBody.position.y, b.physBody.position.z);
  // face direction of motion if moving; otherwise face their assigned look target
  const vx = b.physBody.velocity.x, vz = b.physBody.velocity.z;
  let targetYaw = b.group.rotation.y;
  if (vx * vx + vz * vz > 0.15) {
    targetYaw = Math.atan2(vx, vz);
  } else if (b._lookTarget) {
    const dx = b._lookTarget.x - b.physBody.position.x;
    const dz = b._lookTarget.z - b.physBody.position.z;
    if (dx * dx + dz * dz > 0.01) targetYaw = Math.atan2(dx, dz);
  }
  let diff = targetYaw - b.group.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  b.group.rotation.y += diff * Math.min(1, dt * 6);

  b.squish = Math.max(0, b.squish - dt * 2);
  b.bounceTime = Math.max(0, b.bounceTime - dt);
  b.bodyScale += (b.bodyScaleTarget - b.bodyScale) * Math.min(1, dt * 4);
  const wobble = Math.sin(performance.now() * 0.012) * 0.05 * (b.bounceTime > 0 ? 1 : 0);
  const sy = (1 - b.squish * 0.3 + wobble) * b.bodyScale;
  const sxz = (1 + b.squish * 0.25 - wobble * 0.5) * b.bodyScale;
  b.group.scale.set(sxz, sy, sxz);

  for (const a of b.accessories) {
    a.current += (a.target - a.current) * Math.min(1, dt * 6);
    a.mesh.scale.setScalar(a.current);
    a.mesh.visible = a.current > 0.01;
  }
  if (b.wingL && b.wingL.visible) {
    const flap = Math.sin(performance.now() * 0.015) * 0.4;
    b.wingL.rotation.z = -0.4 + flap;
    b.wingR.rotation.z = 0.4 - flap;
  }
  if (b.wing2L && b.wing2L.visible) {
    const flap = Math.sin(performance.now() * 0.015 + 1.2) * 0.4;
    b.wing2L.rotation.z = -0.7 + flap;
    b.wing2R.rotation.z = 0.7 - flap;
  }
  if (b.crown && b.crown.visible) b.crown.rotation.y += dt * 0.5;
  if (b.crown2 && b.crown2.visible) b.crown2.rotation.y -= dt * 0.8;
  if (b.aura && b.aura.visible) {
    const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.08;
    const entry = b.accessories.find(a => a.mesh === b.aura);
    b.aura.scale.setScalar(entry.current * pulse);
    b.aura.material.opacity = 0.12 + Math.sin(performance.now() * 0.005) * 0.06;
  }
  if (b.starRing && b.starRing.visible) {
    b.starRing.rotation.y += dt * 1.3;
    for (const s of b.stars) {
      const a = s.userData.angle + performance.now() * 0.0015;
      s.position.y = 0.4 + Math.sin(a * 2) * 0.35;
    }
  }
  if (b.cosmic) {
    const hue = (performance.now() * 0.0004) % 1;
    b.targetColor.setHSL(hue, 0.85, 0.62);
  }

  b.currentColor.lerp(b.targetColor, dt * 2);
  b.bodyMat.color.copy(b.currentColor);

  const t = performance.now() * 0.001;
  const blink = (Math.sin(t * 0.7) > 0.97) ? 0.1 : 1;
  b.eyeL.scale.y = blink; b.eyeR.scale.y = blink;
  b.pupilL.scale.y = blink; b.pupilR.scale.y = blink;

  const smile = 0.05 + b.bounceTime * 0.08;
  b.mouth.scale.set(1, 1 + smile * 4, 1);
}

// ---------- sparkles ----------
const sparkles = [];
const sparkleGeo = new THREE.SphereGeometry(0.12, 6, 6);
function spawnSparkles(pos, color = 0xffff80, count = 40) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(sparkleGeo, mat);
    m.position.copy(pos);
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.3) * Math.PI * 0.8;
    const speed = 3 + Math.random() * 6;
    m.userData.vel = new THREE.Vector3(
      Math.cos(theta) * Math.cos(phi) * speed,
      Math.sin(phi) * speed + 5,
      Math.sin(theta) * Math.cos(phi) * speed
    );
    m.userData.life = 1.2;
    scene.add(m);
    sparkles.push(m);
  }
}
function updateSparkles(dt) {
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i];
    s.position.addScaledVector(s.userData.vel, dt);
    s.userData.vel.y -= 9 * dt;
    s.userData.life -= dt;
    s.material.opacity = Math.max(0, s.userData.life);
    s.scale.setScalar(Math.max(0.1, s.userData.life));
    if (s.userData.life <= 0) {
      scene.remove(s);
      s.material.dispose();
      sparkles.splice(i, 1);
    }
  }
}

// ---------- screen flash ----------
const flashEl = document.getElementById('flash');
function flashScreen() {
  flashEl.classList.add('on');
  setTimeout(() => flashEl.classList.remove('on'), 90);
}

// ---------- evolution thresholds ----------
const STAGE_THRESHOLDS = [3, 7, 13, 20, 30, 45];
const STAGE_NAMES = ['Buddy', 'Sprout', 'Beast', 'Champion', 'Mega', 'Cosmic', 'Ultimate'];
let fruitsEaten = 0;
const stageBadge = document.getElementById('stage-badge');
const battleBtn = document.getElementById('battle-btn');

function tryEvolve() {
  let newStage = 0;
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (fruitsEaten >= STAGE_THRESHOLDS[i]) { newStage = i + 1; break; }
  }
  if (newStage > blob.stage) {
    blob.setStage(newStage);
    spawnSparkles(blob.group.position, 0xffff80, 60 + newStage * 10);
    flashScreen();
    playEvolve();
    stageBadge.classList.add('show');
    stageBadge.textContent = '✨ ' + STAGE_NAMES[newStage] + '!';
    if (newStage >= 3 && battle.bossTier < BOSS_TIERS.length) {
      showBattleButton();
    }
    updatePowerLocks();
  }
}

// ---------- battle system ----------
const battleUI = document.getElementById('battle-ui');
const playerHPEl = document.getElementById('player-hp');
const playerNameEl = document.getElementById('player-name');
const battleMsg = document.getElementById('battle-msg');
const atkBtns = document.querySelectorAll('.atk-btn');
const foeListEl = document.getElementById('foe-list');

const BOSS_TIERS = [
  {
    name: 'Pokeking Crew',
    foes: [
      { name: '👑 Pokeking', color: 0x9b59ff, scale: 1.95, hp: 220, dmg: [10, 22], x: 8.5, stage: 3 },
      { name: '😈 Minion',   color: 0xc792ff, scale: 1.15, hp: 70,  dmg: [5, 11],  x: 5.5, stage: 2 },
      { name: '😈 Minion',   color: 0xc792ff, scale: 1.15, hp: 70,  dmg: [5, 11],  x: 3.0, stage: 2 },
    ],
  },
  {
    name: 'Mega Crew',
    foes: [
      { name: '🔥 Mega Pokeking', color: 0xd72660, scale: 2.3,  hp: 360, dmg: [14, 28], x: 9.5, stage: 4 },
      { name: '👹 Brute',         color: 0xff5566, scale: 1.45, hp: 140, dmg: [9, 18],  x: 6.5, stage: 3 },
      { name: '👹 Brute',         color: 0xff5566, scale: 1.45, hp: 140, dmg: [9, 18],  x: 3.5, stage: 3 },
      { name: '😈 Imp',           color: 0xffaaaa, scale: 1.05, hp: 60,  dmg: [4, 9],   x: 0.5, stage: 1 },
    ],
  },
  {
    name: 'Cosmic Crew',
    foes: [
      { name: '🌌 Cosmic King', color: 0x3a1a78, scale: 2.7, hp: 520, dmg: [18, 36], cosmic: true, x: 10.5, stage: 5 },
      { name: '👽 Alien',       color: 0x44eedd, scale: 1.6, hp: 190, dmg: [12, 22], x: 7,    stage: 3 },
      { name: '👽 Alien',       color: 0x44eedd, scale: 1.6, hp: 190, dmg: [12, 22], x: 3.5,  stage: 3 },
      { name: '🌠 Twinkle',     color: 0xffd54a, scale: 1.0, hp: 50,  dmg: [7, 13],  x: 0,    stage: 2 },
    ],
  },
];

const battle = {
  active: false,
  busy: false,
  bossTier: 0,
  playerHP: 100, playerHPMax: 100,
  foes: [],
  cityGroup: null,
  savedPlayerPos: null,
};

function showBattleButton() {
  if (battle.bossTier >= BOSS_TIERS.length) {
    battleBtn.classList.remove('show');
    return;
  }
  const cfg = BOSS_TIERS[battle.bossTier];
  battleBtn.textContent = '⚔️ Fight ' + cfg.name + '!';
  battleBtn.classList.add('show');
}

function buildFoeBlob(cfg) {
  const f = new Blob(cfg.color, new THREE.Vector3(cfg.x, 1.8, 0));
  f.setStage(cfg.stage ?? 3);
  f.targetColor = new THREE.Color(cfg.color);
  f.bodyScaleTarget = cfg.scale;
  f.isFoe = true;
  if (cfg.cosmic) f.cosmic = true;
  f.cheekL.visible = false;
  f.cheekR.visible = false;
  f.mouth.rotation.z = 0;
  f.mouth.position.set(0, -0.1, 0.92);
  f.pupilL.position.set(-0.28, 0.28, 0.92);
  f.pupilR.position.set(0.28, 0.28, 0.92);
  f.config = cfg;
  f.hp = cfg.hp;
  f.hpMax = cfg.hp;
  f.dead = false;
  return f;
}

function buildCityArena() {
  const g = new THREE.Group();
  const colors = [0x6b6b8b, 0x8b7b9b, 0x9b8b6b, 0x7b9bb0, 0x5b5b75];
  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.1;
    const r = 22 + Math.random() * 14;
    const h = 5 + Math.random() * 14;
    const w = 1.8 + Math.random() * 2.4;
    const d = 1.8 + Math.random() * 2.4;
    const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.85 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
    b.castShadow = true;
    b.receiveShadow = true;
    g.add(b);
    // lit windows
    for (let yy = 1; yy < h - 1; yy += 1.3) {
      for (let s = 0; s < 4; s++) {
        if (Math.random() < 0.55) continue;
        const winMat = new THREE.MeshStandardMaterial({
          color: 0xffe7a0, emissive: 0xffbb44, emissiveIntensity: 0.9,
        });
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.45), winMat);
        const offs = [
          [0,           yy - h/2, d/2 + 0.005, 0],
          [0,           yy - h/2, -d/2 - 0.005, Math.PI],
          [w/2 + 0.005, yy - h/2, 0, Math.PI / 2],
          [-w/2 - 0.005,yy - h/2, 0, -Math.PI / 2],
        ];
        const [ox, oy, oz, ry] = offs[s];
        win.position.set(ox, oy, oz);
        win.rotation.y = ry;
        b.add(win);
      }
    }
  }
  // distant towers
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 42 + Math.random() * 10;
    const h = 22 + Math.random() * 20;
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(3, h, 3),
      new THREE.MeshStandardMaterial({ color: 0x4a4a6a, roughness: 0.9 })
    );
    tower.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
    g.add(tower);
  }
  // a moon
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff4d6 })
  );
  moon.position.set(-18, 22, -28);
  g.add(moon);
  scene.add(g);
  return g;
}

function renderFoeList() {
  foeListEl.innerHTML = '';
  battle.foes.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'foe-row';
    row.dataset.idx = i;
    row.innerHTML = `<div class="hp-name">${f.config.name}</div><div class="hp-bar"><div class="hp-fill"></div></div>`;
    foeListEl.appendChild(row);
  });
  updateFoeRows();
}

function updatePlayerHP() {
  playerHPEl.style.width = Math.max(0, (battle.playerHP / battle.playerHPMax) * 100) + '%';
}

function getFirstAliveIdx() {
  for (let i = 0; i < battle.foes.length; i++) if (!battle.foes[i].dead) return i;
  return -1;
}

function updateFoeRows() {
  const rows = foeListEl.querySelectorAll('.foe-row');
  const activeIdx = getFirstAliveIdx();
  battle.foes.forEach((f, i) => {
    const row = rows[i];
    if (!row) return;
    row.querySelector('.hp-fill').style.width = Math.max(0, (f.hp / f.hpMax) * 100) + '%';
    row.classList.toggle('dead', f.dead);
    row.classList.toggle('active', !f.dead && i === activeIdx);
  });
}

function stashPlayground() {
  for (const b of blocks) {
    b.mesh.visible = false;
    b._stashed = b.physBody.position.clone();
    b.physBody.position.y = -200;
    b.physBody.sleep();
  }
  for (const f of fruits) {
    f.mesh.visible = false;
    f.physBody.position.y = -200;
    f.physBody.sleep();
  }
  for (const p of poops) {
    p.mesh.visible = false;
    p.physBody.position.y = -200;
    p.physBody.sleep();
  }
  playgroundDeco.visible = false;
}

function restorePlayground() {
  for (const b of blocks) {
    b.mesh.visible = true;
    if (b._stashed) b.physBody.position.copy(b._stashed);
    b.physBody.wakeUp();
  }
  // dropped fruits / poops stay dropped (gone); not worth restoring
  for (let i = fruits.length - 1; i >= 0; i--) {
    scene.remove(fruits[i].mesh);
    world.removeBody(fruits[i].physBody);
    fruits.splice(i, 1);
  }
  for (let i = poops.length - 1; i >= 0; i--) {
    scene.remove(poops[i].mesh);
    world.removeBody(poops[i].physBody);
    poops.splice(i, 1);
  }
  playgroundDeco.visible = true;
}

function enterBattle() {
  if (battle.active) return;
  if (battle.bossTier >= BOSS_TIERS.length) return;
  const tierCfg = BOSS_TIERS[battle.bossTier];

  battle.active = true;
  battle.busy = false;
  battle.playerHPMax = 100 + Math.max(0, blob.stage - 3) * 30;
  battle.playerHP = battle.playerHPMax;
  updatePlayerHP();
  playerNameEl.textContent = '✨ ' + STAGE_NAMES[blob.stage];

  battleUI.classList.add('show');
  battleBtn.classList.remove('show');
  picker.style.display = 'none';
  document.getElementById('hud').style.display = 'none';
  stageBadge.classList.remove('show');
  document.getElementById('powers').style.display = 'none';

  // shady night-city arena vibe
  scene.background = new THREE.Color(0x07060f);
  scene.fog = new THREE.Fog(0x07060f, 8, 38);
  renderer.setClearColor(0x07060f);
  groundMaterial.color.set(0x14141f);
  // dim the daytime lights, add cold moonlight + warm streetlamps
  battle._savedHemi = hemi.intensity;
  battle._savedSun = sun.intensity;
  battle._savedHemiColor = hemi.color.clone();
  battle._savedHemiGround = hemi.groundColor.clone();
  battle._savedSunColor = sun.color.clone();
  hemi.intensity = 0.18;
  hemi.color.set(0x6a7aff);
  hemi.groundColor.set(0x0a0820);
  sun.intensity = 0.45;
  sun.color.set(0xa8b4ff);

  stashPlayground();
  battle.cityGroup = buildCityArena();
  // hide playground cards, spawn battle cards
  for (const c of playgroundCards) c.visible = false;
  spawnBattleCards();

  // warm streetlamp point lights scattered around the arena
  battle.lamps = [];
  const lampSpots = [
    [-4, 4, -3], [5, 4, -4], [9, 4, 3], [-2, 4, 4],
    [3, 4, 5], [-7, 4, 0], [11, 4, -2],
  ];
  for (const [lx, ly, lz] of lampSpots) {
    const lamp = new THREE.PointLight(0xffaa44, 1.6, 14, 1.4);
    lamp.position.set(lx, ly, lz);
    scene.add(lamp);
    battle.lamps.push(lamp);
    // a tiny glowing bulb so you can see where the light comes from
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff0a0 })
    );
    bulb.position.copy(lamp.position);
    scene.add(bulb);
    lamp.userData.bulb = bulb;
  }

  // place player
  battle.savedPlayerPos = blob.physBody.position.clone();
  blob.physBody.position.set(-7, 1.5, 0);
  blob.physBody.velocity.set(0, 0, 0);

  // spawn foes
  battle.foes = tierCfg.foes.map(buildFoeBlob);
  renderFoeList();

  // camera: wider angle for the squad — pick FOV based on screen aspect
  camera.fov = (window.innerWidth < window.innerHeight) ? 75 : 60;
  camera.updateProjectionMatrix();
  camera.position.set(1.5, 9, 24);
  camera.lookAt(1.5, 1.5, 0);

  battleMsg.classList.remove('show');
  for (const b of atkBtns) b.disabled = false;
}

function exitBattle(won) {
  battle.active = false;
  battle.ended = false;
  battleUI.classList.remove('show');
  picker.style.display = '';
  document.getElementById('hud').style.display = '';
  document.getElementById('powers').style.display = '';

  scene.background = null;
  scene.fog = new THREE.Fog(0x9be7ff, 30, 80);
  renderer.setClearColor(0x9be7ff);
  groundMaterial.color.set(0x7ed957);
  camera.fov = 55;
  camera.updateProjectionMatrix();
  // restore lighting
  if (battle._savedHemi != null) {
    hemi.intensity = battle._savedHemi;
    sun.intensity = battle._savedSun;
    hemi.color.copy(battle._savedHemiColor);
    hemi.groundColor.copy(battle._savedHemiGround);
    sun.color.copy(battle._savedSunColor);
  }
  // remove streetlamps
  if (battle.lamps) {
    for (const lamp of battle.lamps) {
      if (lamp.userData.bulb) scene.remove(lamp.userData.bulb);
      scene.remove(lamp);
    }
    battle.lamps = [];
  }
  // remove leftover projectiles
  for (const p of battleProjectiles) {
    scene.remove(p.mesh);
    world.removeBody(p.physBody);
  }
  battleProjectiles.length = 0;
  moveRing.visible = false;
  battle.moveTarget = null;

  // restore cards
  clearBattleCards();
  for (const c of playgroundCards) c.visible = true;

  // remove all foes
  for (const f of battle.foes) {
    scene.remove(f.group);
    world.removeBody(f.physBody);
  }
  battle.foes = [];

  // remove city
  if (battle.cityGroup) {
    scene.remove(battle.cityGroup);
    battle.cityGroup = null;
  }

  if (battle.savedPlayerPos) blob.physBody.position.copy(battle.savedPlayerPos);
  restorePlayground();

  if (won) {
    spawnSparkles(blob.group.position, 0xffd54a, 100);
    flashScreen();
    stageBadge.textContent = '🏆 Won ' + BOSS_TIERS[battle.bossTier - 1].name + '!';
    stageBadge.classList.add('show');
    // show next tier button if there is one
    showBattleButton();
  } else {
    battleBtn.classList.add('show');
  }
}

// Attack buttons now FIRE fruit projectiles from the blob at the nearest foe.
// Damage on contact; bigger fruit hits harder.
const ATTACKS = {
  quick: { fruit: 'strawberry', cd: 250,  dmg: [10, 18], speed: 22, count: 1 },
  power: { fruit: 'orange',     cd: 600,  dmg: [18, 30], speed: 24, count: 1 },
  super: { fruit: 'grape',      cd: 1100, dmg: [12, 22], speed: 26, count: 5 }, // shotgun
};
const lastAtkAt = {};

function pickNearestFoe() {
  let best = null, bestD = Infinity;
  for (const f of battle.foes) {
    if (f.dead) continue;
    const d = Math.hypot(
      f.physBody.position.x - blob.physBody.position.x,
      f.physBody.position.z - blob.physBody.position.z
    );
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

function spawnDamageFruit(kind, fromPos, dir, dmg) {
  const def = FRUITS[kind];
  const geo = new THREE.SphereGeometry(def.scale, 16, 12);
  const mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.35 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  scene.add(mesh);
  const body = new CANNON.Body({
    mass: 0.3,
    shape: new CANNON.Sphere(def.scale),
    material: fruitMat,
    position: new CANNON.Vec3(fromPos.x, fromPos.y, fromPos.z),
    linearDamping: 0.02,
  });
  body.velocity.set(dir.x, dir.y, dir.z);
  world.addBody(body);
  const proj = { mesh, physBody: body, kind, dmg, life: 2.5, color: def.color };
  battleProjectiles.push(proj);
  // remove from world if it falls
  return proj;
}

const battleProjectiles = [];

function doPlayerAttack(kind) {
  if (!battle.active) return;
  const cfg = ATTACKS[kind];
  const now = performance.now();
  if (now - (lastAtkAt[kind] ?? 0) < cfg.cd) return;
  lastAtkAt[kind] = now;

  const foe = pickNearestFoe();
  if (!foe) return;

  const origin = new THREE.Vector3(
    blob.physBody.position.x,
    blob.physBody.position.y + 0.6,
    blob.physBody.position.z
  );
  // aim toward foe with a slight arc
  for (let i = 0; i < cfg.count; i++) {
    const spread = (Math.random() - 0.5) * 0.4 * (cfg.count > 1 ? 1 : 0.3);
    const dx = foe.physBody.position.x - origin.x + spread;
    const dz = foe.physBody.position.z - origin.z + spread;
    const horiz = Math.hypot(dx, dz);
    const dir = new THREE.Vector3(
      (dx / horiz) * cfg.speed,
      6 + Math.random() * 2,
      (dz / horiz) * cfg.speed
    );
    const [dmin, dmax] = cfg.dmg;
    const dmg = dmin + Math.floor(Math.random() * (dmax - dmin + 1));
    spawnDamageFruit(cfg.fruit, origin, dir, dmg);
  }
  playToss(cfg.fruit);
  blob.squish = 0.45;
  blob.bounceTime = 0.3;
}

function tickProjectiles(dt) {
  for (let i = battleProjectiles.length - 1; i >= 0; i--) {
    const p = battleProjectiles[i];
    p.mesh.position.copy(p.physBody.position);
    p.mesh.quaternion.copy(p.physBody.quaternion);
    p.life -= dt;
    let hit = false;
    for (const foe of battle.foes) {
      if (foe.dead) continue;
      const d = Math.hypot(
        foe.physBody.position.x - p.physBody.position.x,
        foe.physBody.position.z - p.physBody.position.z
      );
      const hitDist = 0.6 + foe.bodyScale * 0.7;
      if (d < hitDist && Math.abs(foe.physBody.position.y - p.physBody.position.y) < 2.2) {
        foe.hp = Math.max(0, foe.hp - p.dmg);
        spawnSparkles(p.physBody.position, p.color, 16);
        foe.squish = 0.65;
        foe.bounceTime = 0.5;
        playAttack(0.5);
        if (foe.hp <= 0) {
          foe.dead = true;
          spawnSparkles(foe.group.position, 0xffd54a, 60);
          foe.group.visible = false;
        }
        updateFoeRows();
        hit = true;
        break;
      }
    }
    if (hit || p.life <= 0 || p.physBody.position.y < -5) {
      scene.remove(p.mesh);
      world.removeBody(p.physBody);
      battleProjectiles.splice(i, 1);
    }
  }
  if (battle.foes.length && battle.foes.every(f => f.dead) && battle.active) {
    endBattle(true);
  }
}

function endBattle(won) {
  if (battle.ended) return;
  battle.ended = true;
  battle.busy = true;
  battle.moveTarget = null;
  moveRing.visible = false;
  for (const b of atkBtns) b.disabled = true;
  if (won) {
    playVictory();
    spawnSparkles(blob.group.position, 0xffd54a, 120);
    battle.bossTier++;
    const more = battle.bossTier < BOSS_TIERS.length;
    battleMsg.innerHTML = '🏆 YOU WIN! 🏆<button id="msg-btn">' +
      (more ? 'Back to Playground' : 'You beat them all!') + '</button>';
  } else {
    playDefeat();
    battleMsg.innerHTML = '😢 Try again?<button id="msg-btn">Heal & Retry</button>';
  }
  battleMsg.classList.add('show');
  const btn = battleMsg.querySelector('button');
  if (btn) btn.addEventListener('click', () => {
    battleMsg.classList.remove('show');
    if (won) {
      exitBattle(true);
    } else {
      // revive foes, reset HP, retry
      battle.playerHP = battle.playerHPMax;
      for (const f of battle.foes) {
        f.hp = f.hpMax;
        f.dead = false;
        f.group.visible = true;
      }
      updatePlayerHP();
      updateFoeRows();
      battle.busy = false;
      battle.ended = false;
      for (const b of atkBtns) b.disabled = false;
    }
  });
}

for (const b of atkBtns) {
  b.addEventListener('click', () => doPlayerAttack(b.dataset.atk));
}
battleBtn.addEventListener('click', enterBattle);

// ---------- battle movement + AI ----------
battle.moveTarget = null;   // THREE.Vector3 or null
battle.lastDamagedAt = 0;   // global cooldown for player taking damage

// visible target ring on the ground
const moveRing = new THREE.Mesh(
  new THREE.RingGeometry(0.55, 0.85, 28),
  new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
);
moveRing.rotation.x = -Math.PI / 2;
moveRing.visible = false;
scene.add(moveRing);

function tickMovement(b, target, dt, speed) {
  if (!target) {
    b.physBody.velocity.x *= 0.7;
    b.physBody.velocity.z *= 0.7;
    return;
  }
  const dx = target.x - b.physBody.position.x;
  const dz = target.z - b.physBody.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.5) {
    b.physBody.velocity.x = dx / dist * speed;
    b.physBody.velocity.z = dz / dist * speed;
    b._bounceCD = (b._bounceCD ?? 0) - dt;
    if (b.physBody.position.y < 1.15 && b._bounceCD <= 0) {
      b.physBody.velocity.y = 5.5;
      b._bounceCD = 0.5;
      b.squish = 0.55;
    }
  } else {
    b.physBody.velocity.x *= 0.6;
    b.physBody.velocity.z *= 0.6;
  }
}

function tickFoeAI(foe, dt) {
  foe._aiTimer = (foe._aiTimer ?? 0) - dt;
  if (foe._aiTimer <= 0) {
    // 65% chase, 35% wander
    if (Math.random() < 0.65) {
      foe._aiMode = 'chase';
      foe._aiTimer = 1.5 + Math.random() * 2.5;
    } else {
      foe._aiMode = 'wander';
      foe._aiTimer = 1.8 + Math.random() * 2;
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 6;
      foe._aiTarget = new THREE.Vector3(
        blob.physBody.position.x + Math.cos(a) * r, 0,
        blob.physBody.position.z + Math.sin(a) * r
      );
    }
  }
  let goal;
  if (foe._aiMode === 'chase') {
    goal = new THREE.Vector3(blob.physBody.position.x, 0, blob.physBody.position.z);
  } else {
    goal = foe._aiTarget || new THREE.Vector3();
  }
  // bigger foes move slower (feel heavy)
  const speed = Math.max(2.5, 6.5 - foe.bodyScale * 1.2);
  tickMovement(foe, goal, dt, speed);
  foe._lookTarget = goal;
}

function checkContactDamage(dt) {
  if (!battle.active) return;
  const now = performance.now();
  for (const foe of battle.foes) {
    if (foe.dead) continue;
    const dx = foe.physBody.position.x - blob.physBody.position.x;
    const dz = foe.physBody.position.z - blob.physBody.position.z;
    const dist = Math.hypot(dx, dz);
    const contactDist = 1.2 + foe.bodyScale * 0.7;
    if (dist > contactDist) continue;
    // player → foe damage
    if (now - (foe._lastHit ?? 0) > 700) {
      foe._lastHit = now;
      const dmg = 6 + Math.floor(Math.random() * 8) + Math.floor(blob.bodyScale * 3);
      foe.hp = Math.max(0, foe.hp - dmg);
      spawnSparkles(foe.group.position, 0xffff00, 14);
      foe.squish = 0.7;
      foe.bounceTime = 0.5;
      playAttack(0.6);
      // bounce them apart
      const nx = dx / (dist || 1), nz = dz / (dist || 1);
      foe.physBody.velocity.x += nx * 4;
      foe.physBody.velocity.z += nz * 4;
      blob.physBody.velocity.x -= nx * 3;
      blob.physBody.velocity.z -= nz * 3;
      if (foe.hp <= 0) {
        foe.dead = true;
        spawnSparkles(foe.group.position, 0xffd54a, 50);
        foe.group.visible = false;
      }
      updateFoeRows();
      if (battle.foes.every(f => f.dead)) {
        endBattle(true);
        return;
      }
    }
    // foe → player damage
    if (now - (foe._lastDealt ?? 0) > 1100) {
      foe._lastDealt = now;
      const [min, max] = foe.config.dmg;
      const dmg = Math.floor((min + Math.random() * (max - min)) * 0.6); // contact does less than ranged
      battle.playerHP = Math.max(0, battle.playerHP - dmg);
      updatePlayerHP();
      spawnSparkles(blob.group.position, foe.config.color, 12);
      blob.squish = 0.7;
      blob.bounceTime = 0.4;
      playFoeAttack();
      flashScreen();
      if (battle.playerHP <= 0) {
        endBattle(false);
        return;
      }
    }
  }
}

// ---------- poops (the kid asked for them) ----------
const poops = [];
function spawnPoop(pos) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95 });
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), mat);
  group.add(base);
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat);
  mid.position.y = 0.32;
  group.add(mid);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 10), mat);
  top.position.y = 0.6;
  group.add(top);
  group.castShadow = true;
  base.castShadow = true; mid.castShadow = true; top.castShadow = true;
  scene.add(group);

  const body = new CANNON.Body({
    mass: 0.4,
    shape: new CANNON.Sphere(0.32),
    material: blockMat,
    position: new CANNON.Vec3(pos.x, pos.y + 0.5, pos.z),
    linearDamping: 0.05,
  });
  body.angularVelocity.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
  world.addBody(body);
  poops.push({ mesh: group, physBody: body });
}

// ---------- powers ----------
const powerEls = document.querySelectorAll('.power');
const POWER_UNLOCK   = { jump: 1, dash: 2, poop: 3, stomp: 4, beam: 5, hug: 6 };
const POWER_COOLDOWN = { jump: 600, dash: 1400, poop: 900, stomp: 2800, beam: 1800, hug: 4000 };
const lastUsedPower = {};

function updatePowerLocks() {
  for (const el of powerEls) {
    const need = POWER_UNLOCK[el.dataset.power];
    el.classList.toggle('locked', blob.stage < need);
  }
}

function flashPower(name) {
  for (const el of powerEls) {
    if (el.dataset.power === name) {
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 400);
    }
  }
}

function tryPower(name) {
  if (blob.stage < POWER_UNLOCK[name]) return;
  const now = performance.now();
  if (now - (lastUsedPower[name] || 0) < POWER_COOLDOWN[name]) return;
  lastUsedPower[name] = now;
  flashPower(name);
  switch (name) {
    case 'jump':  doJump();  break;
    case 'dash':  doDash();  break;
    case 'poop':  doPoop();  break;
    case 'stomp': doStomp(); break;
    case 'beam':  doBeam();  break;
    case 'hug':   doHug();   break;
  }
}

function doJump() {
  blob.physBody.velocity.y = 14;
  blob.squish = 0.7;
  blob.bounceTime = 0.6;
  playBounce(1.3);
}

function doDash() {
  // dash in current facing direction
  const yaw = blob.group.rotation.y;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  blob.physBody.velocity.x = dx * 18;
  blob.physBody.velocity.z = dz * 18;
  blob.physBody.velocity.y = Math.max(blob.physBody.velocity.y, 4);
  blob.squish = 0.6;
  blob.bounceTime = 0.5;
  // sparkle trail
  for (let i = 0; i < 5; i++) {
    setTimeout(() => spawnSparkles(blob.group.position, 0x88ffff, 8), i * 50);
  }
  playToss('blueberry');
}

function doPoop() {
  // drop a poop just behind blob
  const yaw = blob.group.rotation.y;
  const bx = blob.physBody.position.x - Math.sin(yaw) * 1.4;
  const bz = blob.physBody.position.z - Math.cos(yaw) * 1.4;
  spawnPoop(new THREE.Vector3(bx, blob.physBody.position.y, bz));
  // tiny squish + fart-ish sound
  blob.squish = 0.5;
  blob.bounceTime = 0.4;
  playBlockToss();
}

function doStomp() {
  // mega jump → slam → AOE damage in battle, scatter physics in playground
  blob.physBody.velocity.y = 22;
  blob.squish = 1;
  blob.bounceTime = 1.2;
  playToss('grape');
  setTimeout(() => {
    const here = blob.physBody.position;
    function nudge(arr) {
      for (const item of arr) {
        const dx = item.physBody.position.x - here.x;
        const dz = item.physBody.position.z - here.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 9 && dist > 0.01) {
          const force = (9 - dist) * 4;
          item.physBody.wakeUp();
          item.physBody.applyImpulse(
            new CANNON.Vec3(dx / dist * force, 6, dz / dist * force),
            item.physBody.position
          );
        }
      }
    }
    nudge(blocks); nudge(poops); nudge(fruits);
    // AOE damage to foes
    if (battle.active) {
      for (const foe of battle.foes) {
        if (foe.dead) continue;
        const d = Math.hypot(foe.physBody.position.x - here.x, foe.physBody.position.z - here.z);
        if (d < 8) {
          const dmg = Math.floor((8 - d) * 4 + 6);
          foe.hp = Math.max(0, foe.hp - dmg);
          spawnSparkles(foe.group.position, 0xffff00, 20);
          foe.squish = 0.7; foe.bounceTime = 0.5;
          if (foe.hp <= 0) {
            foe.dead = true;
            spawnSparkles(foe.group.position, 0xffd54a, 50);
            foe.group.visible = false;
          }
        }
      }
      updateFoeRows();
      if (battle.foes.every(f => f.dead)) endBattle(true);
    }
    spawnSparkles(blob.group.position, 0xffff00, 80);
    playThud(1.5);
    flashScreen();
  }, 900);
}

function doBeam() {
  // rapid-fire fan of fruit in facing direction (or aimed at foes in battle)
  const yaw = blob.group.rotation.y;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  const kinds = ['strawberry', 'blueberry', 'orange', 'grape'];
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      const origin = new THREE.Vector3(
        blob.physBody.position.x,
        blob.physBody.position.y + 0.6,
        blob.physBody.position.z
      );
      const spread = (Math.random() - 0.5) * 0.6;
      const k = kinds[i % 4];
      if (battle.active) {
        const foe = pickNearestFoe();
        const aimX = foe ? foe.physBody.position.x : origin.x + dx * 10;
        const aimZ = foe ? foe.physBody.position.z : origin.z + dz * 10;
        const ddx = aimX - origin.x + spread * 2;
        const ddz = aimZ - origin.z + spread * 2;
        const horiz = Math.hypot(ddx, ddz) || 1;
        const dir = new THREE.Vector3(ddx / horiz * 22, 6, ddz / horiz * 22);
        spawnDamageFruit(k, origin, dir, 10 + Math.floor(Math.random() * 8));
      } else {
        const dir = new THREE.Vector3(dx + spread, 0.35, dz + spread).normalize();
        spawnFruit(k, origin, dir);
      }
      playToss(k);
    }, i * 70);
  }
}

function doHug() {
  spawnSparkles(blob.group.position, 0xff8aa8, 120);
  spawnSparkles(blob.group.position, 0xffaadd, 80);
  blob.squish = 0.8;
  blob.bounceTime = 1.5;
  playHappy();
  if (battle.active) {
    battle.playerHP = Math.min(battle.playerHPMax, battle.playerHP + 50);
    updatePlayerHP();
  }
}

for (const el of powerEls) {
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    tryPower(el.dataset.power);
  });
}

// ---------- keyboard + mobile controls ----------
const keys = { up: false, down: false, left: false, right: false };
let spaceWasDown = false;

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W': keys.up = true; e.preventDefault(); break;
    case 'ArrowDown': case 's': case 'S': keys.down = true; e.preventDefault(); break;
    case 'ArrowLeft': case 'a': case 'A': keys.left = true; e.preventDefault(); break;
    case 'ArrowRight': case 'd': case 'D': keys.right = true; e.preventDefault(); break;
    case ' ':
      if (!spaceWasDown) doSpacebarAttack();
      spaceWasDown = true;
      e.preventDefault();
      break;
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W': keys.up = false; break;
    case 'ArrowDown': case 's': case 'S': keys.down = false; break;
    case 'ArrowLeft': case 'a': case 'A': keys.left = false; break;
    case 'ArrowRight': case 'd': case 'D': keys.right = false; break;
    case ' ': spaceWasDown = false; break;
  }
});

function applyKeyboard(dt) {
  let dx = 0, dz = 0;
  if (keys.up) dz -= 1;
  if (keys.down) dz += 1;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;
    const speed = 9 * (blob.speedMult || 1);
    blob.physBody.velocity.x = dx * speed;
    blob.physBody.velocity.z = dz * speed;
    blob.bounceCooldown = (blob.bounceCooldown ?? 0) - dt;
    if (blob.physBody.position.y < 1.15 && blob.bounceCooldown <= 0) {
      blob.physBody.velocity.y = 5.5 * (blob.jumpMult || 1);
      blob.bounceCooldown = 0.45;
      blob.squish = 0.55;
    }
    blob.manualMove = true;
    blob._lookTarget = null;
    if (battle.active) battle.moveTarget = null; // cancel tap-target
    return true;
  }
  blob.manualMove = false;
  return false;
}

function doSpacebarAttack() {
  if (battle.active) {
    doPlayerAttack('quick');
  } else {
    // toss the currently-selected tool forward
    if (!hasInteracted) { hasInteracted = true; helpEl.classList.remove('show'); }
    const yaw = blob.group.rotation.y;
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    const origin = new THREE.Vector3(
      blob.physBody.position.x,
      blob.physBody.position.y + 0.5,
      blob.physBody.position.z
    );
    const dir = new THREE.Vector3(dx, 0.45, dz).normalize();
    if (selectedTool === 'block') {
      spawnBlock(origin, dir);
      playBlockToss();
    } else {
      spawnFruit(selectedTool, origin, dir);
      playToss(selectedTool);
      snackCount++;
      snacksEl.textContent = FRUITS[selectedTool].emoji + ' ' + snackCount;
    }
  }
}

// on-screen D-pad + attack (mobile-friendly, drive the same keys state)
const dpadBtns = document.querySelectorAll('.dbtn');
function setDpadKey(dir, down) {
  if (dir === 'up') keys.up = down;
  else if (dir === 'down') keys.down = down;
  else if (dir === 'left') keys.left = down;
  else if (dir === 'right') keys.right = down;
}
for (const btn of dpadBtns) {
  const dir = btn.dataset.dir;
  const down = (e) => { e.preventDefault(); e.stopPropagation(); setDpadKey(dir, true); };
  const up   = (e) => { e.preventDefault(); setDpadKey(dir, false); };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointerleave', up);
  btn.addEventListener('pointercancel', up);
}
const screenAtk = document.getElementById('screen-attack');
if (screenAtk) {
  screenAtk.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    doSpacebarAttack();
  });
}

// show the keys hint when the game starts; hide on first movement
const keysHintEl = document.getElementById('keys-hint');
function showKeysHint() {
  keysHintEl.classList.add('show');
  setTimeout(() => keysHintEl.classList.remove('show'), 6000);
}

// ---------- pokemon cards ----------
const CARD_POKEMON = [
  { name: 'Flameblob',  color: 0xff4422, emoji: '🔥', speedMult: 1.4, jumpMult: 1.2 },
  { name: 'Aquablob',   color: 0x44aaff, emoji: '💧', speedMult: 1.5, jumpMult: 1.0 },
  { name: 'Sparkblob',  color: 0xffee44, emoji: '⚡', speedMult: 1.2, jumpMult: 1.8 },
  { name: 'Leafblob',   color: 0x66dd44, emoji: '🌿', speedMult: 1.1, jumpMult: 1.1 },
  { name: 'Dragonling', color: 0x9944ff, emoji: '🐉', speedMult: 1.3, jumpMult: 1.4 },
  { name: 'Cosmix',     color: 0xff44aa, emoji: '🌟', speedMult: 1.6, jumpMult: 1.6, cosmic: true },
];

function makeCardEmojiTexture(emoji) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, 0, 128, 128);
  ctx.font = '96px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const cardEmojiCache = {};
function getCardEmojiTex(emoji) {
  if (!cardEmojiCache[emoji]) cardEmojiCache[emoji] = makeCardEmojiTexture(emoji);
  return cardEmojiCache[emoji];
}

function makeCard(pokemon, pos) {
  const g = new THREE.Group();
  // glowing border (slightly bigger)
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 1.35, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 })
  );
  g.add(border);
  // card body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.2, 0.06),
    new THREE.MeshStandardMaterial({ color: pokemon.color, emissive: pokemon.color, emissiveIntensity: 0.5, roughness: 0.4 })
  );
  body.position.z = 0.02;
  g.add(body);
  // emoji label both sides
  const tex = getCardEmojiTex(pokemon.emoji);
  for (const side of [-1, 1]) {
    const lbl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    lbl.position.z = 0.07 * side;
    if (side < 0) lbl.rotation.y = Math.PI;
    g.add(lbl);
  }
  g.position.set(pos.x, 1.4, pos.z);
  g.userData.basePos = g.position.clone();
  g.userData.pokemon = pokemon;
  g.userData.collected = false;
  scene.add(g);
  return g;
}

const playgroundCards = [];
const battleCards = [];

function spawnPlaygroundCards() {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 9;
    const pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const poke = CARD_POKEMON[i % CARD_POKEMON.length];
    playgroundCards.push(makeCard(poke, pos));
  }
}
spawnPlaygroundCards();

function spawnBattleCards() {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
    const r = 4 + Math.random() * 5;
    const pos = new THREE.Vector3(Math.cos(a) * r + 2, 0, Math.sin(a) * r);
    const poke = CARD_POKEMON[Math.floor(Math.random() * CARD_POKEMON.length)];
    battleCards.push(makeCard(poke, pos));
  }
}

function clearBattleCards() {
  for (const c of battleCards) scene.remove(c);
  battleCards.length = 0;
}

// ---------- transformation state ----------
let transformTimer = 0;
let transformPokemon = null;
const transformBadge = document.getElementById('transform-badge');

function transformInto(pokemon) {
  transformPokemon = pokemon;
  transformTimer = 22;
  blob.targetColor = new THREE.Color(pokemon.color);
  blob.speedMult = pokemon.speedMult || 1.2;
  blob.jumpMult = pokemon.jumpMult || 1.2;
  if (pokemon.cosmic) blob.cosmic = true;
  spawnSparkles(blob.group.position, pokemon.color, 80);
  flashScreen();
  playEvolve();
  transformBadge.innerHTML = `${pokemon.emoji} ${pokemon.name}!`;
  transformBadge.classList.add('show');
}

function tickTransform(dt) {
  if (transformTimer <= 0) return;
  transformTimer -= dt;
  transformBadge.innerHTML = `${transformPokemon.emoji} ${transformPokemon.name} (${Math.ceil(transformTimer)}s)`;
  if (transformTimer <= 0) {
    blob.speedMult = 1;
    blob.jumpMult = 1;
    // revert cosmic flag based on real stage (so 5/6 keeps cycling)
    blob.cosmic = blob.stage >= 5;
    transformBadge.classList.remove('show');
    transformPokemon = null;
  }
}

function tickCards(dt) {
  const active = battle.active ? battleCards : playgroundCards;
  for (let i = active.length - 1; i >= 0; i--) {
    const c = active[i];
    // bob + rotate
    c.rotation.y += dt * 1.6;
    c.position.y = c.userData.basePos.y + Math.sin(performance.now() * 0.003 + i) * 0.18;
    // pickup check
    if (c.userData.collected) continue;
    const d = Math.hypot(
      c.position.x - blob.physBody.position.x,
      c.position.z - blob.physBody.position.z
    );
    if (d < 1.4) {
      c.userData.collected = true;
      transformInto(c.userData.pokemon);
      scene.remove(c);
      active.splice(i, 1);
    }
  }
}

// ---------- resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  if (battle.active) {
    camera.fov = (window.innerWidth < window.innerHeight) ? 75 : 60;
  } else {
    camera.fov = 55;
  }
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- loop ----------
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  world.step(1 / 60, dt, 3);

  // sync fruit + blocks + poops visuals
  for (const f of fruits) {
    f.mesh.position.copy(f.physBody.position);
    f.mesh.quaternion.copy(f.physBody.quaternion);
  }
  for (const b of blocks) {
    b.mesh.position.copy(b.physBody.position);
    b.mesh.quaternion.copy(b.physBody.quaternion);
  }
  for (const p of poops) {
    p.mesh.position.copy(p.physBody.position);
    p.mesh.quaternion.copy(p.physBody.quaternion);
  }

  // cull fallen-off-world items
  for (let i = fruits.length - 1; i >= 0; i--) {
    if (fruits[i].physBody.position.y < -10) {
      scene.remove(fruits[i].mesh);
      world.removeBody(fruits[i].physBody);
      fruits.splice(i, 1);
    }
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].physBody.position.y < -10) {
      scene.remove(blocks[i].mesh);
      world.removeBody(blocks[i].physBody);
      blocks.splice(i, 1);
      blockCount--;
      blocksEl.textContent = '🧱 ' + blockCount;
    }
  }
  for (let i = poops.length - 1; i >= 0; i--) {
    if (poops[i].physBody.position.y < -10) {
      scene.remove(poops[i].mesh);
      world.removeBody(poops[i].physBody);
      poops.splice(i, 1);
    }
  }

  if (!battle.active) {
    applyKeyboard(dt);
    blob.update(dt, fruits);
    blob.checkEat(fruits, (f) => {
      playEat(f.kind);
      fruitsEaten++;
      tryEvolve();
    });

    // blob hum: louder + higher when moving fast (chasing fruit)
    const bv = blob.physBody.velocity;
    const horizSpeed = Math.hypot(bv.x, bv.z);
    setBlobHum(Math.min(1, horizSpeed / 7));
    setBlobHumPitch(220 + Math.min(140, horizSpeed * 18));

    // camera follows blob loosely if user is driving it
    const t = performance.now() * 0.00015;
    const baseX = blob.manualMove ? blob.physBody.position.x * 0.35 : Math.sin(t) * 1.2;
    camera.position.x += (baseX - camera.position.x) * Math.min(1, dt * 1.5);
    camera.lookAt(blob.manualMove ? blob.physBody.position.x * 0.5 : 0, 1.2, 0);
  } else {
    // real-time battle: keyboard, tap target, foe AI, contact damage
    const kbMoved = applyKeyboard(dt);
    if (!kbMoved) tickMovement(blob, battle.moveTarget, dt, 9 * (blob.speedMult || 1));
    // stop at target
    if (battle.moveTarget) {
      const dx = battle.moveTarget.x - blob.physBody.position.x;
      const dz = battle.moveTarget.z - blob.physBody.position.z;
      if (Math.hypot(dx, dz) < 0.6) battle.moveTarget = null;
    }
    for (const foe of battle.foes) {
      if (foe.dead) continue;
      tickFoeAI(foe, dt);
    }
    checkContactDamage(dt);
    tickProjectiles(dt);

    // visuals
    blob._lookTarget = battle.moveTarget;
    updateBlobVisualOnly(blob, dt);
    for (const foe of battle.foes) {
      if (foe.dead) continue;
      updateBlobVisualOnly(foe, dt);
    }
    setBlobHum(0);

    // move-target ring follows tap point + pulses
    if (battle.moveTarget) {
      moveRing.visible = true;
      moveRing.position.set(battle.moveTarget.x, 0.05, battle.moveTarget.z);
      const pulse = 1 + Math.sin(performance.now() * 0.012) * 0.15;
      moveRing.scale.setScalar(pulse);
      moveRing.material.opacity = 0.5 + Math.sin(performance.now() * 0.012) * 0.25;
    } else {
      moveRing.visible = false;
    }

    // camera follows player loosely (over-the-shoulder feel)
    const tx = blob.physBody.position.x;
    const camTargetX = tx * 0.4;
    camera.position.x += (camTargetX - camera.position.x) * Math.min(1, dt * 1.5);
    camera.lookAt(tx * 0.5 + 0.5, 1.5, 0);
  }

  updateSparkles(dt);
  tickCards(dt);
  tickTransform(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
