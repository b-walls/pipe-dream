const SIZE = 6;
const grid = document.getElementById('grid');
const timerEl = document.getElementById('timer');
const starsEl = document.getElementById('stars');
let tiles = [];
let timer, interval, gameWon, stars;
let difficulty = 'medium'; // default
let maxTime = 60; // default for medium

let layout = []; // Will be set to a random map on game start
let selectedLevel = 0;

let unlockedLevels = 1; // Default: only level 1 unlocked

// Load unlocked levels from localStorage if available
if (localStorage.getItem('pipeDreamUnlockedLevels')) {
  unlockedLevels = parseInt(localStorage.getItem('pipeDreamUnlockedLevels'), 10) || 1;
}

function pickLevelMap(idx) {
  const maps = window.PIPE_DREAM_MAPS;
  return maps[idx].slice();
}

const directions = {
  up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0]
};

function getImageSrc(type, yellow) {
  const base = yellow ? '-yellow' : '';
  switch (type) {
    case 'pipe': return `img/straight${base}.png`;
    case 'corner': return `img/corner${base}.png`;
    case 'tcross': return `img/3-cross${base}.png`;
    case 'cross': return `img/4-cross${base}.png`;
    default: return null;
  }
}

function getConnections(type, rotation = 0) {
  const deg = parseInt(rotation) % 360;
  switch (type) {
    case 'pipe':   return deg % 180 === 0 ? ['up', 'down'] : ['left', 'right'];
    case 'corner': return {0:['down','right'],90:['left','down'],180:['up','left'],270:['up','right']}[deg];
    case 'tcross': return {0:['down','up','right'],90:['left','right','down'],180:['up','down','left'],270:['right','left','up']}[deg];
    case 'cross':  return ['up', 'right', 'down', 'left'];
    case 'source':
    case 'house':  return ['left', 'right', 'up', 'down'];
    default:       return [];
  }
}

const posToIndex = (x, y) => y * SIZE + x;
const isValidCoord = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
const getOpposite = dir => ({ up: 'down', down: 'up', left: 'right', right: 'left' }[dir]);

function rotateTile(tile) {
  if (!tile.classList.contains('rotatable')) return;
  let current = (parseInt(tile.dataset.rotation) || 0) + 90;
  tile.dataset.rotation = current;
  const img = tile.querySelector('img');
  if (img) {
    img.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1)';
    img.style.transform = `rotate(${current}deg)`;
  }
  // Play woosh sound effect
  const audio = new Audio('sounds/woosh.mp3');
  audio.currentTime = 0.15
  audio.volume = 0.2;
  audio.play();
}

function buildGrid() {
  grid.innerHTML = '';
  tiles = [];
  layout.forEach((type, i) => {
    const tile = document.createElement('div');
    tile.className = `tile ${type}`;
    tile.dataset.type = type;

    // Randomize rotation for pipe types
    const isRotatable = ['pipe', 'corner', 'tcross', 'cross'].includes(type);
    let rotation = 0;
    if (isRotatable) {
      rotation = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
      tile.classList.add('rotatable');
    }
    tile.dataset.rotation = rotation;

    let img;
    if (getImageSrc(type, false)) {
      img = document.createElement('img');
      img.src = getImageSrc(type, false);
      img.style.transform = `rotate(${rotation}deg)`;
      tile.appendChild(img);
    } else if (['source', 'house', 'rock'].includes(type)) {
      img = document.createElement('img');
      img.src = type === 'source' ? 'img/spout.png' :
                type === 'house'  ? 'img/house.png' :
                'img/gray-rock.png';
      tile.appendChild(img);
    }
    if (isRotatable) tile.addEventListener('click', () => { rotateTile(tile); checkWin(); });
    tiles.push(tile);
    grid.appendChild(tile);
  });
}

function highlightPath(pathTiles) {
  tiles.forEach((tile, i) => {
    const type = tile.dataset.type;
    if (!['pipe', 'corner', 'tcross', 'cross'].includes(type)) return;
    const img = tile.querySelector('img');
    if (!img) return;
    img.src = getImageSrc(type, pathTiles.has(i));
  });
}

function checkWin() {
  const sourceIndex = tiles.findIndex(t => t.dataset.type === 'source');
  if (sourceIndex === -1) return;
  const visited = new Set(), queue = [sourceIndex], pathTiles = new Set();
  while (queue.length) {
    const idx = queue.shift();
    if (visited.has(idx)) continue;
    visited.add(idx); pathTiles.add(idx);
    const tile = tiles[idx], type = tile.dataset.type, rotation = tile.dataset.rotation || 0;
    const x = idx % SIZE, y = Math.floor(idx / SIZE);
    const conns = getConnections(type, rotation);
    for (const dir of conns) {
      const [dx, dy] = directions[dir], nx = x + dx, ny = y + dy;
      if (!isValidCoord(nx, ny)) continue;
      const nIdx = posToIndex(nx, ny), neighbor = tiles[nIdx];
      if (neighbor.dataset.type === 'rock') continue;
      const neighborConns = getConnections(neighbor.dataset.type, neighbor.dataset.rotation || 0);
      if (neighborConns.includes(getOpposite(dir))) {
        if (neighbor.dataset.type === 'house') {
          pathTiles.add(nIdx); highlightPath(pathTiles); triggerWin(); return;
        }
        queue.push(nIdx);
      }
    }
  }
  highlightPath(pathTiles);
}

function getDropletsHTML(count) {
  let html = '';
  for (let i = 1; i <= 3; i++) {
    html += `<i class="fa-solid fa-droplet" style="color:${i <= count ? '#2E9DF7' : '#b0b0b0'};font-size:2rem;margin:0 2px"></i>`;
  }
  return html;
}

function showWinModal(score, timeLeft) {
  const oldModal = document.getElementById('winModal');
  if (oldModal) oldModal.remove();
  const nextLevelUnlocked = selectedLevel + 1 < window.PIPE_DREAM_MAPS.length;
  // Unlock next level if not already unlocked
  if (nextLevelUnlocked && unlockedLevels <= selectedLevel + 1) {
    unlockedLevels = selectedLevel + 2;
    localStorage.setItem('pipeDreamUnlockedLevels', unlockedLevels);
  }
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="modal fade show" id="winModal" tabindex="-1" style="display:block; background:rgba(0,0,0,0.5);" aria-modal="true" role="dialog">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content text-center" style="background:#3a3b4c;">
          <div class="modal-header text-center" style="border-bottom: none;">
            <h5 class="modal-title w-100" style="color:#FFC907;">Great Job!</h5>
          </div>
          <div class="modal-body">
            <p style="color:#fff;"><span>${getDropletsHTML(score)}</span></p>
            <p style="color:#fff;"><strong>Time Left:</strong> ${timeLeft}s</p>
          </div>
          <div class="modal-footer justify-content-center" style="border-top: none;">
            <button type="button" class="btn" id="resetBtn" style="background-color:#FFC907; color:#fff;">Play Again</button>
            ${nextLevelUnlocked ? `<button type="button" class="btn" id="nextLevelBtn" style="background-color:#FFC907; color:#fff; margin-left:10px;">Next Level</button>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  document.getElementById('resetBtn').onclick = () => {
    document.getElementById('winModal').remove();
    document.body.classList.remove('modal-open');
    resetGame();
  };
  if (nextLevelUnlocked) {
    document.getElementById('nextLevelBtn').onclick = () => {
      document.getElementById('winModal').remove();
      document.body.classList.remove('modal-open');
      selectedLevel++;
      startGameWithLevel(selectedLevel);
    };
  }
}

function updateStars() {
  if (timer <= maxTime / 2 && stars === 3) stars = 2;
  if (timer <= maxTime / 4 && stars === 2) stars = 1;
  if (timer <= 10 && stars === 1) stars = 0;
  starsEl.innerHTML = getDropletsHTML(stars);
}

function resetGame() {
  timer = maxTime;
  stars = 3;
  gameWon = false;
  starsEl.innerHTML = getDropletsHTML(stars);
  layout = pickLevelMap(selectedLevel);
  buildGrid();
  clearInterval(interval);
  interval = setInterval(gameTick, 1000);
  timerEl.textContent = timer;
}

function showConfetti() {
  // Simple confetti using canvas
  const confettiCanvas = document.createElement('canvas');
  confettiCanvas.id = 'confetti-canvas';
  confettiCanvas.style.position = 'fixed';
  confettiCanvas.style.top = 0;
  confettiCanvas.style.left = 0;
  confettiCanvas.style.width = '100vw';
  confettiCanvas.style.height = '100vh';
  confettiCanvas.style.pointerEvents = 'none';
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  document.body.appendChild(confettiCanvas);

  const ctx = confettiCanvas.getContext('2d');
  const confettiColors = ['#FFC907', '#2E9DF7', '#fff', '#159A48', '#8BD1CB'];
  const confettiPieces = Array.from({length: 120}, () => ({
    x: Math.random() * confettiCanvas.width,
    y: Math.random() * -confettiCanvas.height,
    r: Math.random() * 6 + 4,
    d: Math.random() * 40 + 10,
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltAngleIncremental: Math.random() * 0.07 + 0.05
  }));

  let frame = 0;
  const maxFrames = 300; // 60fps * 5s = 300 frames

  function drawConfetti() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiPieces.forEach(p => {
      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 3, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.d / 5);
      ctx.stroke();
    });
    updateConfetti();
    frame++;
    if (frame < maxFrames) {
      requestAnimationFrame(drawConfetti);
    } else {
      confettiCanvas.remove();
    }
  }

  function updateConfetti() {
    confettiPieces.forEach(p => {
      p.y += Math.cos(frame / 10 + p.d) + 2 + p.r / 2;
      p.x += Math.sin(frame / 20) * 2;
      p.tiltAngle += p.tiltAngleIncremental;
      p.tilt = Math.sin(p.tiltAngle) * 15;
      if (p.y > confettiCanvas.height) {
        p.x = Math.random() * confettiCanvas.width;
        p.y = -10;
      }
    });
  }

  drawConfetti();
}

// Call showConfetti() when the game is won
function triggerWin() {
  if (gameWon) return;
  gameWon = true;
  clearInterval(interval);
  // Play win sound effect
  const winAudio = new Audio('sounds/win.mp3');
  winAudio.volume = 0.7;
  winAudio.play();
  showConfetti();
  showWinModal(stars, timer);
}

function gameTick() {
  if (gameWon) return;
  timer--;
  timerEl.textContent = timer;
  updateStars();
  checkWin();
  if (timer <= 0) {
    clearInterval(interval);
    const oldModal = document.getElementById('loseModal');
    if (oldModal) oldModal.remove();
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div class="modal fade show" id="loseModal" tabindex="-1" style="display:block; background:rgba(0,0,0,0.5);" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content text-center" style="background:#3a3b4c;">
            <div class="modal-header text-center" style="border-bottom: none;">
              <h5 class="modal-title w-100" style="color:#FFC907;">Time's Up!</h5>
            </div>
            <div class="modal-body">
              <p style="color:#fff;">You ran out of time!</p>
              <p style="color:#fff;"><strong>Try Again?</strong></p>
            </div>
            <div class="modal-footer justify-content-center" style="border-top: none;">
              <button type="button" class="btn" id="loseResetBtn" style="background-color:#FFC907; color:#fff;">Play Again</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
    document.getElementById('loseResetBtn').onclick = () => {
      document.getElementById('loseModal').remove();
      document.body.classList.remove('modal-open');
      resetGame();
    };
  }
}

function showInfoModal() {
  // Pause the game timer
  clearInterval(interval);

  // Remove existing info modal if present
  const oldModal = document.getElementById('infoModal');
  if (oldModal) oldModal.remove();

  // Info modal HTML
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="modal fade show" id="infoModal" tabindex="-1" style="display:block; background:rgba(0,0,0,0.5);" aria-modal="true" role="dialog">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content text-center" style="background:#3a3b4c;">
          <div class="modal-header text-center" style="border-bottom: none;">
            <h5 class="modal-title w-100" style="color:#FFC907;">How to Play</h5>
          </div>
          <div class="modal-body">
            <p style="color:#fff; text-align:left;">
              <strong>Goal:</strong> Connect the water source <span style="font-size:1.2em;">🚰</span> to the house <span style="font-size:1.2em;">🏠</span> before time runs out.<br><br>
              <strong>Instructions:</strong><br>
              • Click on any pipe to rotate it.<br>
              • Create a continuous path from the source to the house.<br>
              • The faster you finish, the more water droplets you earn!<br>
              • When the path is complete, the pipes will turn gold.<br>
              • If time runs out, you can try again.<br>
            </p>
          </div>
          <div class="modal-footer justify-content-center" style="border-top: none;">
            <button type="button" class="btn" id="closeInfoBtn" style="background-color:#FFC907; color:#fff;">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');

  // Resume the game when closing the modal
  document.getElementById('closeInfoBtn').onclick = () => {
    document.getElementById('infoModal').remove();
    document.body.classList.remove('modal-open');
    // Only resume timer if the game is not won or lost
    if (!gameWon && timer > 0) {
      clearInterval(interval);
      interval = setInterval(gameTick, 1000);
    }
  };
}

// --- INIT ---
function init() {
  showLevelSelect();
  document.getElementById('restart').addEventListener('click', () => startGameWithLevel(selectedLevel));
  document.getElementById('info').addEventListener('click', showInfoModal);
  document.getElementById('level-select-btn').addEventListener('click', showLevelSelect);
}

function setDifficulty(diff) {
  difficulty = diff;
  if (diff === 'easy') maxTime = 90;
  else if (diff === 'medium') maxTime = 60;
  else if (diff === 'hard') maxTime = 30;
  timer = maxTime;
  timerEl.textContent = timer;
}

function showLevelSelect() {
  const modal = document.getElementById('level-select-modal');
  const btns = document.getElementById('level-buttons');
  btns.innerHTML = '';
  window.PIPE_DREAM_MAPS.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.textContent = `Level ${i + 1}`;
    btn.className = 'btn';
    btn.style.backgroundColor = i < unlockedLevels ? '#FFC907' : '#b0b0b0';
    btn.style.color = '#fff';
    btn.style.fontWeight = 'bold';
    btn.disabled = i >= unlockedLevels;
    btn.onclick = () => {
      selectedLevel = i;
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      showDifficultySelect(i); // <-- Show difficulty modal
    };
    btns.appendChild(btn);
  });
  modal.style.display = 'block';
  document.body.classList.add('modal-open');
}

function showDifficultySelect(levelIdx) {
  // Remove existing modal if present
  const oldModal = document.getElementById('difficulty-select-modal');
  if (oldModal) oldModal.remove();

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'difficulty-select-modal';
  modal.innerHTML = `
    <div class="modal fade show" tabindex="-1" style="display:block; background:rgba(0,0,0,0.5);" aria-modal="true" role="dialog">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content text-center" style="background:#3a3b4c;">
          <div class="modal-header text-center" style="border-bottom: none;">
            <h5 class="modal-title w-100" style="color:#FFC907;">Select Difficulty</h5>
          </div>
          <div class="modal-body">
            <button class="btn" style="background-color:#159A48; color:#fff; margin:10px;" id="easyBtn">Easy</button>
            <button class="btn" style="background-color:#2E9DF7; color:#fff; margin:10px;" id="mediumBtn">Medium</button>
            <button class="btn" style="background-color:#FFC907; color:#fff; margin:10px;" id="hardBtn">Hard</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');

  document.getElementById('easyBtn').onclick = () => {
    setDifficulty('easy');
    modal.remove();
    document.body.classList.remove('modal-open');
    startGameWithLevel(levelIdx);
  };
  document.getElementById('mediumBtn').onclick = () => {
    setDifficulty('medium');
    modal.remove();
    document.body.classList.remove('modal-open');
    startGameWithLevel(levelIdx);
  };
  document.getElementById('hardBtn').onclick = () => {
    setDifficulty('hard');
    modal.remove();
    document.body.classList.remove('modal-open');
    startGameWithLevel(levelIdx);
  };
}

function startGameWithLevel(levelIdx) {
  timer = maxTime;
  stars = 3;
  gameWon = false;
  layout = pickLevelMap(levelIdx);
  buildGrid();
  starsEl.innerHTML = getDropletsHTML(stars);
  timerEl.textContent = timer;
  clearInterval(interval);
  interval = setInterval(gameTick, 1000);
}

init();