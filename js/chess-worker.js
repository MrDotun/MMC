
// js/chess-worker.js
importScripts('https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js');

// Piece-Square Tables: Tells the AI which squares are better for each piece
const reverseArray = (array) => [...array].reverse();

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

const bishopEval = [
    [-2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0],
    [-1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -1.0],
    [-1.0,  0.0,  0.5,  1.0,  1.0,  0.5,  0.0, -1.0],
    [-1.0,  0.5,  0.5,  1.0,  1.0,  0.5,  0.5, -1.0],
    [-1.0,  0.0,  1.0,  1.0,  1.0,  1.0,  0.0, -1.0],
    [-1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0],
    [-1.0,  0.5,  0.0,  0.0,  0.0,  0.0,  0.5, -1.0],
    [-2.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -2.0]
];

const rookEval = [
    [0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
    [0.5,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [-0.5,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5],
    [0.0,   0.0,  0.0,  0.5,  0.5,  0.0,  0.0,  0.0]
];

const evalBoard = (game) => {
    let totalEvaluation = 0;
    const board = game.board();
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            totalEvaluation = totalEvaluation + getPieceValue(board[i][j], i, j);
        }
    }
    return totalEvaluation;
};

const getPieceValue = (piece, x, y) => {
    if (piece === null) return 0;
    const getAbsoluteValue = (p, isWhite, x, y) => {
        if (p.type === 'p') return 10 + (isWhite ? pawnEval[x][y] : reverseArray(pawnEval)[x][y]);
        if (p.type === 'r') return 50 + (isWhite ? rookEval[x][y] : reverseArray(rookEval)[x][y]);
        if (p.type === 'n') return 30 + knightEval[x][y];
        if (p.type === 'b') return 30 + (isWhite ? bishopEval[x][y] : reverseArray(bishopEval)[x][y]);
        if (p.type === 'q') return 90;
        if (p.type === 'k') return 900;
        throw "Unknown piece type: " + p.type;
    };
    const absoluteValue = getAbsoluteValue(piece, piece.color === 'w', x, y);
    return piece.color === 'w' ? absoluteValue : -absoluteValue;
};

const minimax = (game, depth, alpha, beta, isMaximizingPlayer) => {
    if (depth === 0) return -evalBoard(game);
    const newGameMoves = game.moves();
    if (isMaximizingPlayer) {
        let bestEval = -9999;
        for (let i = 0; i < newGameMoves.length; i++) {
            game.move(newGameMoves[i]);
            bestEval = Math.max(bestEval, minimax(game, depth - 1, alpha, beta, !isMaximizingPlayer));
            game.undo();
            alpha = Math.max(alpha, bestEval);
            if (beta <= alpha) return bestEval;
        }
        return bestEval;
    } else {
        let bestEval = 9999;
        for (let i = 0; i < newGameMoves.length; i++) {
            game.move(newGameMoves[i]);
            bestEval = Math.min(bestEval, minimax(game, depth - 1, alpha, beta, !isMaximizingPlayer));
            game.undo();
            beta = Math.min(beta, bestEval);
            if (beta <= alpha) return bestEval;
        }
        return bestEval;
    }
};

onmessage = function(e) {
    const { fen, depth } = e.data;
    const game = new Chess(fen);
    const moves = game.moves();
    let bestMove = null;
    let bestValue = 9999;

    for (let i = 0; i < moves.length; i++) {
        game.move(moves[i]);
        const boardValue = minimax(game, depth - 1, -10000, 10000, true);
        game.undo();
        if (boardValue <= bestValue) {
            bestValue = boardValue;
            bestMove = moves[i];
        }
    }
    postMessage(bestMove);
};
