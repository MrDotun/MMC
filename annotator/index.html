// Ensure this filename matches your uploaded file exactly!
const worker = new Worker('garbochess (3).js');
let board = null;
let game = null;

async function startAnalysis() {
    const apiKey = document.getElementById('api-key').value;
    const pgn = document.getElementById('pgn-data').value;

    if (!apiKey || !pgn) {
        alert("Please provide both the API Key and PGN data.");
        return;
    }

    window.USER_KEY = apiKey;
    game = new Chess();
    
    if (!game.load_pgn(pgn)) {
        alert("Invalid PGN format. Please check your text.");
        return;
    }

    document.getElementById('setup-overlay').style.display = 'none';
    document.getElementById('main-ui').classList.remove('hidden');

    board = ChessBoard('myBoard', {
        position: 'start',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

    const history = game.history({ verbose: true });
    await analyzeRecursive(history);
}

async function analyzeRecursive(moves) {
    for (const move of moves) {
        const fen = move.after;
        board.position(fen);
        document.getElementById('engine-status').innerText = `Analyzing: ${move.san}`;

        const score = await getGarboEval(fen);
        const commentary = await fetchGemini(move, score, fen);
        
        renderMoveToBox(move, score, commentary);

        if (move.variations && move.variations.length > 0) {
            for (const v of move.variations) {
                logSubInfo(`>> Entering Variation after ${move.san}`);
                await analyzeRecursive(v);
                logSubInfo(`>> Returning to Mainline`);
            }
        }
    }
    document.getElementById('engine-status').innerText = "Analysis Complete";
}

function getGarboEval(fen) {
    return new Promise(resolve => {
        worker.postMessage("position " + fen);
        worker.postMessage("search 1000"); // 1 second search
        worker.onmessage = (e) => {
            if (e.data.indexOf("pv") === 0) {
                const match = e.data.match(/Score:(-?\d+)/);
                resolve(match ? (parseInt(match[1]) / 100).toFixed(2) : "0.00");
            }
        };
    });
}

async function fetchGemini(move, score, fen) {
    const prompt = `You are a Chess Grandmaster. Annotate the move ${move.san}. 
    Engine Eval: ${score}. FEN: ${fen}. Symbols: ${move.nags || 'none'}.
    Explain the strategy in 2 sentences. Keep symbols intact.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.USER_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        return "Could not reach AI. Check your API key.";
    }
}

function renderMoveToBox(move, score, text) {
    const stream = document.getElementById('gm-stream');
    const div = document.createElement('div');
    div.className = "border-l-2 border-green-600 pl-4 py-2 bg-gray-900/30 rounded-r";
    div.innerHTML = `
        <div class="flex justify-between items-center font-mono">
            <span class="text-white font-bold text-lg">${move.san} <span class="text-yellow-500 text-sm">${move.nags || ''}</span></span>
            <span class="text-blue-400 text-xs">[Eval: ${score}]</span>
        </div>
        <p class="text-gray-300 mt-2 text-sm italic font-serif leading-relaxed">"${text}"</p>
    `;
    stream.appendChild(div);
    stream.scrollTop = stream.scrollHeight;
}

function logSubInfo(msg) {
    const stream = document.getElementById('gm-stream');
    const div = document.createElement('div');
    div.className = "variation-log";
    div.innerText = msg;
    stream.appendChild(div);
}
