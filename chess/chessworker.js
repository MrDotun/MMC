// chessworker.js
importScripts('engine/garbochess.js');

self.onmessage = function(e) {
    if (e.data.startsWith("position")) {
        // substring(9) removes "position " to get the FEN
        var fen = e.data.substring(9);
        
        // Initialize the board with the puzzle FEN
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
