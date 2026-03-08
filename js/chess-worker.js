// js/chess-worker.js
importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

// Positional Tables from GarboChess (1700+ Strategy)
const pst = {
    p: [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5,  5, 10, 25, 25, 10,  5,  5],
        [0,  0,  0, 20, 20,  0,  0,  0],
        [5, -5,-10,  0,  0,-10, -5,  5],
        [5, 10, 10,-20,-20, 10, 10,  5],
        [0,  0,  0,  0,  0,  0,  0,  0]
    ],
    n: [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,  0,  0,  0,  0,-20,-40],
        [-30,  0, 10, 15, 15, 10,  0,-30],
        [-30,  5, 15, 20, 20, 15,  5,-30],
        [-30,  0, 15, 20, 20, 15,  0,-30],
        [-30,  5, 10, 15, 15, 10,  5,-30],
        [-40,-20,  0,  5,  5,  0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    k: [ // Encourages Castling and King Safety
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-30, -40, -40, -50, -50, -40, -40, -30],
        [-20, -30, -30, -40, -40, -30, -30, -20],
        [-10, -20, -20, -20, -20, -20, -20, -10],
        [ 20,  20,   0,   0,   0,   0,  20,  20],
        [ 20,  30,  10,   0,   0,  10,  30,  20]
    ]
};

const weights = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluateBoard(game) {
    let totalEval = 0;
    const board = game.board();
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let piece = board[i][j];
            if (piece) {
                let val = weights[piece.type];
                if (pst[piece.type]) {
                    val += (piece.color === 'w' ? pst[piece.type][i][j] : pst[piece.type][7-i][j]);
                }
                totalEval += (piece.color === 'w' ? -val : val);
            }
        }
    }
    return totalEval;
}

function minimax(game, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || game.game_over()) return evaluateBoard(game);

    let moves = game.moves();
    moves.sort((a, b) => b.includes('x') ? 1 : -1); // Move Ordering

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (let move of moves) {
            game.move(move);
            maxEval = Math.max(maxEval, minimax(game, depth - 1, alpha, beta, false));
            game.undo();
            alpha = Math.max(alpha, maxEval);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let move of moves) {
            game.move(move);
            minEval = Math.min(minEval, minimax(game, depth - 1, alpha, beta, true));
            game.undo();
            beta = Math.min(beta, minEval);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

onmessage = function(e) {
    const game = new Chess(e.data.fen);
    let moves = game.moves();
    let bestMove = moves[0];
    let bestValue = Infinity;

    for (let move of moves) {
        game.move(move);
        let boardValue = minimax(game, e.data.depth - 1, -100000, 100000, true);
        game.undo();
        if (boardValue < bestValue) {
            bestValue = boardValue;
            bestMove = move;
        }
    }
    postMessage(bestMove);
};
