importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

const weights = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
const transpositionTable = new Map(); // Global cache for position evaluation

// Professional-grade Piece-Square Tables for positional dominance
const pst = {
    p: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
    n: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,5,5,0,-20,-40],[-30,5,10,15,15,10,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,10,15,15,10,0,-30],[-40,-20,0,0,0,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
    b: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,5,0,0,0,0,5,-10],[-10,10,10,10,10,10,10,-10],[-10,0,10,10,10,10,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,5,10,10,5,0,-10],[-10,0,0,0,0,0,0,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
    r: [[0,0,0,5,5,0,0,0],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[5,10,10,10,10,10,10,5],[0,0,0,0,0,0,0,0]],
    q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,5,0,0,0,0,-10],[-10,5,5,5,5,5,0,-10],[0,0,5,5,5,5,0,-5],[-5,0,5,5,5,5,0,-5],[-10,0,5,5,5,5,0,-10],[-10,0,0,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
    k: [[20,30,10,0,0,10,30,20],[20,20,0,0,0,0,20,20],[-10,-20,-20,-20,-20,-20,-20,-10],[-20,-30,-30,-40,-40,-30,-30,-20],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30]]
};

function evaluateBoard(game) {
    let totalEval = 0;
    const board = game.board();
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (piece) {
                const val = weights[piece.type] + pst[piece.type][piece.color === 'w' ? 7 - i : i][j];
                totalEval += (piece.color === 'w' ? -val : val);
            }
        }
    }
    return totalEval;
}

// MVV-LVA move ordering for faster pruning
function scoreMove(move) {
    if (move.captured) return (weights[move.captured] * 10) - weights[move.piece];
    if (move.promotion) return 900;
    return 0;
}

function minimax(game, depth, alpha, beta, isMaximizing) {
    const key = game.fen() + depth;
    if (transpositionTable.has(key)) return transpositionTable.get(key);

    if (depth === 0 || game.game_over()) return evaluateBoard(game);

    let moves = game.moves({ verbose: true });
    moves.sort((a, b) => scoreMove(b) - scoreMove(a));

    let best = isMaximizing ? -Infinity : Infinity;

    for (let move of moves) {
        game.move(move);
        let score = minimax(game, depth - 1, alpha, beta, !isMaximizing);
        game.undo();

        if (isMaximizing) {
            best = Math.max(best, score);
            alpha = Math.max(alpha, best);
        } else {
            best = Math.min(best, score);
            beta = Math.min(beta, best);
        }
        if (beta <= alpha) break;
    }
    transpositionTable.set(key, best);
    return best;
}

self.onmessage = function(e) {
    const game = new Chess(e.data.fen);
    let moves = game.moves({ verbose: true });
    moves.sort((a, b) => scoreMove(b) - scoreMove(a));

    let bestMove = null;
    let bestValue = -Infinity;

    // Iterative Deepening to find best move within time constraints
    for (let d = 1; d <= e.data.depth; d++) {
        for (let move of moves) {
            game.move(move);
            let val = minimax(game, d - 1, -100000, 100000, false);
            game.undo();
            if (val > bestValue) {
                bestValue = val;
                bestMove = move;
            }
        }
    }
    self.postMessage(bestMove);
};
