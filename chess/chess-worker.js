// chess/chess-worker.js

// 1. Import the Garbo engine from the new folder
importScripts('engine/garbochess.js');

// 2. Override Garbo's default listener to connect it to our board
self.onmessage = function(e) {
    // Reset Garbo's internal board and give it the current game position
    ResetGame();
    InitializeFromFen(e.data);
    
    // Run the Garbo Search. Depth 4 gives Grandmaster logic in under a second.
    Search(function(bestMove, value, timeTaken, ply) {
        if (bestMove != 0) {
            // FormatMove translates Garbo's internal code into a string like "e2e4"
            postMessage(FormatMove(bestMove)); 
        }
    }, 4, null); 
};
