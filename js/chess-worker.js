// js/chess-worker.js
importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

// Evaluation tables to encourage center control and king safety
const pawnEval = [
    [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    [5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0,  5.0],
    [1.0,  1.0,  2.0,  3.0,  3.0,  2.0,  1.0,  1.0],
    [0.5,  0.5,  1.0,  2.5,  2.5,  1.0,  0.5,  0.5],
    [0.0,  0.0,  0.0,  2.0,  2.0,  0.0,  0.0,  0.0],
    [0.5, -0.5, -1.0,  0.0,  0.0, -1.0, -0.5,  0.5],
    [0.5,  1.0, 1.0, -2.0, -2.0,  1.0,  1.0,  0.5],
    [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0]
];

const knightEval = [
    [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0],
    [-4.0, -2.0,  0.0,  0.0,  0.0,  0.0, -2.0, -4.0],
    [-3.0,  0.0,  1.0,  1.5,  1.5,  1.0,  0.0, -3.0],
    [-3.0,  0.5,  1.5,  2.0,  2.0,  1.5,  0.5, -3.0],
    [-3.0,  0.0,  1.5,  2.0,  2.0,  1.5,  0.0, -3.0],
    [-3.0,  0.5,  1.0,  1.5,  1.5,  1.0,  0.5, -3.0],
    [-4.0, -2.0,  0.0,  0.5,  0.5,  0.0, -2.0, -4.0],
    [-5.0, -4.0, -3.0, -3.0, -3.0, -3.0, -4.0, -5.0]
];

const kingEval = [
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-3.0, -4.0, -4.0, -5.0, -5.0, -4.0, -4.0, -3.0],
    [-2.0, -3.0, -3.0, -4.0, -4.0, -3.0, -3.0, -2.0],
    [-1.0, -2.0, -2.0, -2.0, -2.0, -2.0, -2.0, -1.0],
    [ 2.0,  2.0,  0.0,  0.0,  0.0,  0.0,  2.0,  2.0],
    [ 2.0,  3.0,  1.0,  0.0,  0.0,  1.0,  3.0,  2.0]
];

const weights = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

function evaluateBoard(game) {
    let totalEvaluation = 0;
    const board = game.board();
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let piece = board[i][j];
            if (piece) {
                let val = weights[piece.type];
                if (piece.type === 'p') val += (piece.color === 'w' ? pawnEval[i][j] : pawnEval[7-i][j]);
                if (piece.type === 'n') val += knightEval[i][j];
                if (piece.type === 'k') val += (piece.color === 'w' ? kingEval[i][j] : kingEval[7-i][j]);
                totalEvaluation += (piece.color === 'w' ? -val : val);
            }
        }
    }
    return totalEvaluation;
}

function minimax(game, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || game.game_over()) return evaluateBoard(game);

    let moves = game.moves();
    // Sort moves: Captures first to speed up Alpha-Beta pruning
    moves.sort((a, b) => (b.includes('x') ? 1 : -1));

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let move of moves) {
            game.move(move);
            bestScore = Math.max(bestScore, minimax(game, depth - 1, alpha, beta, false));
            game.undo();
            alpha = Math.max(alpha, bestScore);
            if (beta <= alpha) break;
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let move of moves) {
            game.move(move);
            bestScore = Math.min(bestScore, minimax(game, depth - 1, alpha, beta, true));
            game.undo();
            beta = Math.min(beta, bestScore);
            if (beta <= alpha) break;
        }
        return bestScore;
    }
}

onmessage = function(e) {
    const { fen, depth } = e.data;
    const game = new Chess(fen);
    let moves = game.moves();
    moves.sort((a, b) => (b.includes('x') ? 1 : -1));

    let bestMove = moves[0];
    let bestValue = -Infinity;

    for (let move of moves) {
        game.move(move);
        // AI plays Black: it wants to minimize White's advantage (maximize negative score)
        let boardValue = -minimax(game, depth - 1, -100000, 100000, true);
        game.undo();
        if (boardValue > bestValue) {
            bestValue = boardValue;
            bestMove = move;
        }
    }
    postMessage(bestMove);
};
