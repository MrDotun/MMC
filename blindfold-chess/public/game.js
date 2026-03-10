'use strict';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const UNICODE = {
  K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙',
  k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟',
};

// ── State ─────────────────────────────────────────────────────────────────────
let socket;
const S = {
  roomId:        null,
  color:         null,      // 'white' | 'black'
  fen:           INITIAL_FEN,
  history:       [],
  boardRevealed: false,
  gameOver:      false,
};

// ── DOM ───────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Screens ───────────────────────────────────────────────────────────────────
function showScreen(name) {
  ['lobby', 'waiting', 'game'].forEach(n => {
    $(`screen-${n}`).classList.toggle('active', n === name);
  });
}

// ── Alerts ────────────────────────────────────────────────────────────────────
let alertTimer;
function showAlert(msg, type = 'info') {
  const el = $('alert-area');
  el.textContent = msg;
  el.className   = `alert-area alert-${type}`;
  clearTimeout(alertTimer);
  if (type !== 'danger')
    alertTimer = setTimeout(() => el.classList.add('hidden'), 6000);
}
function hideAlert() { $('alert-area').classList.add('hidden'); }

function showMoveErr(msg) {
  const el = $('move-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

// ── Turn indicator ────────────────────────────────────────────────────────────
function updateTurn() {
  if (S.gameOver) return;
  const myTurn = S.fen.split(' ')[1] === (S.color === 'white' ? 'w' : 'b');
  const badge  = $('status-turn');
  badge.textContent = myTurn ? '● Your Turn' : '◌ Waiting…';
  badge.className   = `turn-badge ${myTurn ? 'active' : 'idle'}`;
  $('input-move').disabled = !myTurn;
  $('btn-move').disabled   = !myTurn;
  if (myTurn) setTimeout(() => $('input-move').focus(), 50);
}

// ── Move history ──────────────────────────────────────────────────────────────
function appendMove(entry) {
  const list = $('move-history');

  if (entry.color === 'white') {
    const n   = Math.floor(entry.idx / 2) + 1;
    const row = document.createElement('div');
    row.className = 'hist-row';
    row.innerHTML =
      `<span class="hist-num">${n}.</span>` +
      `<span class="hist-san w-san">${entry.san}</span>` +
      `<span class="hist-san b-san" id="bm-${entry.idx}"></span>`;
    list.appendChild(row);
  } else {
    const bSpan = $(`bm-${entry.idx - 1}`);
    if (bSpan) {
      bSpan.textContent = entry.san;
    } else {
      const n   = Math.floor(entry.idx / 2) + 1;
      const row = document.createElement('div');
      row.className = 'hist-row';
      row.innerHTML =
        `<span class="hist-num">${n}.</span>` +
        `<span class="hist-san w-san">…</span>` +
        `<span class="hist-san b-san">${entry.san}</span>`;
      list.appendChild(row);
    }
  }
  list.scrollTop = list.scrollHeight;
}

// ── Board rendering ───────────────────────────────────────────────────────────
function parseFen(fen) {
  return fen.split(' ')[0].split('/').map(rank => {
    const row = [];
    for (const ch of rank)
      isNaN(ch) ? row.push(ch) : row.push(...Array(+ch).fill(null));
    return row;
  });
}

function renderBoard(fen) {
  const el   = $('chess-board');
  el.innerHTML = '';
  const grid = parseFen(fen);
  const flip = S.color === 'black';
  const FILES = flip ? 'hgfedcba' : 'abcdefgh';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const gr     = flip ? 7 - r : r;
      const gc     = flip ? 7 - c : c;
      const isLight = (gr + gc) % 2 === 0;
      const sq      = document.createElement('div');
      sq.className  = `sq ${isLight ? 'sq-l' : 'sq-d'}`;

      const piece = grid[gr][gc];
      if (piece) {
        const p = document.createElement('span');
        p.className   = 'piece';
        p.textContent = UNICODE[piece] ?? '';
        sq.appendChild(p);
      }
      if (c === 0) {
        const l = document.createElement('span');
        l.className   = 'coord rank';
        l.textContent = flip ? r + 1 : 8 - r;
        sq.appendChild(l);
      }
      if (r === 7) {
        const l = document.createElement('span');
        l.className   = 'coord file';
        l.textContent = FILES[c];
        sq.appendChild(l);
      }
      el.appendChild(sq);
    }
  }
}

// ── Setup game screen ─────────────────────────────────────────────────────────
function setupGame({ roomId, color, history, fen }) {
  S.roomId        = roomId;
  S.color         = color;
  S.fen           = fen || INITIAL_FEN;
  S.history       = (history || []).slice();
  S.gameOver      = false;
  S.boardRevealed = false;

  $('hdr-room').textContent = `#${roomId}`;
  const cp = $('hdr-color');
  cp.textContent = cap(color);
  cp.className   = `color-pill cp-${color}`;

  $('move-history').innerHTML = '';
  S.history.forEach(appendMove);
  $('draw-offer').classList.add('hidden');
  $('chess-board').classList.add('hidden');
  $('blindfold-msg').classList.remove('hidden');
  $('btn-toggle-board').textContent = 'Show Board';
  hideAlert();
  updateTurn();
  showScreen('game');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function showModal(icon, title, msg) {
  $('modal-icon').textContent = icon;
  $('modal-title').textContent = title;
  $('modal-msg').textContent   = msg;
  $('modal').classList.remove('hidden');
}

// ── Submit move ───────────────────────────────────────────────────────────────
function submitMove() {
  if (S.gameOver) return;
  const inp  = $('input-move');
  const move = inp.value.trim();
  if (!move) return;
  socket.emit('make_move', { move });
  inp.value = '';
}

// ── Socket setup ──────────────────────────────────────────────────────────────
function initSocket() {
  // UPDATED: Points to your Render server for multiplayer logic
  socket = io("https://mmc-a0de.onrender.com");

  socket.on('room_created', ({ roomId, color }) => {
    S.roomId = roomId;
    S.color  = color;
    $('display-room-code').textContent = roomId;
    const wp = $('waiting-color');
    wp.textContent = cap(color);
    wp.className   = `color-pill cp-${color}`;
    showScreen('waiting');
  });

  socket.on('room_joined', (data) => setupGame(data));

  socket.on('opponent_joined', () =>
    setupGame({ roomId: S.roomId, color: S.color, history: [], fen: INITIAL_FEN })
  );

  socket.on('move_made', (entry) => {
    S.fen = entry.fen;
    S.history.push(entry);
    appendMove(entry);
    if (S.boardRevealed) renderBoard(S.fen);
    updateTurn();
    hideAlert();
  });

  socket.on('move_error', (msg) => showMoveErr(msg));

  socket.on('in_check', ({ color }) => {
    showAlert(
      color === S.color ? '⚠️ You are in check!' : '⚠️ Opponent is in check!',
      'warning'
    );
  });

  socket.on('game_over', ({ winner, reason }) => {
    S.gameOver = true;
    $('input-move').disabled = true;
    $('btn-move').disabled   = true;
    $('status-turn').textContent =
      winner ? `${cap(winner)} wins by ${reason}` : `Draw — ${reason}`;
    $('status-turn').className = 'turn-badge idle';

    const [icon, title, msg] =
      !winner            ? ['🤝', 'Draw!',    `Game drawn by ${reason}.`]       :
      winner === S.color ? ['🏆', 'You Win!', `Victory by ${reason}!`]          :
                           ['😔', 'You Lose', `Opponent wins by ${reason}.`];

    setTimeout(() => showModal(icon, title, msg), 600);
  });

  socket.on('draw_offered',        () => { $('draw-offer').classList.remove('hidden'); showAlert('Opponent offers a draw.', 'info'); });
  socket.on('draw_declined',       () => { $('draw-offer').classList.add('hidden');    showAlert('Draw offer declined.',    'info'); });
  socket.on('lobby_error',   (msg) => { const e = $('lobby-error'); e.textContent = msg; e.classList.remove('hidden'); });
  socket.on('opponent_disconnected', () => {
    S.gameOver = true;
    showAlert('⚠️ Opponent disconnected.', 'danger');
    $('status-turn').textContent = 'Opponent disconnected';
    $('status-turn').className   = 'turn-badge idle';
  });
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSocket();

  const roomParam = new URLSearchParams(location.search).get('room');
  if (roomParam) $('input-room-code').value = roomParam;

  // Lobby
  $('btn-create').addEventListener('click', () => {
    $('lobby-error').classList.add('hidden');
    socket.emit('create_room');
  });
  $('btn-join').addEventListener('click', () => {
    const code = $('input-room-code').value.trim();
    if (!code) return;
    $('lobby-error').classList.add('hidden');
    socket.emit('join_room', { roomId: code });
  });
  $('input-room-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });

  // Waiting screen clipboard
  $('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(S.roomId).then(() => {
      $('btn-copy-code').textContent = '✓ Copied!';
      setTimeout(() => ($('btn-copy-code').textContent = 'Copy Code'), 2000);
    });
  });
  $('btn-copy-link').addEventListener('click', () => {
    const url = `${location.origin}${location.pathname}?room=${S.roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      $('btn-copy-link').textContent = '✓ Copied!';
      setTimeout(() => ($('btn-copy-link').textContent = 'Copy Link'), 2000);
    });
  });

  // Move input
  $('btn-move').addEventListener('click', submitMove);
  $('input-move').addEventListener('keydown', e => { if (e.key === 'Enter') submitMove(); });

  // Board toggle
  $('btn-toggle-board').addEventListener('click', () => {
    S.boardRevealed = !S.boardRevealed;
    $('blindfold-msg').classList.toggle('hidden',  S.boardRevealed);
    $('chess-board').classList.toggle('hidden',   !S.boardRevealed);
    $('btn-toggle-board').textContent = S.boardRevealed ? 'Hide Board' : 'Show Board';
    if (S.boardRevealed) renderBoard(S.fen);
  });

  // Game actions
  $('btn-offer-draw').addEventListener('click', () => {
    socket.emit('offer_draw');
    showAlert('Draw offer sent…', 'info');
  });
  $('btn-resign').addEventListener('click', () => {
    if (confirm('Resign this game?')) socket.emit('resign');
  });
  $('btn-accept-draw').addEventListener('click',  () => { socket.emit('accept_draw');  $('draw-offer').classList.add('hidden'); });
  $('btn-decline-draw').addEventListener('click', () => { socket.emit('decline_draw'); $('draw-offer').classList.add('hidden'); });

  // Modal
  $('btn-new-game').addEventListener('click', () => {
    $('modal').classList.add('hidden');
    showScreen('lobby');
    Object.assign(S, { roomId: null, color: null, fen: INITIAL_FEN, history: [], boardRevealed: false, gameOver: false });
  });
  $('btn-close-modal').addEventListener('click', () => $('modal').classList.add('hidden'));
});
