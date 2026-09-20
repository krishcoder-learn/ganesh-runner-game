/**
 * Ganesh: Modak Run - UI, Input & Progression Manager
 * Handles HUD updates, modals, touch swipes, keyboard inputs,
 * outfits shop, and local storage data persistence.
 */

class UIManager {
  constructor(game) {
    this.game = game;

    // Progression data defaults
    this.highScore = parseInt(localStorage.getItem('ganesh_high_score') || '0', 10);
    this.maxDistance = parseInt(localStorage.getItem('ganesh_max_distance') || '0', 10);
    this.totalModaks = parseInt(localStorage.getItem('ganesh_total_modaks') || '0', 10);
    this.unlockedOutfits = JSON.parse(localStorage.getItem('ganesh_unlocked_outfits') || '["pitambari"]');
    this.selectedOutfit = localStorage.getItem('ganesh_selected_outfit') || 'pitambari';

    this.outfitsData = [
      { id: 'pitambari', name: 'Pitambari Gold', cost: 0, color: '#f1c40f', desc: 'Traditional sacred yellow dhoti' },
      { id: 'crimson', name: 'Royal Crimson', cost: 80, color: '#b71540', desc: 'Auspicious festive silk drape' },
      { id: 'kailash', name: 'Kailash White', cost: 200, color: '#ecf0f1', desc: 'Serene mountain silk drape' },
      { id: 'emerald', name: 'Peacock Emerald', cost: 400, color: '#10ac84', desc: 'Celebratory emerald vestment' }
    ];

    this.comboTimeout = null;
    this.tutorialTimeout = null;

    this.initDOM();
    this.initInputs();
    this.initOutfitsShop();
    this.loadSettings();
  }

  initDOM() {
    this.hud = document.getElementById('hud');
    this.scoreVal = document.getElementById('score-val');
    this.multiplierBadge = document.getElementById('multiplier-badge');
    this.distanceVal = document.getElementById('distance-val');
    this.modakVal = document.getElementById('modak-val');
    this.chaseDistVal = document.getElementById('chase-dist-val');
    this.chaseBarFill = document.getElementById('chase-bar-fill');
    this.chaseMeter = document.getElementById('chase-meter');
    this.comboContainer = document.getElementById('combo-container');
    this.comboText = document.getElementById('combo-text');
    this.tutorialBubble = document.getElementById('tutorial-bubble');
    this.tutorialText = document.getElementById('tutorial-text');
    this.touchControls = document.getElementById('touch-controls');

    // Modals
    this.menuMain = document.getElementById('menu-main');
    this.menuPause = document.getElementById('menu-pause');
    this.menuGameOver = document.getElementById('menu-gameover');
    this.menuHowToPlay = document.getElementById('menu-howtoplay');
    this.menuAbilities = document.getElementById('menu-abilities-codex');
    this.menuOutfits = document.getElementById('menu-outfits-shop');
    this.menuSettings = document.getElementById('menu-settings-modal');
    this.menuHighScores = document.getElementById('menu-highscores-modal');

    // Attach Main Menu Buttons
    document.getElementById('btn-play').addEventListener('click', () => this.game.startRun());
    document.getElementById('btn-tutorial').addEventListener('click', () => this.showModal('howtoplay'));
    document.getElementById('btn-abilities').addEventListener('click', () => this.showModal('abilities'));
    document.getElementById('btn-outfits').addEventListener('click', () => this.showModal('outfits'));
    document.getElementById('btn-highscores').addEventListener('click', () => this.showModal('highscores'));
    document.getElementById('btn-settings').addEventListener('click', () => this.showModal('settings'));

    // Pause Buttons
    document.getElementById('pause-btn').addEventListener('click', () => this.game.togglePause());
    document.getElementById('btn-resume').addEventListener('click', () => this.game.togglePause());
    document.getElementById('btn-restart-pause').addEventListener('click', () => {
      this.hideAllModals();
      this.game.startRun();
    });
    document.getElementById('btn-settings-pause').addEventListener('click', () => this.showModal('settings'));
    document.getElementById('btn-quit-pause').addEventListener('click', () => this.showMainMenu());

    // Game Over Buttons
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.hideAllModals();
      this.game.startRun();
    });
    document.getElementById('btn-menu-from-go').addEventListener('click', () => this.showMainMenu());

    // Close Modal Buttons
    document.getElementById('btn-close-howtoplay').addEventListener('click', () => this.closeActiveModal());
    document.getElementById('btn-close-abilities').addEventListener('click', () => this.closeActiveModal());
    document.getElementById('btn-close-outfits').addEventListener('click', () => this.closeActiveModal());
    document.getElementById('btn-close-settings').addEventListener('click', () => this.closeActiveModal());
    document.getElementById('btn-close-highscores').addEventListener('click', () => this.closeActiveModal());

    // Settings Sliders
    const bgmSlider = document.getElementById('setting-bgm');
    const sfxSlider = document.getElementById('setting-sfx');
    const touchCheck = document.getElementById('setting-touch');
    const resetBtn = document.getElementById('btn-reset-data');

    bgmSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (window.gameAudio) window.gameAudio.setBgmVolume(val);
      localStorage.setItem('ganesh_bgm_vol', val);
    });

    sfxSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (window.gameAudio) window.gameAudio.setSfxVolume(val);
      localStorage.setItem('ganesh_sfx_vol', val);
    });

    touchCheck.addEventListener('change', (e) => {
      this.touchControls.style.display = e.target.checked ? 'flex' : 'none';
      localStorage.setItem('ganesh_touch_ctrl', e.target.checked ? '1' : '0');
    });

    resetBtn.addEventListener('click', () => {
      if (confirm('Reset your high scores and progress?')) {
        localStorage.removeItem('ganesh_high_score');
        localStorage.removeItem('ganesh_max_distance');
        this.highScore = 0;
        this.maxDistance = 0;
        this.updateHighScoresModal();
        alert('High scores have been reset.');
      }
    });

    // Abilities Buttons
    ['magnet', 'shield', 'vighna', 'speed', 'mult'].forEach(id => {
      const btn = document.getElementById(`ability-btn-${id}`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (this.game.abilityManager) {
            this.game.abilityManager.activate(id);
          }
        });
      }
    });
  }

  initInputs() {
    // Keyboard listener
    window.addEventListener('keydown', (e) => {
      // Audio activation on first user gesture
      if (window.gameAudio) window.gameAudio.ensureContext();

      if (this.game.state === 'playing') {
        switch (e.key) {
          case 'ArrowLeft':
          case 'a':
          case 'A':
            this.game.player.moveLeft();
            break;
          case 'ArrowRight':
          case 'd':
          case 'D':
            this.game.player.moveRight();
            break;
          case 'ArrowUp':
          case 'w':
          case 'W':
          case ' ':
            e.preventDefault();
            this.game.player.jump();
            break;
          case 'ArrowDown':
          case 's':
          case 'S':
            e.preventDefault();
            this.game.player.slide();
            break;
          case '1':
            this.game.abilityManager.activate('magnet');
            break;
          case '2':
            this.game.abilityManager.activate('shield');
            break;
          case '3':
            this.game.abilityManager.activate('vighna');
            break;
          case '4':
            this.game.abilityManager.activate('speed');
            break;
          case '5':
            this.game.abilityManager.activate('mult');
            break;
          case 'Escape':
          case 'p':
          case 'P':
            this.game.togglePause();
            break;
        }
      } else if (this.game.state === 'paused' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) {
        this.game.togglePause();
      }
    });

    // Touch Swipe Gestures
    let touchStartX = 0;
    let touchStartY = 0;
    const canvas = document.getElementById('webgl-canvas');

    window.addEventListener('touchstart', (e) => {
      if (window.gameAudio) window.gameAudio.ensureContext();
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (this.game.state !== 'playing') return;
      if (e.changedTouches.length > 0) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const threshold = 30; // pixels

        if (Math.max(absX, absY) > threshold) {
          if (absX > absY) {
            // Horizontal swipe
            if (deltaX > 0) this.game.player.moveRight();
            else this.game.player.moveLeft();
          } else {
            // Vertical swipe
            if (deltaY < 0) this.game.player.jump();
            else this.game.player.slide();
          }
        }
      }
    }, { passive: true });

    // Touch on-screen buttons
    document.getElementById('touch-left').addEventListener('click', () => {
      if (this.game.state === 'playing') this.game.player.moveLeft();
    });
    document.getElementById('touch-right').addEventListener('click', () => {
      if (this.game.state === 'playing') this.game.player.moveRight();
    });
    document.getElementById('touch-jump').addEventListener('click', () => {
      if (this.game.state === 'playing') this.game.player.jump();
    });
    document.getElementById('touch-slide').addEventListener('click', () => {
      if (this.game.state === 'playing') this.game.player.slide();
    });
  }

  loadSettings() {
    const bgm = localStorage.getItem('ganesh_bgm_vol');
    if (bgm !== null) {
      document.getElementById('setting-bgm').value = bgm;
      if (window.gameAudio) window.gameAudio.setBgmVolume(parseFloat(bgm));
    }
    const sfx = localStorage.getItem('ganesh_sfx_vol');
    if (sfx !== null) {
      document.getElementById('setting-sfx').value = sfx;
      if (window.gameAudio) window.gameAudio.setSfxVolume(parseFloat(sfx));
    }
    const touch = localStorage.getItem('ganesh_touch_ctrl');
    if (touch === '1' || window.innerWidth < 768) {
      document.getElementById('setting-touch').checked = true;
      this.touchControls.style.display = 'flex';
    }
  }

  initOutfitsShop() {
    const grid = document.getElementById('outfit-grid');
    if (!grid) return;
    grid.innerHTML = '';
    document.getElementById('shop-modak-bank').textContent = this.totalModaks;

    this.outfitsData.forEach(outfit => {
      const isUnlocked = this.unlockedOutfits.includes(outfit.id);
      const isSelected = this.selectedOutfit === outfit.id;

      const card = document.createElement('div');
      card.className = `outfit-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="outfit-preview-circle" style="background-color: ${outfit.color};"></div>
        <div class="outfit-title">${outfit.name}</div>
        <div class="outfit-cost">
          ${isUnlocked ? (isSelected ? '✓ EQUIPPED' : 'UNLOCKED') : `🥟 ${outfit.cost} Modaks`}
        </div>
      `;

      card.addEventListener('click', () => {
        this.handleOutfitClick(outfit);
      });

      grid.appendChild(card);
    });
  }

  handleOutfitClick(outfit) {
    if (this.unlockedOutfits.includes(outfit.id)) {
      // Equip outfit
      this.selectedOutfit = outfit.id;
      localStorage.setItem('ganesh_selected_outfit', outfit.id);
      this.game.player.setOutfit(outfit.id);
      this.initOutfitsShop();
      if (window.gameAudio) window.gameAudio.playTempleBell(1108.73, 0.7);
    } else {
      // Try to unlock
      if (this.totalModaks >= outfit.cost) {
        this.totalModaks -= outfit.cost;
        localStorage.setItem('ganesh_total_modaks', this.totalModaks);
        this.unlockedOutfits.push(outfit.id);
        localStorage.setItem('ganesh_unlocked_outfits', JSON.stringify(this.unlockedOutfits));
        this.selectedOutfit = outfit.id;
        localStorage.setItem('ganesh_selected_outfit', outfit.id);
        this.game.player.setOutfit(outfit.id);
        this.initOutfitsShop();
        if (window.gameAudio) window.gameAudio.playVighnaBreak();
        alert(`Congratulations! You unlocked ${outfit.name}!`);
      } else {
        alert(`You need ${outfit.cost - this.totalModaks} more Modaks to unlock this divine outfit!`);
      }
    }
  }

  showModal(name) {
    this.hideAllModals();
    if (name === 'howtoplay') this.menuHowToPlay.classList.add('active');
    else if (name === 'abilities') this.menuAbilities.classList.add('active');
    else if (name === 'outfits') {
      this.initOutfitsShop();
      this.menuOutfits.classList.add('active');
    }
    else if (name === 'settings') this.menuSettings.classList.add('active');
    else if (name === 'highscores') {
      this.updateHighScoresModal();
      this.menuHighScores.classList.add('active');
    }
  }

  closeActiveModal() {
    this.hideAllModals();
    if (this.game.state === 'paused') {
      this.menuPause.classList.add('active');
    } else if (this.game.state === 'menu') {
      this.menuMain.classList.add('active');
    }
  }

  hideAllModals() {
    const modals = [
      this.menuMain, this.menuPause, this.menuGameOver,
      this.menuHowToPlay, this.menuAbilities, this.menuOutfits,
      this.menuSettings, this.menuHighScores
    ];
    modals.forEach(m => m.classList.remove('active'));
  }

  showMainMenu() {
    this.hideAllModals();
    this.hud.style.display = 'none';
    this.menuMain.classList.add('active');
    this.game.state = 'menu';
    if (window.gameAudio) window.gameAudio.stopBgm();
  }

  showHUD() {
    this.hideAllModals();
    this.hud.style.display = 'flex';
  }

  showPauseMenu() {
    this.menuPause.classList.add('active');
  }

  hidePauseMenu() {
    this.menuPause.classList.remove('active');
  }

  showGameOver(stats) {
    this.hideAllModals();
    this.hud.style.display = 'none';

    // Update stats
    document.getElementById('go-score').textContent = Math.floor(stats.score).toLocaleString();
    document.getElementById('go-best-score').textContent = this.highScore.toLocaleString();
    document.getElementById('go-distance').textContent = `${Math.floor(stats.distance)}m`;
    document.getElementById('go-modaks').textContent = stats.modaks.toLocaleString();

    // Motivational festive quote
    const quotes = [
      `"Keep running! Your next sweet Modak awaits."`,
      `"Maa Parvati caught up with divine love & blessing!"`,
      `"With Lord Ganesha's grace, every run is auspicious."`,
      `"Vighnaharta removes all obstacles — run with joy again!"`
    ];
    document.getElementById('gameover-quote').textContent = quotes[Math.floor(Math.random() * quotes.length)];

    this.menuGameOver.classList.add('active');
  }

  updateHUD(score, multiplier, distance, modaks) {
    this.scoreVal.textContent = Math.floor(score).toLocaleString();
    this.multiplierBadge.textContent = `x${multiplier.toFixed(1)}`;
    this.distanceVal.textContent = `${Math.floor(distance)}m`;
    this.modakVal.textContent = modaks.toLocaleString();
  }

  updateChaseMeter(distanceMeters) {
    const dist = Math.max(0, distanceMeters);
    this.chaseDistVal.textContent = `${dist.toFixed(0)}m Behind`;

    // 0 to 30m maps to 0% to 100%
    const pct = Math.min(100, (dist / 30.0) * 100);
    this.chaseBarFill.style.width = `${pct}%`;

    if (dist < 10.0) {
      this.chaseMeter.classList.add('chase-warning');
    } else {
      this.chaseMeter.classList.remove('chase-warning');
    }
  }

  showCombo(count) {
    let text = `${count}x Modak Combo!`;
    if (count >= 50) text = `🌟 50x MAHA COMBO! 🌟`;
    else if (count >= 25) text = `⚡ 25x FESTIVE STREAK! ⚡`;

    this.comboText.textContent = text;
    this.comboContainer.classList.add('active');

    if (this.comboTimeout) clearTimeout(this.comboTimeout);
    this.comboTimeout = setTimeout(() => {
      this.comboContainer.classList.remove('active');
    }, 1800);
  }

  showTutorialStep(icon, text) {
    const iconSpan = document.getElementById('tutorial-icon');
    if (iconSpan) iconSpan.textContent = icon;
    this.tutorialText.textContent = text;
    this.tutorialBubble.classList.add('show');

    if (this.tutorialTimeout) clearTimeout(this.tutorialTimeout);
    this.tutorialTimeout = setTimeout(() => {
      this.tutorialBubble.classList.remove('show');
    }, 3800);
  }

  updateHighScoresModal() {
    document.getElementById('hs-score').textContent = this.highScore.toLocaleString();
    document.getElementById('hs-distance').textContent = `${this.maxDistance}m`;
    document.getElementById('hs-modaks').textContent = this.totalModaks.toLocaleString();
  }

  saveRunStats(score, distance, modaks) {
    let newHigh = false;
    if (score > this.highScore) {
      this.highScore = Math.floor(score);
      localStorage.setItem('ganesh_high_score', this.highScore);
      newHigh = true;
    }
    if (distance > this.maxDistance) {
      this.maxDistance = Math.floor(distance);
      localStorage.setItem('ganesh_max_distance', this.maxDistance);
    }
    this.totalModaks += modaks;
    localStorage.setItem('ganesh_total_modaks', this.totalModaks);
    return newHigh;
  }
}

window.UIManager = UIManager;