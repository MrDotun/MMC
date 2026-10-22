/**
 * Progressive deepening analysis orchestration.
 * Coordinates Stockfish analysis at increasing depths.
 */

import { StockfishEngine, uciToSan, formatEval } from './stockfish.js';

/** Singleton engine instance. */
let engine = null;
let currentAnalysisFen = null;
let analysisGeneration = 0;

/**
 * Initialize the Stockfish WASM engine.
 * @returns {Promise<StockfishEngine>}
 */
export async function initEngine() {
    if (engine && engine.ready) return engine;
    engine = new StockfishEngine(3);
    await engine.init();
    return engine;
}

/** Get the engine instance (must call initEngine first). */
export function getEngine() {
    return engine;
}

/**
 * Analyze a position at a single depth.
 * Returns engine lines with SAN notation.
 *
 * @param {string} fen
 * @param {number} depth
 * @param {object} game - chess.js instance at this FEN (for SAN conversion)
 * @returns {Promise<{lines: object[], depth: number}>}
 */
export async function analyzeInstant(fen, depth, game) {
    if (!engine || !engine.ready) await initEngine();

    const result = await engine.analyze(fen, depth);

    // Convert UCI to SAN
    for (const line of result.lines) {
        line.movesSan = uciToSan(game || new Chess(fen), line.moves);
        line.eval = formatEval(line.evalCp, line.evalMate);
    }

    return result;
}

/**
 * Progressive deepening analysis.
 * Calls onUpdate at each depth with accumulated results.
 * Automatically cancels if a new analysis is started for a different position.
 *
 * @param {string} fen
 * @param {function} onUpdate - callback({lines, depth, fen})
 * @param {number[]} depths - depth steps
 * @returns {Promise<void>}
 */
export async function analyzeProgressive(fen, onUpdate, depths = [8, 14, 18]) {
    if (!engine || !engine.ready) await initEngine();

    currentAnalysisFen = fen;
    const gen = ++analysisGeneration;

    for (const depth of depths) {
        // Check if position changed
        if (currentAnalysisFen !== fen || analysisGeneration !== gen) return;

        try {
            engine.stop();
            const result = await engine.analyze(fen, depth);

            // Check again after analysis completes
            if (currentAnalysisFen !== fen || analysisGeneration !== gen) return;

            // Convert to SAN
            const game = new Chess(fen);
            for (const line of result.lines) {
                line.movesSan = uciToSan(game, line.moves);
                line.eval = formatEval(line.evalCp, line.evalMate);
            }

            onUpdate({ lines: result.lines, depth, fen });
        } catch (e) {
            console.error(`Analysis error at depth ${depth}:`, e);
            return;
        }
    }
}

/** Stop any ongoing analysis. */
export function stopAnalysis() {
    analysisGeneration++;
    currentAnalysisFen = null;
    if (engine) engine.stop();
}

/**
 * Calculate material balance (positive = white ahead).
 * @param {object} game - chess.js instance
 * @returns {number}
 */
export function calculateMaterial(game) {
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let balance = 0;

    'abcdefgh'.split('').forEach(file => {
        for (let rank = 1; rank <= 8; rank++) {
            const sq = file + rank;
            const piece = game.get(sq);
            if (piece) {
                const val = values[piece.type] || 0;
                balance += piece.color === 'w' ? val : -val;
            }
        }
    });

    return balance;
}
