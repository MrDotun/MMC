// chess/chess-worker.js
importScripts('engine/garbochess.js');

// This is the bridge between your school.html and the Garbo logic
self.onmessage = function(e) {
    if (e.data.startsWith("position")) {
        ResetGame();
        var fen = e.data.substring(9);
        var result = InitializeFromFen(fen);
        if (result.length == 0) {
            // Search at Depth 4 for Master-level play
            Search(function(bestMove, value, timeTaken, ply) {
                if (bestMove != 0) {
                    postMessage(FormatMove(bestMove)); 
                }
            }, 4, null);
        }
    }
};
