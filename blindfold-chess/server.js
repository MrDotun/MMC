
'use strict';

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const { Chess }  = require('chess.js');
const path     = require('path');
const crypto   = require('crypto');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();
const genId = () => crypto.randomBytes(3).toString('hex').toUpperCase();

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  // ── Create room ───────────────────────────────────────────────────
  socket.on('create_room', () => {
    const roomId = genId();
    rooms.set(roomId, {
      chess:   new Chess(),
      players: { white: socket.id, black: null },
      history: [],
      over:    false,
    });
    socket.join(roomId);
    socket.data.room  = roomId;
    socket.data.color = 'white';
    socket.emit('room_created', { roomId, color: 'white' });
    console.log(`[${roomId}] created`);
  });

  // ── Join room ─────────────────────────────────────────────────────
  socket.on('join_room', ({ roomId }) => {
    const id   = roomId.trim().toUpperCase();
    const room = rooms.get(id);
    if (!room)              return socket.emit('lobby_error', 'Room not found.');
    if (room.players.black) return socket.emit('lobby_error', 'Room is full.');

    room.players.black = socket.id;
    socket.join(id);
    socket.data.room  = id;
    socket.data.color = 'black';

    socket.emit('room_joined', {
      roomId: id, color: 'black',
      history: room.history,
      fen:     room.chess.fen(),
    });
    io.to(room.players.white).emit('opponent_joined');
    console.log(`[${id}] black joined`);
  });

  // ── Make move ─────────────────────────────────────────────────────
  socket.on('make_move', ({ move }) => {
    const room = rooms.get(socket.data.room);
    if (!room || room.over) return;

    const { chess } = room;
    const turnColor = chess.turn() === 'w' ? 'white' : 'black';
    if (socket.data.color !== turnColor)
      return socket.emit('move_error', "It's not your turn.");

    // Try SAN first, then UCI long-algebraic (e2e4 / e7e8q)
    let result = null;
    try { result = chess.move(move); } catch (_) {}

    if (!result) {
      const t = move.trim().toLowerCase();
      if (t.length >= 4) {
        try {
          result = chess.move({
            from:      t.slice(0, 2),
            to:        t.slice(2, 4),
            promotion: t[4] || 'q',
          });
        } catch (_) {}
      }
    }

    if (!result)
      return socket.emit('move_error', `Invalid move: "${move}"`);

    const entry = {
      san:   result.san,
      from:  result.from,
      to:    result.to,
      color: socket.data.color,
      fen:   chess.fen(),
      idx:   room.history.length,
    };
    room.history.push(entry);
    io.to(socket.data.room).emit('move_made', entry);

    // Check game-over conditions
    if (chess.isGameOver()) {
      room.over = true;
      let winner = null, reason = 'draw';
      if (chess.isCheckmate())              { winner = socket.data.color; reason = 'checkmate'; }
      else if (chess.isStalemate())         { reason = 'stalemate'; }
      else if (chess.isThreefoldRepetition()) { reason = 'threefold repetition'; }
      else if (chess.isInsufficientMaterial()) { reason = 'insufficient material'; }
      io.to(socket.data.room).emit('game_over', { winner, reason });
    } else if (chess.isCheck()) {
      io.to(socket.data.room).emit('in_check', {
        color: chess.turn() === 'w' ? 'white' : 'black',
      });
    }
  });

  // ── Draw flow ─────────────────────────────────────────────────────
  socket.on('offer_draw', () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.over) return;
    const opp = socket.data.color === 'white' ? room.players.black : room.players.white;
    if (opp) io.to(opp).emit('draw_offered');
  });

  socket.on('accept_draw', () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.over) return;
    room.over = true;
    io.to(socket.data.room).emit('game_over', { winner: null, reason: 'draw by agreement' });
  });

  socket.on('decline_draw', () => {
    const room = rooms.get(socket.data.room);
    if (!room) return;
    const opp = socket.data.color === 'white' ? room.players.black : room.players.white;
    if (opp) io.to(opp).emit('draw_declined');
  });

  // ── Resign ────────────────────────────────────────────────────────
  socket.on('resign', () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.over) return;
    room.over = true;
    io.to(socket.data.room).emit('game_over', {
      winner: socket.data.color === 'white' ? 'black' : 'white',
      reason: 'resignation',
    });
  });

  // ── Disconnect ────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    const roomId = socket.data.room;
    if (roomId) {
      io.to(roomId).emit('opponent_disconnected');
      setTimeout(() => rooms.delete(roomId), 60_000);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`♟  Blindfold Chess  →  http://localhost:${PORT}`)
);
