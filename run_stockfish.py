import sys
import chess
import chess.engine

def main():
    if len(sys.argv) < 3:
        print("Usage: python run_stockfish.py 'fen1,fen2' 'move'")
        sys.exit(1)

    fens = sys.argv[1].split(',')
    move_str = sys.argv[2].strip()
    engine_path = "stockfish"

    try:
        engine = chess.engine.SimpleEngine.popen_uci(engine_path)
    except Exception as e:
        print(f"Error loading Stockfish: {e}")
        sys.exit(1)

    print("### Stockfish Analysis Output\n")
    
    for fen in fens:
        fen = fen.strip()
        if not fen: 
            continue
            
        print(f"**FEN:** `{fen}`  ")
        board = chess.Board(fen)
        
        try:
            move = chess.Move.from_uci(move_str)
            if move in board.legal_moves:
                board.push(move)
                print(f"**After Move:** `{move_str}`  ")
            else:
                print(f"*(Warning: Move {move_str} is illegal. Analyzing original FEN)* ")
        except ValueError:
            print(f"*(Error: Invalid move format '{move_str}'. Use UCI format like 'e2e4'.)* ")
        
        # Analysis limited to 180 seconds (3 minutes) instead of fixed depth
        info = engine.analyse(board, chess.engine.Limit(time=180))
        pv = info.get("pv", [])
        
        next_6 = pv[:6]
        san_moves = []
        temp_board = board.copy()
        
        for m in next_6:
            san_moves.append(temp_board.san(m))
            temp_board.push(m)
        
        output_str = " ".join(san_moves)
        print(f"**Next 6 moves:** `{output_str}`\n")
        print("---\n")

    engine.quit()

if __name__ == "__main__":
    main()
