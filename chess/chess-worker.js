importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

// 1. Material Weights
const weights = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// 2. Positional Tables (PST) - This makes the AI "smart" about the center
const pst = {
    p: [
        [0, 0, 0, 0, 0, 0, 0, 0], [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10], [5, 5, 10, 25, 25, 10, 5, 5],
        [0, 0, 0, 20, 20, 0, 0, 0], [5, -5, -10, 0, 0, -10, -5, 5],
        [5, 10, 10, -20, -20, 10, 10, 5], [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    n: [
        [-50,-40,-30,-30,-30,-30,-40,-50], [-40,-20, 0, 5, 5, 0,-20,-40],
        [-30, 5, 10, 15, 15, 10, 5,-30], [-30, 0, 15, 20, 20, 15, 0,-30],
        [-30, 5, 15, 20, 20, 15, 5,-30], [-30, 0, 10, 15, 15, 10, 0,-30],
        [-40,-20, 0, 0, 0, 0,-20,-40], [-50,-40,-30,-30,-30,-30,-40,-50]
    ]
};

function evaluateBoard(game) {
    let total = 0;
    const board = game.board();
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let p = board[i][j];
            if (p) {
                let val = weights[p.type];
                if (pst[p.type]) {
                    val += (p.color === 'w' ? pst[p.type][i][j] : pst[p.type][7-i][j]);
                }
                total += (p.color === 'w' ? -val : val);
            }
        }
    }
    return total;
}

// 3. Alpha-Beta Search with Move Ordering
function minimax(game, depth, alpha, beta, isMax) {
    if (depth === 0 || game.game_over()) return evaluateBoard(game);

    // MVV-LVA: Sort moves to check captures first (Massive Speedup)
    let moves = game.moves({verbose: true}).sort((a, b) => {
        if (a.captured && b.captured) return weights[b.captured] - weights[a.captured];
        return (b.captured ? 1 : 0) - (a.captured ? 1 : 0);
    });

    let bestScore = isMax ? -Infinity : Infinity;
    for (let move of moves) {
        game.move(move);
        let score = minimax(game, depth - 1, alpha, beta, !isMax);
        game.undo();

        if (isMax) {
            bestScore = Math.max(bestScore, score);
            alpha = Math.max(alpha, bestScore);
        } else {
            bestScore = Math.min(bestScore, score);
            beta = Math.min(beta, bestScore);
        }
        if (beta <= alpha) break; // Pruning
    }
    return bestScore;
}

onmessage = function(e) {
    const game = new Chess(e.data);
    let moves = game.moves();
    let bestMove = moves[0];
    let bestValue = -Infinity;

    for (let move of moves) {
        game.move(move);
        let boardValue = minimax(game, 3, -10000, 10000, false);
        game.undo();
        if (boardValue > bestValue) {
            bestValue = boardValue;
            bestMove = move;
        }
    }
    postMessage(bestMove);
};
