// chess-worker.js
importScripts('garbochess.js'); // Load the engine

onmessage = function(e) {
    const { command, data } = e.data;

    if (command === 'START_ANALYSIS') {
        ResetGame();
        InitializeFromFen(data.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        
        // Process moves one by one
        data.tokens.forEach(token => {
            // ... parse and move logic ...
            // When done with a chunk, send it back to the main thread
            postMessage({ type: 'CHUNK_READY', chunk: newChunk });
        });
    }
};
