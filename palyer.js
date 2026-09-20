/**
 * Ganesh: Modak Run - Player Controller (Lord Ganesha)
 * Handles 3-lane movement, jumping physics, sliding duck, procedural running animations,
 * collision bounding, modak collection, and visual abilities.
 */

class PlayerController {
  constructor(scene, modelGen) {
    this.scene = scene;
    this.modelGen = modelGen;

    this.laneWidth = 2.4;
    this.lanes = [-this.laneWidth, 0, this.laneWidth];
    this.laneIdx = 1; // Start in middle lane (0)

    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.targetX = 0;

    // Movement physics
    this.baseSpeed = 14.0;
    this.speed = 14.0;
    this.maxSpeed = 24.0;
    this.speedMultiplier = 1.0;

    this.vy = 0;
    this.gravity = -34.0;
    this.jumpForce = 12.2;
    this.isGrounded = true;

    // Sliding state
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = 0.75;

    // Stumble / Invulnerability state
    this.isStumbling = false;
    this.stumbleTimer = 0;
    this.invulnerableTimer = 0;

    // Active buffs
    this.hasShield = false;
    this.hasMagnet = false;
    this.hasVighna = false;
    this.hasSpeedBoost = false;

    // Animation time
    this.animTime = 0;

    // Outfits
    this.currentOutfit = 'pitambari';
    this.mesh = this.modelGen.createGanesha(this.currentOutfit);
    this.scene.add(this.mesh);

    // Bounding dimensions
    this.collider = new THREE.Box3();
  }

  setOutfit(outfitKey) {
    this.currentOutfit = outfitKey;
    const oldPos = this.mesh.position.clone();
    this.scene.remove(this.mesh);
    this.mesh = this.modelGen.createGanesha(outfitKey);
    this.mesh.position.copy(oldPos);
    this.scene.add(this.mesh);
  }

  moveLeft() {
    if (this.laneIdx > 0) {
      this.laneIdx--;
      this.targetX = this.lanes[this.laneIdx];
      return true;
    }
    return false;
  }

  moveRight() {
    if (this.laneIdx < 2) {
      this.laneIdx++;
      this.targetX = this.lanes[this.laneIdx];
      return true;
    }
    return false;
  }

  jump() {
    if (this.isGrounded && !this.isStumbling) {
      this.vy = this.jumpForce;
      this.isGrounded = false;
      this.isSliding = false;
      if (window.gameAudio) window.gameAudio.playJump();
      return true;
    }
    return false;
  }

  slide() {
    if (!this.isSliding && !this.isStumbling) {
      this.isSliding = true;
      this.slideTimer = this.slideDuration;
      // If sliding while in air, dive down quickly
      if (!this.isGrounded) {
        this.vy = -18.0;
      }
      if (window.gameAudio) window.gameAudio.playSlide();
      return true;
    }
    return false;
  }

  stumble() {
    this.isStumbling = true;
    this.stumbleTimer = 0.55;
    this.invulnerableTimer = 1.4;
    this.speed = Math.max(this.baseSpeed * 0.65, this.speed * 0.7);
    if (window.gameAudio) window.gameAudio.playObstacleHit();
  }

  update(dt, trackManager, particles) {
    // Progressive forward speed acceleration based on distance
    const dist = Math.abs(this.z);
    this.speed = Math.min(this.maxSpeed, this.baseSpeed + (dist / 100) * 0.6) * this.speedMultiplier;

    // Stumble timer
    if (this.isStumbling) {
      this.stumbleTimer -= dt;
      if (this.stumbleTimer <= 0) {
        this.isStumbling = false;
      }
    }
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }

    // Forward run movement
    this.z -= this.speed * dt;

    // Lateral lane interpolation (snappy, responsive)
    const dx = this.targetX - this.x;
    this.x += dx * Math.min(1.0, 18.0 * dt);

    // Get track surface elevation at current z
    const groundY = trackManager.getTrackHeightAtZ(this.z);

    // Jump & gravity physics
    if (!this.isGrounded) {
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;

      if (this.y <= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.isGrounded = true;
        if (particles) particles.burstDust(this.getPosition());
      }
    } else {
      this.y = groundY;
    }

    // Slide duration timer
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (particles && Math.random() < 0.3) {
        particles.burstDust(this.getPosition());
      }
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // Update Mesh world position
    this.mesh.position.set(this.x, this.y, this.z);

    // Banking tilt when lane changing and forward facing orientation
    const tilt = (this.targetX - this.x) * 0.12;
    this.mesh.rotation.z = -tilt;
    this.mesh.rotation.y = Math.PI;

    // Procedural Running / Jumping / Sliding Skeletal Animations
    this.updateAnimations(dt);

    // Visual Aura (Divine Shield or Powerups)
    if (this.mesh.userData.aura) {
      const showAura = this.hasShield || this.hasVighna || this.hasSpeedBoost;
      this.mesh.userData.aura.material.opacity = showAura ? 0.75 : 0.0;
      if (showAura) {
        this.mesh.userData.aura.rotation.z += dt * 4;
        if (particles && this.hasShield && Math.random() < 0.2) {
          particles.spawnShieldAura(this.getPosition());
        }
      }
    }

    // Update AABB Collider
    this.updateCollider();
  }

  updateAnimations(dt) {
    const u = this.mesh.userData;
    if (!u) return;

    if (this.isGrounded && !this.isSliding) {
      // Normal Running Stride Loop
      this.animTime += dt * (this.speed * 0.85);

      // Legs stride
      const legAngle = Math.sin(this.animTime) * 0.65;
      u.legL.rotation.x = legAngle;
      u.legR.rotation.x = -legAngle;

      // Arms counter-swing
      u.armL.rotation.x = -legAngle * 0.5;
      u.armR.rotation.x = legAngle * 0.65;

      // Large ears gentle flap
      const earFlap = Math.sin(this.animTime * 0.8) * 0.2;
      u.earL.rotation.y = earFlap;
      u.earR.rotation.y = -earFlap;

      // Elephant trunk sway
      const trunkSway = Math.sin(this.animTime * 0.9) * 0.18;
      u.trunk.rotation.z = trunkSway;
      u.trunk.rotation.x = Math.sin(this.animTime * 1.8) * 0.08;

      // Joyful torso running bounce
      const bounce = Math.abs(Math.sin(this.animTime)) * 0.08;
      u.torso.position.y = 0.95 + bounce;
      u.torso.rotation.x = 0.12; // Athletic forward lean
      u.torso.rotation.z = Math.sin(this.animTime) * 0.04;

    } else if (!this.isGrounded) {
      // In Air / Jumping Pose
      u.legL.rotation.x = 0.45; // Tucked legs
      u.legR.rotation.x = 0.35;
      u.armL.rotation.x = -0.7; // Arms raised joyfully
      u.armR.rotation.x = -0.7;
      u.trunk.rotation.x = -0.35; // Trunk pointing up
      u.earL.rotation.y = 0.3;
      u.earR.rotation.y = -0.3;
      u.torso.position.y = 0.95;
      u.torso.rotation.x = -0.15; // Upward leap arc

    } else if (this.isSliding) {
      // Sliding / Ducking Pose
      u.legL.rotation.x = -1.2; // Legs slid forward
      u.legR.rotation.x = -1.1;
      u.armL.rotation.x = 0.8;
      u.armR.rotation.x = 0.8;
      u.trunk.rotation.x = 0.4;
      u.torso.position.y = 0.52; // Low profile ducking
      u.torso.rotation.x = 0.85; // Low forward slide lean
    }
  }

  updateCollider() {
    // When sliding, collider height is significantly lower
    const colHeight = this.isSliding ? 0.75 : 1.75;
    const halfWidth = 0.45;
    const halfDepth = 0.45;

    this.collider.min.set(
      this.x - halfWidth,
      this.y,
      this.z - halfDepth
    );
    this.collider.max.set(
      this.x + halfWidth,
      this.y + colHeight,
      this.z + halfDepth
    );
  }

  getPosition() {
    return { x: this.x, y: this.y, z: this.z };
  }

  reset() {
    this.laneIdx = 1;
    this.x = this.lanes[1];
    this.targetX = this.x;
    this.y = 0;
    this.z = 0;
    this.vy = 0;
    this.speed = this.baseSpeed;
    this.speedMultiplier = 1.0;
    this.isGrounded = true;
    this.isSliding = false;
    this.isStumbling = false;
    this.invulnerableTimer = 0;
    this.hasShield = false;
    this.hasMagnet = false;
    this.hasVighna = false;
    this.hasSpeedBoost = false;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.set(0, 0, 0);
  }
}

window.PlayerController = PlayerController;