/**
 * Ganesh: Modak Run - Main Game Engine & Loop
 * Orchestrates Three.js rendering, camera follow, physics collisions,
 * scoring, combos, tutorial prompts, and state transitions.
 */

class ModakRunGame {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.state = 'menu'; // 'menu', 'playing', 'paused', 'gameover'

    // Scoring & Stats
    this.score = 0;
    this.distance = 0;
    this.modaks = 0;
    this.comboCount = 0;
    this.multiplier = 1.0;

    // Camera shake
    this.cameraShake = 0;

    // Tutorial flag
    this.tutorialStepsShown = {};

    this.initThree();
    this.initComponents();
    this.initLoop();
  }

  initThree() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a0d18);

    // Fog (warm temple twilight)
    this.fogTemple = new THREE.Fog(0x38101e, 35, 120);
    this.fogStreet = new THREE.Fog(0x1f0b24, 35, 120);
    this.fogKailash = new THREE.Fog(0x1a2a3a, 40, 130);
    this.scene.fog = this.fogTemple;

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      400
    );
    this.camera.position.set(0, 4.0, 7.5);

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0xffeedd, 0.75);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3d6, 1.2);
    this.sunLight.position.set(15, 35, 20);
    this.scene.add(this.sunLight);

    // Warm saffron rim light
    this.rimLight = new THREE.DirectionalLight(0xff9900, 0.55);
    this.rimLight.position.set(-15, 20, -25);
    this.scene.add(this.rimLight);

    // Window resize handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initComponents() {
    this.modelGen = new ModelGenerator();
    this.particles = new ParticleEngine(this.scene);
    this.track = new TrackManager(this.scene, this.modelGen);
    this.player = new PlayerController(this.scene, this.modelGen);
    this.chaser = new ChaserAI(this.scene, this.modelGen);
    this.abilityManager = new AbilityManager(this.player, this.particles);
    this.ui = new UIManager(this);

    // Apply saved outfit to player
    if (this.ui.selectedOutfit) {
      this.player.setOutfit(this.ui.selectedOutfit);
    }

    // Build initial track chunks
    this.track.initTrack();
  }

  startRun() {
    this.score = 0;
    this.distance = 0;
    this.modaks = 0;
    this.comboCount = 0;
    this.multiplier = 1.0;
    this.cameraShake = 0;
    this.tutorialStepsShown = {};

    this.track.reset();
    this.player.reset();
    this.chaser.reset();
    this.abilityManager.reset();

    this.state = 'playing';
    this.ui.showHUD();
    this.ui.updateHUD(0, 1.0, 0, 0);
    this.ui.updateChaseMeter(this.chaser.getDistance());

    if (window.gameAudio) {
      window.gameAudio.ensureContext();
      window.gameAudio.startBgm();
      window.gameAudio.playTempleBell(1046.5, 1.2);
    }
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.ui.showPauseMenu();
      if (window.gameAudio) window.gameAudio.stopBgm();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.ui.hidePauseMenu();
      if (window.gameAudio) window.gameAudio.startBgm();
    }
  }

  onPlayerStumble() {
    this.cameraShake = 0.35;
    this.comboCount = 0;
    this.chaser.onPlayerStumble();
    this.ui.updateChaseMeter(this.chaser.getDistance());
  }

  collectModak(modakObj) {
    modakObj.collected = true;
    this.scene.remove(modakObj.mesh);

    const pos = modakObj.mesh.position;
    this.particles.burstModak(pos);
    if (window.gameAudio) window.gameAudio.playModakCollect();

    this.modaks++;
    this.comboCount++;

    // Calculate score points
    const multBuff = this.abilityManager.isMultiplierActive() ? 2.0 : 1.0;
    const points = 50 * this.multiplier * multBuff;
    this.score += points;

    // Ganesha pulls ahead of Parvati when collecting modaks
    this.chaser.onPlayerStreakBonus(0.4);

    // Combo milestones
    if (this.comboCount === 10) {
      this.score += 500;
      this.multiplier = Math.min(4.0, this.multiplier + 0.2);
      this.ui.showCombo(10);
      if (window.gameAudio) window.gameAudio.playTempleBell(1318.5, 0.8);
    } else if (this.comboCount === 25) {
      this.score += 1500;
      this.multiplier = Math.min(4.0, this.multiplier + 0.5);
      this.ui.showCombo(25);
      if (window.gameAudio) window.gameAudio.playTempleBell(1567.9, 0.9);
    } else if (this.comboCount === 50) {
      this.score += 4000;
      this.multiplier = Math.min(5.0, this.multiplier + 1.0);
      this.ui.showCombo(50);
      // Instant ability recharge bonus!
      this.abilityManager.activate('speed');
    }
  }

  handleCollisions() {
    const pPos = this.player.getPosition();
    const pCol = this.player.collider;

    // 1. Modak Collections
    const magnetActive = this.player.hasMagnet;
    const collectRadius = magnetActive ? 9.5 : 1.15;

    for (let i = 0; i < this.track.activeModaks.length; i++) {
      const m = this.track.activeModaks[i];
      if (m.collected) continue;

      const mPos = m.mesh.position;
      const dz = mPos.z - pPos.z;
      const dx = mPos.x - pPos.x;
      const dy = mPos.y - pPos.y;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Magnet attraction
      if (magnetActive && distSq < 90) {
        mPos.x += (pPos.x - mPos.x) * 0.18;
        mPos.y += (pPos.y + 0.8 - mPos.y) * 0.18;
        mPos.z += (pPos.z - mPos.z) * 0.18;
      }

      if (distSq < collectRadius * collectRadius) {
        this.collectModak(m);
      }
    }

    // 2. Obstacle Collisions
    if (this.player.invulnerableTimer > 0) return;

    for (let i = 0; i < this.track.activeObstacles.length; i++) {
      const obs = this.track.activeObstacles[i];
      if (obs.hit) continue;

      const mesh = obs.mesh;
      const oPos = mesh.position;
      const u = mesh.userData;
      const boxSize = u.boxSize || new THREE.Vector3(1.5, 1.5, 1.0);

      // Check Z overlap
      const zDiff = Math.abs(pPos.z - oPos.z);
      if (zDiff < (boxSize.z / 2 + 0.45)) {
        // Check X overlap
        const xDiff = Math.abs(pPos.x - oPos.x);
        if (xDiff < (boxSize.x / 2 + 0.35)) {
          // Check Y & specific obstacle type clearance
          let isHit = false;

          if (obs.type === 'jump') {
            // Fallen Log: If player's feet y are below log top (0.55m), collision!
            if (pPos.y < oPos.y + 0.5) {
              isHit = true;
            }
          } else if (obs.type === 'slide') {
            // Low Toran: If player is NOT sliding, collision with upper banner!
            if (!this.player.isSliding) {
              isHit = true;
            }
          } else if (obs.type === 'puddle') {
            // Water Puddle: slight stumble/slowdown
            this.particles.burstDust(pPos);
            this.player.speed = Math.max(10.0, this.player.speed * 0.85);
            obs.hit = true;
          } else {
            // Dodge obstacles (Stone pillars, Dholak)
            isHit = true;
          }

          if (isHit) {
            obs.hit = true;

            // Check abilities
            if (this.abilityManager.isVighnaActive() || this.abilityManager.isSpeedBoostActive()) {
              // Smashed through obstacle!
              this.particles.burstPetals(oPos);
              if (window.gameAudio) window.gameAudio.playVighnaBreak();
              this.scene.remove(mesh);
            } else if (this.player.hasShield) {
              // Shield absorbed hit!
              this.abilityManager.breakShield();
              this.particles.burstPetals(oPos);
              this.scene.remove(mesh);
            } else {
              // Stumble & Parvati penalty!
              this.player.stumble();
              this.onPlayerStumble();
            }
          }
        }
      }
    }
  }

  checkTutorialPrompts() {
    if (this.distance > 20 && !this.tutorialStepsShown[1]) {
      this.tutorialStepsShown[1] = true;
      this.ui.showTutorialStep('👈👉', 'Use A / D, Arrow Keys, or Swipe Left/Right to switch lanes!');
    } else if (this.distance > 80 && !this.tutorialStepsShown[2]) {
      this.tutorialStepsShown[2] = true;
      this.ui.showTutorialStep('⬆️', 'Jump over fallen logs using W, Up Arrow, Space, or Swipe Up!');
    } else if (this.distance > 150 && !this.tutorialStepsShown[3]) {
      this.tutorialStepsShown[3] = true;
      this.ui.showTutorialStep('⬇️', 'Slide under low festive torans using S, Down Arrow, or Swipe Down!');
    } else if (this.distance > 220 && !this.tutorialStepsShown[4]) {
      this.tutorialStepsShown[4] = true;
      this.ui.showTutorialStep('🪔', 'Keep running smoothly to stay joyously ahead of Maa Parvati!');
    } else if (this.distance > 290 && !this.tutorialStepsShown[5]) {
      this.tutorialStepsShown[5] = true;
      this.ui.showTutorialStep('⚡', 'Activate Divine Abilities via keys 1-5 or bottom hotbar buttons!');
    }
  }

  updateCamera(dt) {
    const p = this.player;

    // Follow camera targets (optimized for lane & obstacle visibility)
    const targetX = p.x * 0.65;
    const targetY = p.y + 3.8;
    const targetZ = p.z + 6.2;

    this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1.0, 10.0 * dt);
    this.camera.position.y += (targetY - this.camera.position.y) * Math.min(1.0, 8.0 * dt);
    this.camera.position.z += (targetZ - this.camera.position.z) * Math.min(1.0, 14.0 * dt);

    // Camera shake calculation
    if (this.cameraShake > 0) {
      this.cameraShake -= dt * 1.5;
      const shakeAmt = Math.max(0, this.cameraShake) * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
    }

    // Look down the track ahead of Ganesha
    const lookTarget = new THREE.Vector3(
      p.x * 0.25,
      p.y + 0.9,
      p.z - 11.0
    );
    this.camera.lookAt(lookTarget);
  }

  updateFog() {
    // Biome fog color blending
    if (this.track.biome === 0) {
      this.scene.fog = this.fogTemple;
      this.scene.background.setHex(0x2a0d18);
    } else if (this.track.biome === 1) {
      this.scene.fog = this.fogStreet;
      this.scene.background.setHex(0x190820);
    } else {
      this.scene.fog = this.fogKailash;
      this.scene.background.setHex(0x132230);
    }
  }

  gameOver() {
    this.state = 'gameover';
    if (window.gameAudio) {
      window.gameAudio.stopBgm();
      window.gameAudio.playGameOver();
    }

    // Save stats & check high score
    const isNewBest = this.ui.saveRunStats(this.score, this.distance, this.modaks);

    this.ui.showGameOver({
      score: this.score,
      distance: this.distance,
      modaks: this.modaks,
      isNewBest
    });
  }

  initLoop() {
    let lastTime = performance.now();

    const loop = (currentTime) => {
      requestAnimationFrame(loop);

      const dt = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      if (this.state === 'playing') {
        // Distance & distance score
        this.distance = Math.abs(this.player.z);
        const speedBonus = this.player.speed * dt * 8 * this.multiplier;
        this.score += speedBonus;

        // Update subsystems
        this.player.update(dt, this.track, this.particles);
        this.chaser.update(dt, this.player, this.track);
        this.track.update(this.player.z, this.distance);
        this.abilityManager.update(dt);
        this.particles.update(dt, this.player.getPosition());

        // Collisions & Pickups
        this.handleCollisions();

        // Tutorial checks
        this.checkTutorialPrompts();

        // Camera follow
        this.updateCamera(dt);
        this.updateFog();

        // Update UI HUD
        this.ui.updateHUD(this.score, this.multiplier, this.distance, this.modaks);
        this.ui.updateChaseMeter(this.chaser.getDistance());

        // Check if Maa Parvati caught up
        if (this.chaser.isCaught()) {
          this.gameOver();
        }
      } else {
        // Idle camera motion or particle update in menu
        this.particles.update(dt);
      }

      this.renderer.render(this.scene, this.camera);
    };

    requestAnimationFrame(loop);
  }
}

// Start game instance once DOM is loaded
function initGame() {
  if (!window.game) {
    window.game = new ModakRunGame();
  }
}
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}