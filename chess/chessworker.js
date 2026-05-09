// chessworker.js
importScripts('engine/garbochess.js');

self.onmessage = function(e) {
    if (e.data.startsWith("position")) {
        // Remove ResetGame() - it was forcing the engine back to the start
        var fen = e.data.substring(9); 
        var result = InitializeFromFen(fen);
        
        if (result.length == 0) {
            Search(function(bestMove, value, timeTaken, ply) {
                if (bestMove != 0) {
                    postMessage(FormatMove(bestMove)); 
                }
            }, 4, null);
        }
    }
};
