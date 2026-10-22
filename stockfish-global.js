/**
 * Stockfish WASM interface — wraps the Web Worker with async UCI parsing.
 * Port of stockfish_engine.py.
 */

class StockfishEngine {
    constructor(numLines = 3) {
        this.numLines = numLines;
        this.worker = null;
        this.ready = false;
        this._listeners = [];
        this._readyPromise = null;
        this._readyResolve = null;
    }

    /** Start the Web Worker and wait for UCI readiness. */
    async init() {
        if (this._readyPromise) return this._readyPromise;

        this._readyPromise = new Promise((resolve, reject) => {
            this._readyResolve = resolve;
            let uciOk = false;

            // Local Stockfish 19 lite-single (place stockfish-lite-single.js + .wasm in same folder)
            this.worker = new Worker('stockfish-lite-single.js');
            this.worker.onmessage = (e) => {
                const line = typeof e.data === 'string' ? e.data : String(e.data);

                if (line === 'uciok' && !uciOk) {
                    uciOk = true;
                    this._send('setoption name MultiPV value ' + this.numLines);
                    this._send('isready');
                    return;
                }

                if (line === 'readyok' && !this.ready) {
                    this.ready = true;
                    resolve();
                    return;
                }

                // Notify all listeners
                for (const cb of this._listeners) {
                    cb(line);
                }
            };

            this.worker.onerror = (err) => {
                reject(new Error('Worker error: ' + (err.message || err)));
            };

            // Send 'uci' to start the UCI handshake
            this._send('uci');
        });

        return this._readyPromise;
    }

    /** Send a raw UCI command string to the engine. */
    _send(cmd) {
        if (this.worker) {
            this.worker.postMessage(cmd);
        }
    }

    /** Stop current search. */
    stop() {
        this._send('stop');
    }

    /**
     * Analyze a position at a specific depth.
     * Returns an array of parsed engine lines sorted by multipv rank.
     * All evals normalized to White's perspective.
     *
     * @param {string} fen
     * @param {number} depth
     * @returns {Promise<{lines: EngineLine[], depth: number}>}
     */
    analyze(fen, depth) {
        return new Promise((resolve) => {
            const rawLines = [];
            let resolved = false;

            const listener = (line) => {
                if (resolved) return;

                if (line.startsWith('info') && line.includes(' pv ')) {
                    rawLines.push(line);
                }

                if (line.startsWith('bestmove')) {
                    resolved = true;
                    this._removeListener(listener);

                    const isWhite = fen.split(' ')[1] === 'w';
                    const lines = this._parseRawAnalysis(rawLines, depth, isWhite);
                    resolve({ lines, depth });
                }
            };

            this._addListener(listener);
            this._send('position fen ' + fen);
            this._send('go depth ' + depth);
        });
    }

    /**
     * Parse raw UCI info lines into EngineLine objects.
     * Keeps the highest depth per multipv index.
     * Normalizes evals to White's perspective.
     */
    _parseRawAnalysis(rawLines, targetDepth, isWhite) {
        const pvData = {}; // multipv -> parsed

        for (const line of rawLines) {
            const parsed = StockfishEngine.parseUciInfo(line);
            if (!parsed || (parsed.depth || 0) < targetDepth - 2) continue;

            const mpv = parsed.multipv || 1;
            if (!pvData[mpv] || parsed.depth > pvData[mpv].depth) {
                pvData[mpv] = parsed;
            }
        }

        const lines = [];
        const ranks = Object.keys(pvData).map(Number).sort((a, b) => a - b);

        for (const rank of ranks) {
            const data = pvData[rank];
            const pv = data.pv || [];
            if (!pv.length) continue;

            let evalCp = data.cp || 0;
            let evalMate = data.mate ?? null;

            // Normalize to White's perspective
            if (!isWhite) {
                evalCp = -evalCp;
                if (evalMate !== null) evalMate = -evalMate;
            }

            // Convert mate to large cp value for sorting
            if (evalMate !== null) {
                evalCp = evalMate > 0
                    ? 10000 - Math.abs(evalMate) * 10
                    : -10000 + Math.abs(evalMate) * 10;
            }

            lines.push({
                moves: pv,
                movesSan: [], // filled in by caller with chess.js
                evalCp,
                evalMate,
                depth: data.depth || targetDepth,
                rank: lines.length + 1,
            });
        }

        return lines;
    }

    /**
     * Parse a single UCI info line into a structured object.
     * Example: 'info depth 14 multipv 1 score cp 181 ... pv d2d4 d7d5'
     */
    static parseUciInfo(line) {
        const result = {};
        const tokens = line.split(/\s+/);
        let i = 0;

        while (i < tokens.length) {
            const t = tokens[i];

            if (t === 'depth' && i + 1 < tokens.length) {
                result.depth = parseInt(tokens[i + 1], 10);
                i += 2;
            } else if (t === 'multipv' && i + 1 < tokens.length) {
                result.multipv = parseInt(tokens[i + 1], 10);
                i += 2;
            } else if (t === 'score' && i + 2 < tokens.length) {
                if (tokens[i + 1] === 'cp') {
                    result.cp = parseInt(tokens[i + 2], 10);
                    i += 3;
                } else if (tokens[i + 1] === 'mate') {
                    result.mate = parseInt(tokens[i + 2], 10);
                    i += 3;
                } else {
                    i++;
                }
            } else if (t === 'pv') {
                result.pv = tokens.slice(i + 1);
                break;
            } else {
                i++;
            }
        }

        return Object.keys(result).length > 0 ? result : null;
    }

    _addListener(fn) {
        this._listeners.push(fn);
    }

    _removeListener(fn) {
        this._listeners = this._listeners.filter(l => l !== fn);
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.ready = false;
        this._readyPromise = null;
    }
}

/**
 * Format eval for display.
 * @param {number} cp
 * @param {number|null} mate
 * @returns {string}
 */
function formatEval(cp, mate) {
    if (mate != null) {
        const sign = mate > 0 ? '+' : '';
        return `${sign}M${Math.abs(mate)}`;
    }
    if (cp == null) return '0.0';
    return (cp >= 0 ? '+' : '') + (cp / 100).toFixed(1);
}

/**
 * Convert UCI moves to SAN using a chess.js game instance.
 * @param {object} game - chess.js instance at the starting position
 * @param {string[]} uciMoves
 * @returns {string[]} SAN moves with move numbers
 */
function uciToSan(game, uciMoves) {
    const result = [];
    const temp = new Chess(game.fen());

    for (let i = 0; i < uciMoves.length; i++) {
        const uci = uciMoves[i];
        try {
            const from = uci.substring(0, 2);
            const to = uci.substring(2, 4);
            const promo = uci[4] || undefined;

            const moveObj = temp.move({ from, to, promotion: promo });
            if (!moveObj) {
                result.push(uci);
                break;
            }

            const san = moveObj.san;
            const isWhiteMove = moveObj.color === 'w';
            const mn = Math.ceil(temp.history().length / 2);

            if (isWhiteMove) {
                result.push(`${mn}. ${san}`);
            } else if (i === 0) {
                result.push(`${mn}... ${san}`);
            } else {
                result.push(san);
            }
        } catch (e) {
            result.push(uci);
            break;
        }
    }

    return result;
}

// Make available globally for non-module scripts
window.StockfishEngine = StockfishEngine;
window.formatEval = formatEval;
window.uciToSan = uciToSan;

