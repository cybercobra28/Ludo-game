/**
 * Ludo Board Renderer — Frontend (Netlify)
 */

const ROWS = 15, COLS = 15;
let cellRegistry = [];
const tokenElements = {};

function buildGridMap() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) grid[r][c] = { type: 'track' };
  }
  // Base areas
  for (let r = 0; r <= 5; r++) for (let c = 0; c <= 5; c++) grid[r][c] = { type: 'base-red' };
  for (let r = 0; r <= 5; r++) for (let c = 9; c <= 14; c++) grid[r][c] = { type: 'base-blue' };
  for (let r = 9; r <= 14; r++) for (let c = 9; c <= 14; c++) grid[r][c] = { type: 'base-green' };
  for (let r = 9; r <= 14; r++) for (let c = 0; c <= 5; c++) grid[r][c] = { type: 'base-yellow' };
  // Center
  grid[6][6]={type:'center-red'};grid[6][7]={type:'center-block'};grid[6][8]={type:'center-blue'};
  grid[7][6]={type:'center-block'};grid[7][7]={type:'center-block',star:true};grid[7][8]={type:'center-block'};
  grid[8][6]={type:'center-yellow'};grid[8][7]={type:'center-block'};grid[8][8]={type:'center-green'};
  // Home stretches
  for (let c = 1; c <= 5; c++) grid[7][c] = { type: 'home-stretch-red' };
  for (let r = 1; r <= 5; r++) grid[r][7] = { type: 'home-stretch-blue' };
  for (let c = 9; c <= 13; c++) grid[7][c] = { type: 'home-stretch-green' };
  for (let r = 9; r <= 13; r++) grid[r][7] = { type: 'home-stretch-yellow' };
  // Color entries
  grid[6][0].colorClass = 'color-red';
  grid[0][8].colorClass = 'color-blue';
  grid[8][14].colorClass = 'color-green';
  grid[14][6].colorClass = 'color-yellow';
  // Safe zones
  [[6,1],[1,8],[2,6],[8,13],[6,12],[13,6],[12,8],[8,2]].forEach(([r,c]) => {
    if (grid[r][c].type === 'track') grid[r][c].safe = true;
  });
  return grid;
}

function buildTrackPath() {
  return [
    {r:6,c:0},{r:6,c:1},{r:6,c:2},{r:6,c:3},{r:6,c:4},{r:6,c:5},
    {r:5,c:5},{r:4,c:5},{r:3,c:5},{r:2,c:5},{r:1,c:5},{r:0,c:5},
    {r:0,c:6},{r:0,c:7},{r:0,c:8},
    {r:1,c:8},{r:2,c:8},{r:3,c:8},{r:4,c:8},{r:5,c:8},
    {r:5,c:9},{r:5,c:10},{r:5,c:11},{r:5,c:12},{r:5,c:13},{r:5,c:14},
    {r:6,c:14},{r:7,c:14},
    {r:8,c:14},{r:8,c:13},{r:8,c:12},{r:8,c:11},{r:8,c:10},{r:8,c:9},
    {r:9,c:9},{r:10,c:9},{r:11,c:9},{r:12,c:9},{r:13,c:9},{r:14,c:9},
    {r:14,c:8},{r:14,c:7},{r:14,c:6},
    {r:13,c:6},{r:12,c:6},{r:11,c:6},{r:10,c:6},{r:9,c:6},
    {r:9,c:5},{r:9,c:4},{r:9,c:3},{r:9,c:2},{r:9,c:1},{r:9,c:0},
    {r:8,c:0},{r:7,c:0},
  ];
}

const HOME_PATHS = {
  red:    [{r:7,c:1},{r:7,c:2},{r:7,c:3},{r:7,c:4},{r:7,c:5},{r:7,c:6}],
  blue:   [{r:1,c:7},{r:2,c:7},{r:3,c:7},{r:4,c:7},{r:5,c:7},{r:6,c:7}],
  green:  [{r:7,c:13},{r:7,c:12},{r:7,c:11},{r:7,c:10},{r:7,c:9},{r:7,c:8}],
  yellow: [{r:13,c:7},{r:12,c:7},{r:11,c:7},{r:10,c:7},{r:9,c:7},{r:8,c:7}],
};

const BASE_POSITIONS = {
  red:    [{r:1,c:1},{r:1,c:3},{r:3,c:1},{r:3,c:3}],
  blue:   [{r:1,c:11},{r:1,c:13},{r:3,c:11},{r:3,c:13}],
  green:  [{r:11,c:11},{r:11,c:13},{r:13,c:11},{r:13,c:13}],
  yellow: [{r:11,c:1},{r:11,c:3},{r:13,c:1},{r:13,c:3}],
};

const COLOR_OFFSET = { red: 0, blue: 13, green: 26, yellow: 39 };

function initBoard() {
  const board = document.getElementById('ludoBoard');
  if (!board) return;
  board.innerHTML = '';
  cellRegistry = [];
  const gridMap = buildGridMap();
  for (let r = 0; r < ROWS; r++) {
    cellRegistry[r] = [];
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r; cell.dataset.c = c;
      const info = gridMap[r][c];
      cell.classList.add(info.type);
      if (info.safe) cell.classList.add('safe');
      if (info.colorClass) cell.classList.add(info.colorClass);
      if (info.star) {
        const star = document.createElement('div');
        star.className = 'center-star'; star.textContent = '⭐';
        cell.appendChild(star);
      }
      board.appendChild(cell);
      cellRegistry[r][c] = cell;
    }
  }
}

function getCellForToken(color, pathIndex) {
  if (pathIndex < 0) return null;
  const trackPath = buildTrackPath();
  const offset = COLOR_OFFSET[color];
  if (pathIndex < 52) {
    const pos = trackPath[(offset + pathIndex) % 52];
    return pos ? cellRegistry[pos.r]?.[pos.c] : null;
  } else {
    const homeIdx = pathIndex - 52;
    const pos = HOME_PATHS[color]?.[homeIdx];
    return pos ? cellRegistry[pos.r]?.[pos.c] : null;
  }
}

function getBaseCell(color, tokenIdx) {
  const pos = BASE_POSITIONS[color]?.[tokenIdx];
  return pos ? cellRegistry[pos.r]?.[pos.c] : null;
}

function createTokenElement(color, idx) {
  const el = document.createElement('div');
  el.className = `token token-${color}`;
  el.dataset.color = color; el.dataset.idx = idx;
  el.textContent = idx + 1;
  tokenElements[`${color}-${idx}`] = el;
  return el;
}

function placeTokenInCell(cell, tokenEl) {
  if (!cell) return;
  cell.appendChild(tokenEl);
  const cnt = cell.querySelectorAll('.token').length;
  cell.className = cell.className.replace(/has-\d/g, '').trim();
  if (cnt >= 2) cell.classList.add(`has-${Math.min(cnt, 4)}`);
}

function renderAllTokens(tokenState) {
  document.querySelectorAll('.token').forEach(t => t.remove());
  for (const [color, positions] of Object.entries(tokenState)) {
    positions.forEach((pos, idx) => {
      const el = createTokenElement(color, idx);
      if (pos < 0) placeTokenInCell(getBaseCell(color, idx), el);
      else if (pos >= 57) placeTokenInCell(cellRegistry[7]?.[7], el);
      else placeTokenInCell(getCellForToken(color, pos), el);
    });
  }
}

function animateMoveToken(color, idx, fromPos, toPos, callback) {
  const tokenEl = tokenElements[`${color}-${idx}`];
  if (!tokenEl) { callback?.(); return; }
  tokenEl.classList.add('moving');
  const steps = fromPos < 0 ? [0] : [];
  if (fromPos >= 0) for (let p = fromPos + 1; p <= toPos; p++) steps.push(p);
  let i = 0;
  function doStep() {
    if (i >= steps.length) { tokenEl.classList.remove('moving'); callback?.(); return; }
    const cell = getCellForToken(color, steps[i++]);
    if (cell) placeTokenInCell(cell, tokenEl);
    setTimeout(doStep, 120);
  }
  doStep();
}

function highlightSelectableTokens(color, movableIndices, onSelect) {
  clearHighlights();
  movableIndices.forEach(idx => {
    const el = tokenElements[`${color}-${idx}`];
    if (el) {
      el.classList.add('selectable');
      el.onclick = () => { clearHighlights(); onSelect(idx); };
    }
  });
}

function clearHighlights() {
  document.querySelectorAll('.token.selectable').forEach(el => { el.classList.remove('selectable'); el.onclick = null; });
  document.querySelectorAll('.cell.move-target').forEach(el => { el.classList.remove('move-target'); el.onclick = null; });
}

function flashKill(color, tokenIdx) {
  const el = tokenElements[`${color}-${tokenIdx}`];
  if (el) { el.classList.add('killed'); setTimeout(() => el.classList.remove('killed'), 500); }
}
