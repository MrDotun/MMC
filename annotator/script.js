// Initialization
const worker = new Worker('garbochess (3).js');
let board = null;
let game = null;

async function startAnalysis() {
    const apiKey = document.getElementById('api-key').value;
    const pgn = document.getElementById('pgn-data').value;

    if (!apiKey || !pgn) {
        alert("Please paste your Gemini Key and PGN first.");
        return;
    }

    window.USER_KEY = apiKey;
    game = new Chess();
    
    // Load PGN data
    if (!game.load_pgn(pgn)) {
        alert("PGN Error: Check your game text format.");
        return;
    }

    // Switch UI
    document.getElementById('setup-overlay').style.display = 'none';
    document.getElementById('main-ui').classList.remove('hidden');

    // Setup visual board
    board = ChessBoard('myBoard', {
        position: 'start',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

    const history = game.history({ verbose: true });
    document.getElementById('move-count').innerText = `${history.length} Moves Loaded`;
    
    // Start the recursive engine/AI loop
    await analyzeRecursive(history);
}

async function analyzeRecursive(moves) {
    for (const move of moves) {
        const fen = move.after;
        
        // Update Board Position
        board.position(fen);
        document.getElementById('engine-status').innerText = `Engine: Analyzing ${move.san}...`;

        // 1. Get Score from Garbo
        const score = await getGarboEval(fen);
        
        // 2. Get AI Commentary from Gemini
        const commentary = await fetchGemini(move, score, fen);
        
        // 3. Update the Box
        renderMove(move, score, commentary);

        // 4. Handle Sub-Variations (Recursive)
        if (move.variations && move.variations.length > 0) {
            for (const v of move.variations) {
                logVariation(`>> Analyzing Variation: ${move.san}...`);
                await analyzeRecursive(v);
                logVariation(`>> Returning to Mainline after ${move.san}`);
            }
        }
    }
    document.getElementById('engine-status').innerText = "Analysis Finished.";
}

function getGarboEval(fen) {
    return new Promise(resolve => {
        worker.postMessage("position " + fen);
        worker.postMessage("search 1000"); // 1 second depth
        worker.onmessage = (e) => {
            if (e.data.includes("pv")) {
                const match = e.data.match(/Score:(-?\d+)/);
                resolve(match ? (parseInt(match[1]) / 100).toFixed(2) : "0.00");
            }
        };
    });
}

async function fetchGemini(move, score, fen) {
    // We send NAGs ($) and Comments ([%csl]) to Gemini so it keeps them
    const prompt = `You are a Chess Grandmaster. Annotate the move ${move.san}. 
    Engine Eval: ${score}. FEN: ${fen}. Symbols: ${move.nags || 'none'}.
    Write 2 instructional sentences for a student workbook. KEEP ALL SYMBOLS ($11, $132, etc.) INTACT.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.USER_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        return "AI Error: Check your internet or API key quota.";
    }
}

function renderMove(move, score, text) {
    const stream = document.getElementById('gm-stream');
    const div = document.createElement('div');
    div.className = "border-l-4 border-green-600 pl-4 py-3 bg-gray-900/40 rounded shadow-sm mb-4 transition-all";
    
    // Keep symbols ($) in the title
    const glyphs = move.nags ? `<span class="text-yellow-500 ml-2">${move.nags.join(' ')}</span>` : '';
    
    div.innerHTML = `
        <div class="flex justify-between items-center">
            <span class="text-white font-bold text-lg">${move.san}${glyphs}</span>
            <span class="text-blue-400 font-mono text-xs bg-black px-2 py-1 rounded">Score: ${score}</span>
        </div>
        <p class="text-gray-300 mt-2 text-sm italic font-serif leading-relaxed">"${text}"</p>
    `;
    stream.appendChild(div);
    stream.scrollTop = stream.scrollHeight;
}

function logVariation(msg) {
    const stream = document.getElementById('gm-stream');
    const div = document.createElement('div');
    div.className = "variation-log text-blue-500 text-[10px] font-mono uppercase italic border-t border-gray-800 pt-2 mt-4 mb-2";
    div.innerText = msg;
    stream.appendChild(div);
    stream.scrollTop = stream.scrollHeight;
}
