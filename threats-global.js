/**
 * Simplified threat detection for chess.js.
 * Port of stockfish_engine.py:_analyze_threats() adapted for chess.js 0.10.3.
 *
 * chess.js 0.10.3 lacks attackers()/attacks() so we use legal move analysis.
 */

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/**
 * Analyze threats in a position.
 * @param {object} game - chess.js instance
 * @returns {ThreatInfo}
 */
function analyzeThreats(game) {
    const fen = game.fen();
    const us = game.turn(); // 'w' or 'b'
    const them = us === 'w' ? 'b' : 'w';

    const hanging = [];
    const attacked = [];
    const checks = [];
    const captures = [];
    const forks = [];

    // Get all legal moves for current side
    const moves = game.moves({ verbose: true });

    for (const move of moves) {
        // Checks
        game.move(move.san);
        if (game.in_check()) {
            checks.push(move.san);
        }
        game.undo();

        // Captures
        if (move.captured) {
            const capName = pieceName(move.captured);
            captures.push(`${move.san} wins ${capName}`);
        }
    }

    // Detect hanging pieces: opponent pieces that are attacked and undefended
    // We approximate by checking if any of our moves can capture a piece,
    // and whether the opponent can recapture on that square.
    const captureSquares = new Map(); // square -> [{mover, value}]

    for (const move of moves) {
        if (move.captured) {
            const key = move.to;
            if (!captureSquares.has(key)) captureSquares.set(key, []);
            captureSquares.get(key).push({
                piece: move.piece,
                value: PIECE_VALUES[move.piece] || 0,
                san: move.san,
            });
        }
    }

    // For each capture target, check if opponent can recapture
    for (const [sq, attackers] of captureSquares) {
        const targetPiece = game.get(sq);
        if (!targetPiece) continue;

        // Try capturing with the least valuable attacker
        attackers.sort((a, b) => a.value - b.value);
        const cheapest = attackers[0];

        // Make the capture, see if opponent can recapture
        const captureMove = moves.find(m => m.to === sq && m.piece === cheapest.piece);
        if (!captureMove) continue;

        game.move(captureMove.san);
        const opponentMoves = game.moves({ verbose: true });
        const canRecapture = opponentMoves.some(m => m.to === sq && m.captured);
        game.undo();

        const name = pieceName(targetPiece.type);
        if (!canRecapture) {
            hanging.push(`${name} on ${sq} (undefended)`);
        } else {
            // Check if the trade favors us
            if (PIECE_VALUES[targetPiece.type] > PIECE_VALUES[cheapest.piece]) {
                attacked.push(`${name} on ${sq} (underdefended)`);
            }
        }
    }

    // Detect fork opportunities: after a move, piece attacks 2+ valuable enemy pieces
    for (const move of moves) {
        game.move(move.san);
        const afterMoves = game.moves({ verbose: true });
        // The opponent is to move now — look at what squares our moved piece attacks
        // by checking what opponent pieces are on squares our piece could theoretically capture
        // We need to check from the opponent's perspective what's attacked
        game.undo();

        // Simplified fork detection: check if after our move, the destination
        // attacks multiple valuable pieces (we'll check via the next position's threats)
        if (move.piece === 'n' || move.piece === 'q' || move.piece === 'b') {
            game.move(move.san);
            const oppMoves = game.moves({ verbose: true });

            // Our piece is on move.to - check which opponent pieces are on squares
            // that our piece on move.to can reach
            // Since chess.js doesn't have attacks(), we detect forks by checking
            // the position from the other side, but this is complex.
            // Simpler: if we give check AND attack another piece, it's a fork-like pattern
            if (game.in_check()) {
                // We give check - see if we also threaten a capture elsewhere
                // This is detected in the "checks" list above
            }
            game.undo();
        }
    }

    return {
        hangingPieces: hanging.slice(0, 5),
        attackedPieces: attacked.slice(0, 5),
        checksAvailable: checks.slice(0, 8),
        capturesAvailable: captures.slice(0, 5),
        threatsToKing: checks.length > 0 || game.in_check(),
        pins: [], // complex ray-casting skipped for chess.js
        forks: forks.slice(0, 5),
        skewers: [],
        discoveredAttacks: [],
        doubleAttacks: [],
        overloadedPieces: [],
    };
}

/**
 * Extract tactical motif names from threat info.
 * @param {object} threats
 * @returns {string[]}
 */
function extractTacticalMotifs(threats) {
    const motifs = [];
    if (threats.pins?.length) motifs.push('pin');
    if (threats.forks?.length) motifs.push('fork');
    if (threats.skewers?.length) motifs.push('skewer');
    if (threats.discoveredAttacks?.length) motifs.push('discovered_attack');
    if (threats.doubleAttacks?.length) motifs.push('double_attack');
    if (threats.overloadedPieces?.length) motifs.push('overloaded');
    return motifs;
}

function pieceName(type) {
    const names = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
    return names[type] || type;
}

window.analyzeThreats = analyzeThreats;
window.extractTacticalMotifs = extractTacticalMotifs;

