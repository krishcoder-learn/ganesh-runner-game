/**
 * Ganesh: Modak Run - Goddess Parvati Playful Chase AI
 * Respectful, loving, family-friendly chase mechanic.
 * Tracks distance, smoothly follows Ganesha's path, warns when close,
 * and triggers a friendly game-over if she catches up.
 */

class ChaserAI {
  constructor(scene, modelGen) {
    this.scene = scene;
    this.modelGen = modelGen;

    this.mesh = this.modelGen.createParvati();
    this.scene.add(this.mesh);

    // Distance metrics (in meters behind Ganesha)
    this.initialDistance = 24.0;
    this.distance = 24.0;
    this.minDistance = 0.0;
    this.maxDistance = 32.0;

    // Follower position
    this.x = 0;
    this.y = 0;
    this.z = this.initialDistance;

    this.animTime = 0;
    this.ghungrooTimer = 0;
  }

  onPlayerStumble() {
    // Player made a mistake: Parvati gets playfully closer!
    this.distance = Math.max(0, this.distance - 6.5);
    if (window.gameAudio) {
      window.gameAudio.playGhungroo(3);
    }
  }

  onPlayerStreakBonus(amount = 1.2) {
    // Good running, combos, or modak collection: Ganesha pulls ahead!
    this.distance = Math.min(this.maxDistance, this.distance + amount);
  }

  update(dt, player, trackManager) {
    // Gradually recover distance slowly if running cleanly
    if (!player.isStumbling) {
      this.distance = Math.min(this.maxDistance, this.distance + dt * 0.45);
    }

    // Parvati's position is relative to player's forward progress
    this.z = player.z + this.distance;

    // Smoothly follow player's lane with a soft, natural delay
    this.x += (player.x - this.x) * Math.min(1.0, 5.0 * dt);

    // Match ground track elevation at Parvati's z
    this.y = trackManager.getTrackHeightAtZ(this.z);

    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = Math.PI;

    // Procedural graceful running animation
    this.animTime += dt * 10;
    const u = this.mesh.userData;
    if (u) {
      // Gentle arm swing & running posture
      u.armR.rotation.x = Math.sin(this.animTime) * 0.45;
      u.armL.rotation.x = -Math.sin(this.animTime) * 0.25; // Holding thali steadily
      u.body.position.y = 1.0 + Math.abs(Math.sin(this.animTime)) * 0.06;
      u.body.rotation.z = (player.x - this.x) * 0.05;
    }

    // Ghungroo audio warning when close (<10m)
    if (this.distance < 10.0) {
      this.ghungrooTimer -= dt;
      if (this.ghungrooTimer <= 0) {
        if (window.gameAudio) window.gameAudio.playGhungroo(2);
        this.ghungrooTimer = 1.4;
      }
    }
  }

  getDistance() {
    return Math.max(0, this.distance);
  }

  isCaught() {
    return this.distance <= 1.0;
  }

  reset() {
    this.distance = this.initialDistance;
    this.x = 0;
    this.y = 0;
    this.z = this.initialDistance;
    this.ghungrooTimer = 0;
    this.mesh.position.set(0, 0, this.initialDistance);
  }
}

window.ChaserAI = ChaserAI;