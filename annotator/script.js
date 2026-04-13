
const garboWorker = new Worker('garbochess (3).js');
let USER_API_KEY = "";

async function initializeAnalysis() {
    USER_API_KEY = document.getElementById('api-key-input').value;
    const pgn = document.getElementById('pgn-input').value;

    // 1. Initialize PGN Parser (Ensure chess.js is linked in index.html)
    const game = new Chess();
    game.loadPgn(pgn);
    const history = game.history({ verbose: true });

    // 2. Recursive Loop to walk through the Move Tree
    await processMoves(history);
}

async function processMoves(moves) {
    for (const move of moves) {
        // Step A: Send FEN to Garbo for Evaluation
        const score = await getGarboScore(move.after);

        // Step B: Send Data to Gemini
        const commentary = await getGeminiComment(move, score);

        // Step C: Render to your Box (Keeping symbols like $11 intact)
        renderToBox(move, score, commentary);

        // Step D: Handle Variations (Recursive)
        if (move.variations && move.variations.length > 0) {
            updateStatus(">> Entering Sub-variation...");
            for (let v of move.variations) {
                await processMoves(v);
            }
            updateStatus(`>> Returning to Mainline at move: ${move.san}`);
        }
    }
}
