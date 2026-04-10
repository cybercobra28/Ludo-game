/**
 * Ludo Online — Game Client (Netlify SPA)
 * Connects to Railway backend via REST API + SocketIO
 */

// ══ IMPORTANT: Replace with your Railway backend URL after deploying ══
const BACKEND_URL = window.BACKEND_URL || 'https://your-app.railway.app';

let socket = null;
let currentUser = null;
let currentRoomId = null;
let myColor = null;
let myTurn = false;
let diceRolled = false;

const DICE_FACES = ['','⚀','⚁','⚂','⚃','⚄','⚅'];

// ── Page Navigation ───────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
}

function showLogin()    { document.getElementById('loginCard').classList.remove('hidden'); document.getElementById('registerCard').classList.add('hidden'); }
function showRegister() { document.getElementById('registerCard').classList.remove('hidden'); document.getElementById('loginCard').classList.add('hidden'); }

// ── API Helpers ───────────────────────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BACKEND_URL + path, opts);
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  if (!username || !password) { errEl.textContent = 'Fill in all fields'; errEl.classList.remove('hidden'); return; }
  const data = await api('/api/login', 'POST', { username, password });
  if (data.error) { errEl.textContent = data.error; errEl.classList.remove('hidden'); return; }
  currentUser = data.user;
  enterLobby();
}

async function doRegister() {
  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;
  const password2 = document.getElementById('regPass2').value;
  const errEl = document.getElementById('regError');
  errEl.classList.add('hidden');
  if (!username || !password) { errEl.textContent = 'Fill in all fields'; errEl.classList.remove('hidden'); return; }
  if (password !== password2) { errEl.textContent = 'Passwords do not match'; errEl.classList.remove('hidden'); return; }
  const data = await api('/api/register', 'POST', { username, password });
  if (data.error) { errEl.textContent = data.error; errEl.classList.remove('hidden'); return; }
  currentUser = data.user;
  enterLobby();
}

async function doLogout() {
  await api('/api/logout', 'POST');
  currentUser = null;
  if (socket) { socket.disconnect(); socket = null; }
  showPage('auth');
  showLogin();
}

// ── Lobby ─────────────────────────────────────────────────────────────────────
function enterLobby() {
  showPage('lobby');
  document.getElementById('lobbyUsername').textContent = currentUser.username;
  document.getElementById('lobbyWins').textContent = currentUser.wins;
  loadOpenRooms();
  loadLeaderboard();
}

async function loadOpenRooms() {
  const rooms = await api('/api/rooms/open');
  const el = document.getElementById('openRoomsList');
  if (!rooms.length) { el.innerHTML = '<p class="empty-state">No open rooms. Create one! 🎲</p>'; return; }
  el.innerHTML = rooms.map(r => `
    <div class="room-card">
      <div class="room-info">
        <span class="room-code">${r.room_id}</span>
        <span class="room-host">by ${r.created_by}</span>
      </div>
      <div class="room-meta">
        <span class="players-count">${'🟢'.repeat(r.players)}${'⚪'.repeat(4-r.players)} ${r.players}/4</span>
        <button class="btn btn-xs btn-join" onclick="joinRoom('${r.room_id}')">Join</button>
      </div>
    </div>`).join('');
}

async function loadLeaderboard() {
  const players = await api('/api/leaderboard');
  const medals = ['🥇','🥈','🥉'];
  document.getElementById('leaderboardBody').innerHTML = players.map((p, i) => `
    <tr class="${p.username === currentUser?.username ? 'highlight-row' : ''}">
      <td>${medals[i] || (i+1)}</td><td>${p.username}</td><td>${p.wins}</td><td>${p.win_rate}%</td>
    </tr>`).join('') || '<tr><td colspan="4" class="empty-state">No games yet</td></tr>';
}

async function createRoom() {
  const data = await api('/api/rooms/create', 'POST');
  if (data.error) { alert(data.error); return; }
  joinRoom(data.room_id);
}

function joinRoomByCode() {
  const code = document.getElementById('joinRoomInput').value.trim().toUpperCase();
  const errEl = document.getElementById('joinError');
  errEl.classList.add('hidden');
  if (!code || code.length !== 6) { errEl.textContent = 'Enter a valid 6-character room code'; errEl.classList.remove('hidden'); return; }
  joinRoom(code);
}

function joinRoom(roomId) {
  currentRoomId = roomId;
  document.getElementById('topRoomId').textContent = roomId;
  document.getElementById('topUsername').textContent = currentUser.username;
  document.getElementById('overlayRoomId').textContent = roomId;
  document.getElementById('roomCodeBig').textContent = roomId;
  showPage('game');
  initBoard();
  connectSocket(roomId);
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
function connectSocket(roomId) {
  if (socket) socket.disconnect();

  socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });

  socket.on('connect', () => {
    socket.emit('join_game', { room_id: roomId });
  });

  socket.on('error', (data) => {
    showStatus(data.message, 'error');
  });

  socket.on('joined', (data) => {
    myColor = data.color;
    updatePlayersPreview(data.players);
    updatePlayerCards(data.players);
    const myCard = document.getElementById(`panel-${myColor}`);
    if (myCard) myCard.classList.add('my-card');
  });

  socket.on('player_joined', (data) => {
    updatePlayersPreview(data.players);
    updatePlayerCards(data.players);
    addSystemChat(`${data.username} joined as ${cap(data.color)}`);
    document.getElementById('waitingText').textContent =
      `${data.count}/4 players — ${data.count >= 2 ? 'Starting soon...' : 'Waiting for players...'}`;
  });

  socket.on('game_started', (data) => {
    document.getElementById('waitingOverlay').classList.add('hidden');
    updatePlayerCards(data.players);
    renderAllTokens(data.state.tokens);
    updateTurnUI(data.current_color, data.current_player);
    checkMyTurn(data.current_player, data.current_color);
    addMoveHistory(`🎮 Game started! ${cap(data.current_color)} goes first.`);
    addSystemChat('Game started! 🎲');
  });

  socket.on('game_state', (data) => {
    document.getElementById('waitingOverlay').classList.add('hidden');
    if (data.tokens) renderAllTokens(data.tokens);
    updateTurnUI(data.current_color, data.current_player);
    checkMyTurn(data.current_player, data.current_color);
  });

  socket.on('dice_result', (data) => {
    animateDice(data.dice, () => {
      diceRolled = true;
      if (data.auto_pass) {
        showStatus('No moves available! Turn passes.');
        diceRolled = false; myTurn = false;
        document.getElementById('rollBtn').disabled = true;
        addMoveHistory(`🎲 ${cap(data.color)} rolled ${data.dice} — no moves`);
      } else {
        showStatus(myTurn ? 'Click a highlighted token to move!' : `${cap(data.color)} rolled ${data.dice}`);
        if (myTurn && data.movable_tokens) {
          highlightSelectableTokens(myColor, data.movable_tokens, (tokenIdx) => {
            socket.emit('move_token', { room_id: currentRoomId, token_index: tokenIdx });
            diceRolled = false;
            document.getElementById('rollBtn').disabled = true;
          });
        }
      }
    });
  });

  socket.on('update_board', (data) => {
    clearHighlights();
    let delay = 0;
    (data.events || []).forEach(evt => {
      setTimeout(() => {
        if (evt.type === 'kill') {
          flashKill(evt.victim_color, evt.victim_token);
          addSystemChat(`💥 ${cap(evt.killer)} killed ${cap(evt.victim_color)}'s token!`);
        }
        if (evt.type === 'win') addSystemChat(`🏆 ${evt.player} wins!`);
      }, delay);
      delay += 300;
    });
    setTimeout(() => {
      if (data.state?.tokens) renderAllTokens(data.state.tokens);
      let msg = `🎲 ${cap(data.color)} moved token ${data.token+1} (+${data.dice})`;
      if (data.killed?.length) msg += ` 💥 killed ${data.killed.map(k=>cap(k.color)).join(', ')}`;
      if (data.extra_turn) msg += ' 🔄 extra turn!';
      addMoveHistory(msg);
    }, delay + 200);
  });

  socket.on('player_turn', (data) => {
    updateTurnUI(data.current_color, data.current_player);
    checkMyTurn(data.current_player, data.current_color);
    diceRolled = false;
    document.getElementById('rollBtn').disabled = !myTurn;
  });

  socket.on('game_over', (data) => {
    myTurn = false;
    document.getElementById('rollBtn').disabled = true;
    const isWinner = data.winner === currentUser.username;
    document.getElementById('winnerEmoji').textContent = isWinner ? '🏆' : '🎮';
    document.getElementById('gameOverTitle').textContent = isWinner ? 'You Won! 🎉' : 'Game Over!';
    document.getElementById('gameOverMsg').textContent = isWinner
      ? 'Congratulations! You are the Ludo champion!'
      : `${data.winner} (${cap(data.winner_color)}) won the game!`;
    document.getElementById('gameOverOverlay').classList.remove('hidden');
    addSystemChat(`🏆 ${data.winner} won the game!`);
  });

  socket.on('chat_message', (data) => {
    addChatMessage(data.username, data.message, data.time);
  });

  socket.on('player_left', (data) => {
    addSystemChat(`${data.username || 'A player'} left the game`);
    updatePlayerCards(data.players || []);
  });

  socket.on('player_disconnected', (data) => {
    addSystemChat(`${data.username} disconnected`);
  });
}

// ── Game Actions ──────────────────────────────────────────────────────────────
function rollDice() {
  if (!myTurn || diceRolled || !socket) return;
  document.getElementById('rollBtn').disabled = true;
  socket.emit('roll_dice', { room_id: currentRoomId });
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg || !socket) return;
  socket.emit('send_chat', { room_id: currentRoomId, message: msg });
  input.value = '';
}

function leaveGame() {
  if (socket) { socket.emit('leave_game', { room_id: currentRoomId }); socket.disconnect(); socket = null; }
  currentRoomId = null; myColor = null; myTurn = false; diceRolled = false;
  document.getElementById('gameOverOverlay').classList.add('hidden');
  document.getElementById('waitingOverlay').classList.remove('hidden');
  document.getElementById('waitingText').textContent = 'Waiting for players... (0/2 minimum)';
  document.getElementById('playersPreview').innerHTML = '';
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('moveHistory').innerHTML = '';
  document.getElementById('diceFace').textContent = '🎲';
  document.getElementById('diceValue').textContent = '';
  showPage('lobby');
  loadOpenRooms();
  loadLeaderboard();
}

function copyRoomCode() {
  navigator.clipboard?.writeText(currentRoomId).then(() => {
    const el = document.getElementById('roomCodeBig');
    const orig = el.textContent;
    el.textContent = 'Copied! ✓';
    setTimeout(() => el.textContent = orig, 1500);
  });
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
function checkMyTurn(currentPlayer, currentColor) {
  myTurn = currentPlayer === currentUser?.username;
  document.getElementById('rollBtn').disabled = !myTurn || diceRolled;
  showStatus(myTurn ? 'Your turn! Roll the dice.' : `${currentPlayer}'s turn (${cap(currentColor)})`);
}

function updateTurnUI(color, player) {
  const dot = document.getElementById('turnDot');
  dot.className = 'turn-dot ' + color;
  document.getElementById('turnText').textContent = `${cap(color)}: ${player}'s turn`;
  document.querySelectorAll('.player-card').forEach(c => c.classList.remove('active-turn'));
  document.getElementById(`panel-${color}`)?.classList.add('active-turn');
}

function updatePlayerCards(players) {
  ['red','blue','green','yellow'].forEach(c => {
    const el = document.querySelector(`#panel-${c} .player-card-user`);
    if (el) el.textContent = '—';
  });
  players.forEach(p => {
    const el = document.querySelector(`#panel-${p.color} .player-card-user`);
    if (el) el.textContent = p.username;
  });
}

function updatePlayersPreview(players) {
  const el = document.getElementById('playersPreview');
  el.innerHTML = players.map(p =>
    `<div class="player-preview-chip" style="border-color:var(--${p.color})">
      ${p.username} (${cap(p.color)})</div>`).join('');
}

function animateDice(value, callback) {
  const face = document.getElementById('diceFace');
  const valEl = document.getElementById('diceValue');
  face.classList.add('rolling'); valEl.textContent = '';
  let i = 0;
  const iv = setInterval(() => {
    face.textContent = DICE_FACES[Math.floor(Math.random()*6)+1];
    if (++i >= 8) {
      clearInterval(iv); face.classList.remove('rolling');
      face.textContent = DICE_FACES[value]; valEl.textContent = value;
      callback?.();
    }
  }, 60);
}

function showStatus(msg, type) {
  const el = document.getElementById('gameStatus');
  el.textContent = msg;
  el.style.color = type === 'error' ? '#fc8181' : '';
}

function addChatMessage(username, message, time) {
  const el = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="chat-user">${esc(username)}</span>: <span class="chat-text">${esc(message)}</span>`;
  el.appendChild(div); el.scrollTop = el.scrollHeight;
}

function addSystemChat(msg) {
  const el = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg system-msg'; div.textContent = msg;
  el.appendChild(div); el.scrollTop = el.scrollHeight;
}

function addMoveHistory(msg) {
  const el = document.getElementById('moveHistory');
  const div = document.createElement('div');
  div.className = 'move-item'; div.textContent = msg;
  el.prepend(div);
  while (el.children.length > 50) el.removeChild(el.lastChild);
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function esc(text) { const d = document.createElement('div'); d.appendChild(document.createTextNode(text)); return d.innerHTML; }

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (document.getElementById('page-auth').classList.contains('active')) {
      if (!document.getElementById('loginCard').classList.contains('hidden')) doLogin();
      else doRegister();
    }
    if (document.getElementById('page-game').classList.contains('active')) sendChat();
  }
});

// ── Init: Check if already logged in ─────────────────────────────────────────
(async () => {
  const data = await api('/api/me');
  if (data.user) { currentUser = data.user; enterLobby(); }
})();
