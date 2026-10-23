/**
 * Real threat detection via ray-casting.
 * Works with chess.js 0.10.3 (no attackers()/attacks()).
 * Exposes: analyzeThreats(game), extractTacticalMotifs(threats), formatThreats(threats, sideToMove)
 */

const THREAT_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const T_FILES = 'abcdefgh';
const T_N_DELTAS = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
const T_DIAG = [[1,1],[1,-1],[-1,1],[-1,-1]];
const T_ORTH = [[1,0],[-1,0],[0,1],[0,-1]];
const T_KING = [...T_DIAG, ...T_ORTH];
const T_PIECE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };

function analyzeThreats(game) {
    const fen = game.fen();
    const us = game.turn();
    const them = us === 'w' ? 'b' : 'w';

    const board = tParseBoard(fen);
    const ourAtt = tAttackMap(board, us);
    const theirAtt = tAttackMap(board, them);

    const { hanging, attacked } = tFindHanging(board, us, them, ourAtt, theirAtt);

    const ourHanging = [];
    for (const sq in board) {
        const p = board[sq];
        if (p.color !== us || p.type === 'k') continue;
        if (!(theirAtt[sq] || []).length) continue;
        if (!(ourAtt[sq] || []).length && THREAT_VALUES[p.type] >= 3) {
            ourHanging.push({ square: sq, type: p.type });
        }
    }

    const pins = tDetectPins(board, us);
    const skewers = tDetectSkewers(board, us);
    const forks = tDetectForks(board, us);
    const discovered = tDetectDiscovered(board, us);
    const overloaded = tDetectOverloaded(board, them);

    const checks = [], captures = [];
    for (const move of game.moves({ verbose: true })) {
        game.move(move.san);
        if (game.in_check()) checks.push(move.san);
        game.undo();
        if (move.captured) captures.push(move.san + ' wins ' + pieceName(move.captured));
    }

    const threats = {
        hangingPieces: hanging.map(h =>
            pieceName(h.type) + ' on ' + h.square + ' (attacked by ' + h.attackers.map(pieceName).join(',') + ', undefended)'
        ).slice(0, 5),
        attackedPieces: attacked.map(a =>
            pieceName(a.type) + ' on ' + a.square + ' (attacked by ' + a.attackers.map(pieceName).join(',') + ', defended by ' + a.defenders.map(pieceName).join(',') + ')'
        ).slice(0, 5),
        ourHangingPieces: ourHanging.map(h => pieceName(h.type) + ' on ' + h.square).slice(0, 5),
        checksAvailable: checks.slice(0, 8),
        capturesAvailable: captures.slice(0, 5),
        threatsToKing: checks.length > 0 || game.in_check(),
        pins: pins.map(p =>
            pieceName(p.pinnedType) + ' ' + p.pinned + ' pinned to king by ' + pieceName(p.pinnerType) + ' on ' + p.pinner + ' (' + p.line + ')'
        ),
        forks: forks.map(f =>
            pieceName(f.piece) + ' on ' + f.square + ' forks ' + f.targets.map(t => pieceName(t.type) + '@' + t.sq).join(' + ')
        ),
        skewers: skewers.map(s =>
            pieceName(s.byType) + ' on ' + s.by + ' skewers ' + pieceName(s.frontType) + '@' + s.front + ' → ' + pieceName(s.backType) + '@' + s.back
        ),
        discoveredAttacks: discovered.map(d =>
            pieceName(d.targetType) + ' on ' + d.target + ' can be discovered by moving ' + d.blocker
        ),
        doubleAttacks: forks.map(f => f.square),
        overloadedPieces: overloaded.map(o =>
            pieceName(o.piece) + ' on ' + o.square + ' defends ' + o.defending.join(',')
        )
    };
    threats.tacticalMotifs = extractTacticalMotifs(threats);
    return threats;
}

function extractTacticalMotifs(threats) {
    const m = [];
    if (threats.pins && threats.pins.length) m.push('pin');
    if (threats.forks && threats.forks.length) m.push('fork');
    if (threats.skewers && threats.skewers.length) m.push('skewer');
    if (threats.discoveredAttacks && threats.discoveredAttacks.length) m.push('discovered_attack');
    if (threats.doubleAttacks && threats.doubleAttacks.length) m.push('double_attack');
    if (threats.overloadedPieces && threats.overloadedPieces.length) m.push('overloaded');
    return m;
}

function formatThreats(threats, sideToMove) {
    if (!threats) return "";
    const L = ['Threats (' + (sideToMove || 'side') + ' to move):'];
    if (threats.hangingPieces && threats.hangingPieces.length) L.push('- can win: ' + threats.hangingPieces.join('; '));
    if (threats.attackedPieces && threats.attackedPieces.length) L.push('- pressure on: ' + threats.attackedPieces.join('; '));
    if (threats.ourHangingPieces && threats.ourHangingPieces.length) L.push('- our vulnerable: ' + threats.ourHangingPieces.join('; '));
    if (threats.checksAvailable && threats.checksAvailable.length) L.push('- checks: ' + threats.checksAvailable.join(', '));
    if (threats.capturesAvailable && threats.capturesAvailable.length) L.push('- captures: ' + threats.capturesAvailable.join(', '));
    if (threats.pins && threats.pins.length) L.push('- pins: ' + threats.pins.join('; '));
    if (threats.forks && threats.forks.length) L.push('- forks: ' + threats.forks.join('; '));
    if (threats.skewers && threats.skewers.length) L.push('- skewers: ' + threats.skewers.join('; '));
    if (threats.discoveredAttacks && threats.discoveredAttacks.length) L.push('- discoveries: ' + threats.discoveredAttacks.join('; '));
    if (threats.overloadedPieces && threats.overloadedPieces.length) L.push('- overloaded: ' + threats.overloadedPieces.join('; '));
    if (L.length === 1) L.push('- none');
    return L.join('\n');
}

function pieceName(type) {
    return T_PIECE_NAMES[type] || type;
}

function tParseBoard(fen) {
    const board = {};
    const rows = fen.split(' ')[0].split('/');
    for (let r = 0; r < 8; r++) {
        let f = 0;
        for (const ch of rows[r]) {
            if (ch >= '1' && ch <= '8') { f += parseInt(ch, 10); continue; }
            board[T_FILES[f] + (8 - r)] = {
                type: ch.toLowerCase(),
                color: ch === ch.toUpperCase() ? 'w' : 'b'
            };
            f++;
        }
    }
    return board;
}

function tSqXY(sq) {
    return { x: T_FILES.indexOf(sq[0]), y: parseInt(sq[1], 10) - 1 };
}

function tXySq(x, y) {
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return T_FILES[x] + (y + 1);
}

function tGetAttacks(board, sq) {
    const piece = board[sq];
    if (!piece) return [];
    const xy = tSqXY(sq);
    const x = xy.x, y = xy.y;
    const out = [];

    const slide = (dirs) => {
        for (const [dx, dy] of dirs) {
            let nx = x + dx, ny = y + dy;
            while (true) {
                const t = tXySq(nx, ny);
                if (!t) break;
                const p = board[t];
                if (!p) out.push(t);
                else {
                    if (p.color !== piece.color) out.push(t);
                    break;
                }
                nx += dx; ny += dy;
            }
        }
    };

    switch (piece.type) {
        case 'p': {
            const dy = piece.color === 'w' ? 1 : -1;
            for (const dx of [-1, 1]) {
                const t = tXySq(x + dx, y + dy);
                if (t) out.push(t);
            }
            break;
        }
        case 'n': {
            for (const d of T_N_DELTAS) {
                const t = tXySq(x + d[0], y + d[1]);
                if (t) out.push(t);
            }
            break;
        }
        case 'b': slide(T_DIAG); break;
        case 'r': slide(T_ORTH); break;
        case 'q': slide(T_DIAG.concat(T_ORTH)); break;
        case 'k': {
            for (const d of T_KING) {
                const t = tXySq(x + d[0], y + d[1]);
                if (t) out.push(t);
            }
            break;
        }
    }
    return out;
}

function tAttackMap(board, color) {
    const map = {};
    for (const sq in board) {
        if (board[sq].color !== color) continue;
        for (const t of tGetAttacks(board, sq)) {
            if (!map[t]) map[t] = [];
            map[t].push(sq);
        }
    }
    return map;
}

function tDetectPins(board, color) {
    const pins = [];
    const opp = color === 'w' ? 'b' : 'w';
    let kingSq = null;
    for (const sq in board) {
        if (board[sq].type === 'k' && board[sq].color === color) { kingSq = sq; break; }
    }
    if (!kingSq) return pins;
    const kxy = tSqXY(kingSq);
    const kx = kxy.x, ky = kxy.y;

    for (const d of T_KING) {
        const dx = d[0], dy = d[1];
        let nx = kx + dx, ny = ky + dy, front = null, frontSq = null;
        while (true) {
            const t = tXySq(nx, ny);
            if (!t) break;
            const p = board[t];
            if (p) {
                if (!front) {
                    if (p.color === opp || p.type === 'k') break;
                    front = p; frontSq = t;
                } else {
                    const isDiag = dx !== 0 && dy !== 0;
                    const sliders = isDiag ? ['b','q'] : ['r','q'];
                    if (p.color === opp && sliders.indexOf(p.type) !== -1) {
                        pins.push({
                            pinned: frontSq, pinnedType: front.type,
                            pinner: t, pinnerType: p.type,
                            line: isDiag ? 'diagonal' : (dx === 0 ? 'file' : 'rank')
                        });
                    }
                    break;
                }
            }
            nx += dx; ny += dy;
        }
    }
    return pins;
}

function tDetectSkewers(board, color) {
    const out = [];
    const opp = color === 'w' ? 'b' : 'w';
    for (const sq in board) {
        const p = board[sq];
        if (p.color !== color) continue;
        if (['b','r','q'].indexOf(p.type) === -1) continue;
        const xy = tSqXY(sq);
        const x = xy.x, y = xy.y;
        const dirs = p.type === 'b' ? T_DIAG
                   : p.type === 'r' ? T_ORTH
                   : T_DIAG.concat(T_ORTH);
        for (const d of dirs) {
            const dx = d[0], dy = d[1];
            let nx = x + dx, ny = y + dy, front = null, frontSq = null;
            while (true) {
                const t = tXySq(nx, ny);
                if (!t) break;
                const q = board[t];
                if (q) {
                    if (!front) {
                        if (q.color === color) break;
                        front = q; frontSq = t;
                    } else {
                        if (q.color === opp && THREAT_VALUES[front.type] > THREAT_VALUES[q.type]) {
                            out.push({
                                by: sq, byType: p.type,
                                front: frontSq, frontType: front.type,
                                back: t, backType: q.type
                            });
                        }
                        break;
                    }
                }
                nx += dx; ny += dy;
            }
        }
    }
    return out;
}

function tDetectForks(board, color) {
    const out = [];
    for (const sq in board) {
        const p = board[sq];
        if (p.color !== color) continue;
        const targets = [];
        for (const t of tGetAttacks(board, sq)) {
            const q = board[t];
            if (!q || q.color === color) continue;
            if (q.type === 'k' || THREAT_VALUES[q.type] >= 3) {
                targets.push({ sq: t, type: q.type, value: THREAT_VALUES[q.type] });
            }
        }
        if (targets.length >= 2) {
            out.push({ square: sq, piece: p.type, targets: targets });
        }
    }
    return out;
}

function tDetectDiscovered(board, color) {
    const out = [];
    const opp = color === 'w' ? 'b' : 'w';
    for (const sq in board) {
        const p = board[sq];
        if (p.color !== color) continue;
        if (['b','r','q'].indexOf(p.type) === -1) continue;
        const xy = tSqXY(sq);
        const x = xy.x, y = xy.y;
        const dirs = p.type === 'b' ? T_DIAG
                   : p.type === 'r' ? T_ORTH
                   : T_DIAG.concat(T_ORTH);
        for (const d of dirs) {
            const dx = d[0], dy = d[1];
            let nx = x + dx, ny = y + dy, blocker = null;
            while (true) {
                const t = tXySq(nx, ny);
                if (!t) break;
                const q = board[t];
                if (q) {
                    if (!blocker) {
                        if (q.color !== color) break;
                        blocker = t;
                    } else {
                        if (q.color === opp) {
                            out.push({
                                slider: sq, sliderType: p.type,
                                blocker: blocker, target: t, targetType: q.type
                            });
                        }
                        break;
                    }
                }
                nx += dx; ny += dy;
            }
        }
    }
    return out;
}

function tDetectOverloaded(board, color) {
    const defenders = {};
    for (const sq in board) {
        if (board[sq].color !== color) continue;
        for (const t of tGetAttacks(board, sq)) {
            if (board[t] && board[t].color === color && THREAT_VALUES[board[t].type] >= 3) {
                if (!defenders[sq]) defenders[sq] = [];
                defenders[sq].push(t);
            }
        }
    }
    const out = [];
    for (const sq in defenders) {
        if (defenders[sq].length >= 2) {
            out.push({ square: sq, piece: board[sq].type, defending: defenders[sq] });
        }
    }
    return out;
}

function tFindHanging(board, us, them, ourAtt, theirAtt) {
    const hanging = [], attacked = [];
    for (const sq in board) {
        const p = board[sq];
        if (p.color !== them || p.type === 'k') continue;
        const ourAttackers = ourAtt[sq] || [];
        if (!ourAttackers.length) continue;
        const defenders = theirAtt[sq] || [];
        const minAtt = Math.min.apply(null, ourAttackers.map(a => THREAT_VALUES[board[a].type]));
        const val = THREAT_VALUES[p.type];
        if (!defenders.length) {
            hanging.push({
                square: sq, type: p.type,
                attackers: ourAttackers.map(a => board[a].type), value: val
            });
        } else if (val > minAtt) {
            attacked.push({
                square: sq, type: p.type,
                attackers: ourAttackers.map(a => board[a].type),
                defenders: defenders.map(d => board[d].type)
            });
        }
    }
    return { hanging: hanging, attacked: attacked };
}

window.analyzeThreats = analyzeThreats;
window.extractTacticalMotifs = extractTacticalMotifs;
window.formatThreats = formatThreats;
