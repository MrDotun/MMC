/**
 * Structural / positional analysis of a FEN for AI consumption.
 * Exposes: analyzePosition(fen), formatPositionAnalysis(analysis)
 */

const POS_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const P_FILES = 'abcdefgh';
const P_PIECE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
const P_N_DELTAS = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
const P_DIAG = [[1,1],[1,-1],[-1,1],[-1,-1]];
const P_ORTH = [[1,0],[-1,0],[0,1],[0,-1]];

function analyzePosition(fen) {
    if (!fen) return null;
    const parsed = pParseFen(fen);
    const board = parsed.board;
    const castling = parsed.castling;
    const turn = parsed.turn;

    const mat = pMaterial(board);
    const wPawns = pPawns(board, 'w');
    const bPawns = pPawns(board, 'b');

    return {
        fen: fen,
        turn: turn,
        material: mat,
        structure: { white: wPawns, black: bPawns },
        king: {
            white: pKingSafety(board, castling, 'w'),
            black: pKingSafety(board, castling, 'b')
        },
        files: pFiles(board),
        activity: {
            white: pActivity(board, 'w'),
            black: pActivity(board, 'b')
        },
        outposts: {
            white: pOutposts(board, 'w', wPawns),
            black: pOutposts(board, 'b', bPawns)
        },
        weakSquares: {
            white: pWeakSquares(board, 'w', wPawns),
            black: pWeakSquares(board, 'b', bPawns)
        }
    };
}

function formatPositionAnalysis(A) {
    if (!A) return "";
    const L = [];

    const m = A.material;
    if (m.diff === 0) L.push("Material: equal");
    else if (m.diff > 0) L.push("Material: +" + m.diff + " for White");
    else L.push("Material: +" + (-m.diff) + " for Black");

    const fmtPawns = function (p, side) {
        const parts = [];
        if (p.passed.length) parts.push("passed " + p.passed.join(','));
        if (p.isolated.length) parts.push("isolated " + p.isolated.join(','));
        if (p.doubled.length) parts.push("doubled " + p.doubled.join(','));
        return parts.length ? side + ": " + parts.join('; ') : null;
    };
    const sW = fmtPawns(A.structure.white, 'W');
    const sB = fmtPawns(A.structure.black, 'B');
    if (sW || sB) {
        const bits = [sW, sB].filter(Boolean);
        L.push("Pawns — " + bits.join(' | '));
    }

    const fk = function (k, side) {
        if (!k) return null;
        const cast = k.castled ? "castled" : k.uncastled ? "uncastled" : "king moved";
        const shield = k.pawnShield.length ? "shield " + k.pawnShield.join(',') : "no shield";
        const files = k.openNearKing.length ? "; " + k.openNearKing.join(',') + " near king" : "";
        return side + ": " + k.square + " " + cast + ", " + shield + files;
    };
    const kw = fk(A.king.white, 'W');
    const kb = fk(A.king.black, 'B');
    L.push("Kings — " + [kw, kb].filter(Boolean).join(' | '));

    const fparts = [];
    if (A.files.open.length) fparts.push("open " + A.files.open.join(''));
    if (A.files.halfWhite.length) fparts.push("half-open for White: " + A.files.halfWhite.join(''));
    if (A.files.halfBlack.length) fparts.push("half-open for Black: " + A.files.halfBlack.join(''));
    if (fparts.length) L.push("Files — " + fparts.join('; '));

    const fa = function (a, side) {
        const top = a.pieces.slice(0, 3).map(p => pPieceName(p.type)[0] + p.square + '(' + p.mobility + ')');
        const bp = a.bishopPair ? " [bishop pair]" : "";
        return side + ": " + top.join(' ') + bp;
    };
    L.push("Activity — " + fa(A.activity.white, 'W') + " | " + fa(A.activity.black, 'B'));

    const op = [];
    if (A.outposts.white.length) op.push("White: " + A.outposts.white.join(', '));
    if (A.outposts.black.length) op.push("Black: " + A.outposts.black.join(', '));
    if (op.length) L.push("Outposts — " + op.join(' | '));

    const ws = [];
    if (A.weakSquares.white.length) ws.push("White holes: " + A.weakSquares.white.join(','));
    if (A.weakSquares.black.length) ws.push("Black holes: " + A.weakSquares.black.join(','));
    if (ws.length) L.push("Weak squares — " + ws.join(' | '));

    return L.join('\n');
}

function pPieceName(type) {
    return P_PIECE_NAMES[type] || type;
}

function pParseFen(fen) {
    const parts = fen.split(' ');
    const board = {};
    const rows = parts[0].split('/');
    for (let r = 0; r < 8; r++) {
        let f = 0;
        for (const ch of rows[r]) {
            if (ch >= '1' && ch <= '8') { f += parseInt(ch, 10); continue; }
            board[P_FILES[f] + (8 - r)] = {
                type: ch.toLowerCase(),
                color: ch === ch.toUpperCase() ? 'w' : 'b'
            };
            f++;
        }
    }
    return { board: board, turn: parts[1], castling: parts[2] || '-' };
}

function pSqXY(sq) {
    return { x: P_FILES.indexOf(sq[0]), y: parseInt(sq[1], 10) - 1 };
}

function pXySq(x, y) {
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return P_FILES[x] + (y + 1);
}

function pMobility(board, sq) {
    const p = board[sq];
    if (!p) return 0;
    const xy = pSqXY(sq);
    const x = xy.x, y = xy.y;
    let count = 0;

    const slide = function (dirs) {
        for (const d of dirs) {
            let nx = x + d[0], ny = y + d[1];
            while (true) {
                const t = pXySq(nx, ny);
                if (!t) break;
                const q = board[t];
                if (!q) count++;
                else {
                    if (q.color !== p.color) count++;
                    break;
                }
                nx += d[0]; ny += d[1];
            }
        }
    };

    switch (p.type) {
        case 'n': {
            for (const d of P_N_DELTAS) {
                const t = pXySq(x + d[0], y + d[1]);
                if (t && (!board[t] || board[t].color !== p.color)) count++;
            }
            break;
        }
        case 'b': slide(P_DIAG); break;
        case 'r': slide(P_ORTH); break;
        case 'q': slide(P_DIAG.concat(P_ORTH)); break;
        case 'k': {
            const all = P_DIAG.concat(P_ORTH);
            for (const d of all) {
                const t = pXySq(x + d[0], y + d[1]);
                if (t && (!board[t] || board[t].color !== p.color)) count++;
            }
            break;
        }
    }
    return count;
}

function pMaterial(board) {
    let w = 0, b = 0;
    const count = { w: {}, b: {} };
    for (const sq in board) {
        const p = board[sq];
        const v = POS_VALUES[p.type] || 0;
        if (p.color === 'w') {
            w += v;
            count.w[p.type] = (count.w[p.type] || 0) + 1;
        } else {
            b += v;
            count.b[p.type] = (count.b[p.type] || 0) + 1;
        }
    }
    return { white: w, black: b, diff: w - b, count: count };
}

function pPawns(board, color) {
    const own = {}, opp = {};
    for (const sq in board) {
        const p = board[sq];
        if (p.type !== 'p') continue;
        const file = sq[0];
        const rank = parseInt(sq[1], 10);
        const bucket = p.color === color ? own : opp;
        if (!bucket[file]) bucket[file] = [];
        bucket[file].push(rank);
    }

    const doubled = [], isolated = [], passed = [];
    for (const file in own) {
        const ranks = own[file];
        if (ranks.length > 1) doubled.push(file + 'x' + ranks.length);

        const idx = P_FILES.indexOf(file);
        const lf = P_FILES[idx - 1];
        const rf = P_FILES[idx + 1];
        const hasL = lf && own[lf];
        const hasR = rf && own[rf];
        if (!hasL && !hasR) isolated.push(file + ranks.join(','));

        for (const rank of ranks) {
            let isPassed = true;
            for (const df of [-1, 0, 1]) {
                const f = P_FILES[idx + df];
                if (!f) continue;
                if (opp[f]) {
                    for (const r of opp[f]) {
                        if (color === 'w' ? r > rank : r < rank) { isPassed = false; break; }
                    }
                }
                if (!isPassed) break;
            }
            if (isPassed) passed.push(file + rank);
        }
    }
    return { doubled: doubled, isolated: isolated, passed: passed, own: own, opp: opp };
}

function pKingSafety(board, castling, color) {
    let kingSq = null;
    for (const sq in board) {
        if (board[sq].type === 'k' && board[sq].color === color) { kingSq = sq; break; }
    }
    if (!kingSq) return null;

    const file = kingSq[0];
    const rank = parseInt(kingSq[1], 10);
    const idx = P_FILES.indexOf(file);
    const dir = color === 'w' ? 1 : -1;
    const back = color === 'w' ? 1 : 8;

    const castled = (file === 'g' || file === 'c') && rank === back;
    const uncastled = file === 'e' && rank === back;
    const canK = color === 'w' ? castling.indexOf('K') !== -1 : castling.indexOf('k') !== -1;
    const canQ = color === 'w' ? castling.indexOf('Q') !== -1 : castling.indexOf('q') !== -1;

    const shield = [];
    for (const df of [-1, 0, 1]) {
        const f = P_FILES[idx + df];
        if (!f) continue;
        for (const dr of [1, 2]) {
            const sq = f + (rank + dir * dr);
            const q = board[sq];
            if (q && q.type === 'p' && q.color === color) shield.push(sq);
        }
    }

    const openNearKing = [];
    for (const df of [-1, 0, 1]) {
        const f = P_FILES[idx + df];
        if (!f) continue;
        let hasF = false, hasE = false;
        for (let r = 1; r <= 8; r++) {
            const q = board[f + r];
            if (q && q.type === 'p') {
                if (q.color === color) hasF = true;
                else hasE = true;
            }
        }
        if (!hasF && !hasE) openNearKing.push(f + '(open)');
        else if (!hasF) openNearKing.push(f + '(semi)');
    }

    return {
        square: kingSq, castled: castled, uncastled: uncastled,
        canCastleShort: canK, canCastleLong: canQ,
        pawnShield: shield, openNearKing: openNearKing
    };
}

function pFiles(board) {
    const open = [], halfWhite = [], halfBlack = [];
    for (let fi = 0; fi < 8; fi++) {
        const f = P_FILES[fi];
        let wP = false, bP = false;
        for (let r = 1; r <= 8; r++) {
            const p = board[f + r];
            if (p && p.type === 'p') {
                if (p.color === 'w') wP = true;
                else bP = true;
            }
        }
        if (!wP && !bP) open.push(f);
        else if (!wP) halfWhite.push(f);
        else if (!bP) halfBlack.push(f);
    }
    return { open: open, halfWhite: halfWhite, halfBlack: halfBlack };
}

function pActivity(board, color) {
    const out = { pieces: [], bishopPair: false };
    let bishops = 0;
    for (const sq in board) {
        const p = board[sq];
        if (p.color !== color) continue;
        if (p.type === 'b') bishops++;
        if (['n','b','r','q'].indexOf(p.type) !== -1) {
            out.pieces.push({ type: p.type, square: sq, mobility: pMobility(board, sq) });
        }
    }
    out.pieces.sort((a, b) => b.mobility - a.mobility);
    out.bishopPair = bishops >= 2;
    return out;
}

function pOutposts(board, color, pawnsInfo) {
    const result = [];
    for (const sq in board) {
        const p = board[sq];
        if (p.color !== color) continue;
        if (['n','b'].indexOf(p.type) === -1) continue;
        const idx = P_FILES.indexOf(sq[0]);
        const rank = parseInt(sq[1], 10);

        let enemyPawnCanAttack = false;
        for (const df of [-1, 1]) {
            const f = P_FILES[idx + df];
            if (!f) continue;
            if (pawnsInfo.opp[f]) {
                for (const r of pawnsInfo.opp[f]) {
                    if (color === 'w' ? (r > rank && r <= rank + 2) : (r < rank && r >= rank - 2)) {
                        enemyPawnCanAttack = true;
                        break;
                    }
                }
            }
            if (enemyPawnCanAttack) break;
        }

        const dir = color === 'w' ? 1 : -1;
        let defendedByPawn = false;
        for (const df of [-1, 1]) {
            const f = P_FILES[idx + df];
            if (!f) continue;
            const supportRank = rank - dir;
            const support = board[f + supportRank];
            if (support && support.type === 'p' && support.color === color) {
                defendedByPawn = true;
                break;
            }
        }

        if (!enemyPawnCanAttack && defendedByPawn) {
            result.push(pPieceName(p.type) + ' ' + sq);
        }
    }
    return result;
}

function pWeakSquares(board, color, pawnsInfo) {
    const out = [];
    for (let fi = 0; fi < 8; fi++) {
        for (let ri = 0; ri < 8; ri++) {
            const sq = P_FILES[fi] + (ri + 1);
            if (board[sq] && board[sq].type === 'p') continue;
            const rank = ri + 1;
            let defendable = false;
            for (const df of [-1, 1]) {
                const f = P_FILES[fi + df];
                if (!f) continue;
                if (pawnsInfo.own[f]) {
                    for (const r of pawnsInfo.own[f]) {
                        if (color === 'w' && (r === rank - 1 || r === rank - 2)) { defendable = true; break; }
                        if (color === 'b' && (r === rank + 1 || r === rank + 2)) { defendable = true; break; }
                    }
                }
                if (defendable) break;
            }
            if (!defendable) out.push(sq);
        }
    }
    return out.slice(0, 6);
}

window.analyzePosition = analyzePosition;
window.formatPositionAnalysis = formatPositionAnalysis;
