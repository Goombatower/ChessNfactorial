import React, { useState } from 'react';
import './chess_style.css';

const BLACK_PIECES = new Set(['♜','♞','♝','♛','♚','♟']);
const WHITE_PIECES = new Set(['♖','♘','♗','♕','♔','♙']);

const isBlack  = p => BLACK_PIECES.has(p);
const isWhite  = p => WHITE_PIECES.has(p);
const isEmpty  = p => p === '';
const colorOf  = p => isWhite(p) ? 'white' : isBlack(p) ? 'black' : null;
const friendly = (a, b) => colorOf(a) !== null && colorOf(a) === colorOf(b);
const enemy    = (a, b) => colorOf(a) !== null && colorOf(b) !== null && colorOf(a) !== colorOf(b);

const PIECE_TYPE = {
  '♟': 'pawn',  '♙': 'pawn',
  '♝': 'bishop','♗': 'bishop',
  '♞': 'knight','♘': 'knight',
  '♜': 'rook',  '♖': 'rook',
  '♛': 'queen', '♕': 'queen',
  '♚': 'king',  '♔': 'king',
};


function getLegalMoves(board, fromRow, fromCol, castlingRights, enPassantTarget) {
  const piece = board[fromRow][fromCol];
  if (!piece) return [];

  const type   = PIECE_TYPE[piece];
  const color  = colorOf(piece);
  const moves  = [];

  const inBounds = (r, c) => r >= 0 && r <= 7 && c >= 0 && c <= 7;

  const slide = (dr, dc) => {
    let r = fromRow + dr, c = fromCol + dc;
    while (inBounds(r, c)) {
      if (!isEmpty(board[r][c])) {
        if (enemy(piece, board[r][c])) moves.push([r, c]);
        break;
      }
      moves.push([r, c]);
      r += dr; c += dc;
    }
  };

  if (type === 'pawn') {
    const dir       = color === 'white' ? -1 : 1;
    const startRank = color === 'white' ? 6 : 1;
    const oneAhead  = fromRow + dir;
    if (inBounds(oneAhead, fromCol) && isEmpty(board[oneAhead][fromCol])) {
      moves.push([oneAhead, fromCol]);
      const twoAhead = fromRow + 2 * dir;
      if (fromRow === startRank && isEmpty(board[twoAhead][fromCol]))
        moves.push([twoAhead, fromCol]);
    }
    for (const dc of [-1, 1]) {
      const cr = fromRow + dir, cc = fromCol + dc;
      if (inBounds(cr, cc)) {
        if (enemy(piece, board[cr][cc])) moves.push([cr, cc]);
        if (enPassantTarget && enPassantTarget[0] === cr && enPassantTarget[1] === cc)
          moves.push([cr, cc]);
      }
    }
  }
  else if (type === 'bishop') {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, dc);
  }
  else if (type === 'knight') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const r = fromRow + dr, c = fromCol + dc;
      if (inBounds(r, c) && !friendly(piece, board[r][c])) moves.push([r, c]);
    }
  }
  else if (type === 'rook') {
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr, dc);
  }
  else if (type === 'queen') {
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr, dc);
  }
  else if (type === 'king') {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const r = fromRow + dr, c = fromCol + dc;
      if (inBounds(r, c) && !friendly(piece, board[r][c])) moves.push([r, c]);
    }
    const rights = castlingRights[color];
    const rank   = color === 'white' ? 7 : 0;
    if (fromRow === rank && fromCol === 4) {
      if (rights.kingside &&
          isEmpty(board[rank][5]) && isEmpty(board[rank][6]) &&
          board[rank][7] === (color === 'white' ? '♖' : '♜'))
        moves.push([rank, 6]);
      if (rights.queenside &&
          isEmpty(board[rank][3]) && isEmpty(board[rank][2]) && isEmpty(board[rank][1]) &&
          board[rank][0] === (color === 'white' ? '♖' : '♜'))
        moves.push([rank, 2]);
    }
  }
  return moves;
}

function simulateMove(board, fromRow, fromCol, toRow, toCol, enPassantTarget) {
  const piece   = board[fromRow][fromCol];
  const type    = PIECE_TYPE[piece];
  const next    = board.map(r => [...r]);

  if (type === 'pawn' && enPassantTarget &&
      toRow === enPassantTarget[0] && toCol === enPassantTarget[1]) {
    next[fromRow][toCol] = '';
  }
  if (type === 'king' && Math.abs(toCol - fromCol) === 2) {
    if (toCol === 6) { next[fromRow][5] = next[fromRow][7]; next[fromRow][7] = ''; }
    else             { next[fromRow][3] = next[fromRow][0]; next[fromRow][0] = ''; }
  }
  next[toRow][toCol]     = piece;
  next[fromRow][fromCol] = '';
  return next;
}

// ─── Is `color`'s king attacked on this board? ───────────────────────────────
function isKingInCheck(board, color) {
  // Find the king
  const kingPiece = color === 'white' ? '♔' : '♚';
  let kingRow = -1, kingCol = -1;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === kingPiece) { kingRow = r; kingCol = c; }
  if (kingRow === -1) return false; // king not found (shouldn't happen)

  // Check if any enemy piece can reach the king square
  const enemy_color = color === 'white' ? 'black' : 'white';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (colorOf(board[r][c]) === enemy_color) {
        // Use getLegalMoves with no castling/ep so we only get raw attack squares
        const attacks = getLegalMoves(board, r, c, { white:{kingside:false,queenside:false}, black:{kingside:false,queenside:false} }, null);
        if (attacks.some(([ar, ac]) => ar === kingRow && ac === kingCol)) return true;
      }
    }
  }
  return false;
}

// ─── Fully legal moves: pseudo-legal minus those that leave own king in check ─
function getLegalMovesFiltered(board, fromRow, fromCol, castlingRights, enPassantTarget) {
  const piece  = board[fromRow][fromCol];
  const color  = colorOf(piece);
  const pseudo = getLegalMoves(board, fromRow, fromCol, castlingRights, enPassantTarget);

  return pseudo.filter(([toRow, toCol]) => {
    const after = simulateMove(board, fromRow, fromCol, toRow, toCol, enPassantTarget);
    // For castling, also verify king doesn't pass through check
    const type = PIECE_TYPE[piece];
    if (type === 'king' && Math.abs(toCol - fromCol) === 2) {
      const dir       = toCol > fromCol ? 1 : -1;
      const midBoard  = simulateMove(board, fromRow, fromCol, fromRow, fromCol + dir, enPassantTarget);
      if (isKingInCheck(midBoard, color)) return false;
      if (isKingInCheck(board, color))    return false; // can't castle out of check
    }
    return !isKingInCheck(after, color);
  });
}

// ─── Does `color` have any legal move at all? ────────────────────────────────
function hasAnyLegalMoves(board, color, castlingRights, enPassantTarget) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (colorOf(board[r][c]) === color)
        if (getLegalMovesFiltered(board, r, c, castlingRights, enPassantTarget).length > 0)
          return true;
  return false;
}


const PROMOTION_PIECES = {
  white: ['♕','♖','♗','♘'],
  black: ['♛','♜','♝','♞'],
};
const PROMOTION_LABELS = { '♕':'Queen','♖':'Rook','♗':'Bishop','♘':'Knight',
                           '♛':'Queen','♜':'Rook','♝':'Bishop','♞':'Knight' };


const INITIAL_CASTLING = {
  white: { kingside: true, queenside: true },
  black: { kingside: true, queenside: true },
};

const initialBoard = [
  ['♜','♞','♝','♛','♚','♝','♞','♜'],
  ['♟','♟','♟','♟','♟','♟','♟','♟'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['♙','♙','♙','♙','♙','♙','♙','♙'],
  ['♖','♘','♗','♕','♔','♗','♘','♖'],
];

const FILES = ['a','b','c','d','e','f','g','h'];
const toSquare = (row, col) => `${FILES[col]}${8 - row}`;

const PIECE_LETTER = {
  '♟':'','♙':'',         
  '♝':'B','♗':'B',
  '♞':'N','♘':'N',
  '♜':'R','♖':'R',
  '♛':'Q','♕':'Q',
  '♚':'K','♔':'K',
};


function buildNotation(piece, fromRow, fromCol, toRow, toCol, capture, castleKing, castleQueen, promotedTo) {
  if (castleKing)  return 'O-O';
  if (castleQueen) return 'O-O-O';

  const letter = PIECE_LETTER[piece];
  const from   = toSquare(fromRow, fromCol);
  const to     = toSquare(toRow, toCol);
  const cap    = capture ? 'x' : '';

  if (letter === '') {
    const base = capture ? `${FILES[fromCol]}x${to}` : to;
    return promotedTo ? `${base}=${PIECE_LETTER[promotedTo] || '?'}` : base;
  }
  return `${letter}${cap}${to}`;
}


const Chessboard = () => {
  const [board,           setBoard]           = useState(initialBoard.map(r => [...r]));
  const [selectedSquare,  setSelectedSquare]  = useState(null);
  const [legalMoves,      setLegalMoves]      = useState([]);
  const [turn,            setTurn]            = useState('white');
  const [castlingRights,  setCastlingRights]  = useState(INITIAL_CASTLING);
  const [enPassantTarget, setEnPassantTarget] = useState(null);
  const [promotion,       setPromotion]       = useState(null);
  const [draggedPiece,    setDraggedPiece]    = useState(null);
  const [gameStatus,     setGameStatus]      = useState('playing');
  const [checkedColor,   setCheckedColor]    = useState(null); // which king is in check

  const [history, setHistory] = useState([]);

  const pushSnapshot = (boardBefore, turnBefore, castlingBefore, epBefore, notation) => {
    setHistory(prev => [...prev, {
      board:           boardBefore.map(r => [...r]),
      turn:            turnBefore,
      castlingRights:  { white: { ...castlingBefore.white }, black: { ...castlingBefore.black } },
      enPassantTarget: epBefore,
      notation,
    }]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setBoard(prev.board.map(r => [...r]));
    setTurn(prev.turn);
    setCastlingRights(prev.castlingRights);
    setEnPassantTarget(prev.enPassantTarget);
    setPromotion(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setGameStatus('playing');
    setCheckedColor(null);
    setHistory(h => h.slice(0, -1));
  };

  const evaluatePosition = (newBoard, nextTurn, newCastling, newEP) => {
    const inCheck  = isKingInCheck(newBoard, nextTurn);
    const hasMoves = hasAnyLegalMoves(newBoard, nextTurn, newCastling, newEP);
    if (!hasMoves && inCheck)  { setGameStatus('checkmate'); setCheckedColor(nextTurn); return; }
    if (!hasMoves && !inCheck) { setGameStatus('stalemate'); setCheckedColor(null);     return; }
    if (inCheck)               { setGameStatus('check');     setCheckedColor(nextTurn); return; }
    setGameStatus('playing'); setCheckedColor(null);
  };

  const highlightSet = new Set(legalMoves.map(([r,c]) => `${r},${c}`));

  const applyMove = (fromRow, fromCol, toRow, toCol, currentBoard) => {
    const piece    = currentBoard[fromRow][fromCol];
    const color    = colorOf(piece);
    const type     = PIECE_TYPE[piece];
    const newBoard = currentBoard.map(r => [...r]);
    let newEnPassant = null;
    const newCastling = {
      white: { ...castlingRights.white },
      black: { ...castlingRights.black },
    };

    const isCapture     = !isEmpty(currentBoard[toRow][toCol]);
    const isEnPassant   = type === 'pawn' && enPassantTarget &&
                          toRow === enPassantTarget[0] && toCol === enPassantTarget[1];
    const isCastleKing  = type === 'king' && toCol - fromCol === 2;
    const isCastleQueen = type === 'king' && toCol - fromCol === -2;

    if (isEnPassant) {
      newBoard[fromRow][toCol] = '';
    }

    if (type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
      newEnPassant = [(fromRow + toRow) / 2, fromCol];
    }

    if (isCastleKing) {
      newBoard[fromRow][5] = newBoard[fromRow][7];
      newBoard[fromRow][7] = '';
    }
    if (isCastleQueen) {
      newBoard[fromRow][3] = newBoard[fromRow][0];
      newBoard[fromRow][0] = '';
    }

    if (type === 'king') {
      newCastling[color].kingside  = false;
      newCastling[color].queenside = false;
    }
    if (type === 'rook') {
      const rank = color === 'white' ? 7 : 0;
      if (fromRow === rank && fromCol === 7) newCastling[color].kingside  = false;
      if (fromRow === rank && fromCol === 0) newCastling[color].queenside = false;
    }

    newBoard[toRow][toCol]     = piece;
    newBoard[fromRow][fromCol] = '';

    const promotionRank = color === 'white' ? 0 : 7;
    if (type === 'pawn' && toRow === promotionRank) {
      // Snapshot stored here; notation will be completed in handlePromotion
      const notation = buildNotation(piece, fromRow, fromCol, toRow, toCol,
                                     isCapture || isEnPassant, false, false, null);
      pushSnapshot(currentBoard, turn, castlingRights, enPassantTarget, notation + '=?');
      setBoard(newBoard);
      setEnPassantTarget(newEnPassant);
      setCastlingRights(newCastling);
      setPromotion({ row: toRow, col: toCol, color, notation });
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    const notation = buildNotation(piece, fromRow, fromCol, toRow, toCol,
                                   isCapture || isEnPassant, isCastleKing, isCastleQueen, null);
    pushSnapshot(currentBoard, turn, castlingRights, enPassantTarget, notation);

    const nextTurn = turn === 'white' ? 'black' : 'white';
    setBoard(newBoard);
    setEnPassantTarget(newEnPassant);
    setCastlingRights(newCastling);
    setSelectedSquare(null);
    setLegalMoves([]);
    setTurn(nextTurn);
    evaluatePosition(newBoard, nextTurn, newCastling, newEnPassant);
  };

  const handleSquareClick = (row, col) => {
    if (promotion) return;
    if (gameStatus === 'checkmate' || gameStatus === 'stalemate') return;

    const piece = board[row][col];

    if (!selectedSquare) {
      if (!isEmpty(piece) && colorOf(piece) === turn) {
        const moves = getLegalMovesFiltered(board, row, col, castlingRights, enPassantTarget);
        setSelectedSquare({ row, col });
        setLegalMoves(moves);
      }
      return;
    }

    const { row: fromRow, col: fromCol } = selectedSquare;
    const fromPiece = board[fromRow][fromCol];

    if (!isEmpty(piece) && friendly(fromPiece, piece)) {
      const moves = getLegalMovesFiltered(board, row, col, castlingRights, enPassantTarget);
      setSelectedSquare({ row, col });
      setLegalMoves(moves);
      return;
    }

    const isLegal = highlightSet.has(`${row},${col}`);
    if (isLegal) {
      applyMove(fromRow, fromCol, row, col, board);
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const handleDragStart = (e, row, col) => {
    if (gameStatus === 'checkmate' || gameStatus === 'stalemate') { e.preventDefault(); return; }
    const piece = board[row][col];
    if (!isEmpty(piece) && colorOf(piece) === turn) {
      const moves = getLegalMovesFiltered(board, row, col, castlingRights, enPassantTarget);
      setDraggedPiece({ piece, row, col });
      setSelectedSquare({ row, col });
      setLegalMoves(moves);
      e.dataTransfer.effectAllowed = 'move';
    } else {
      e.preventDefault();
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleDrop = (e, toRow, toCol) => {
    e.preventDefault();
    if (!draggedPiece) return;
    const { row: fromRow, col: fromCol, piece: fromPiece } = draggedPiece;

    if (!isEmpty(board[toRow][toCol]) && friendly(fromPiece, board[toRow][toCol])) {
      const moves = getLegalMovesFiltered(board, toRow, toCol, castlingRights, enPassantTarget);
      setSelectedSquare({ row: toRow, col: toCol });
      setLegalMoves(moves);
      setDraggedPiece(null);
      return;
    }

    const isLegal = highlightSet.has(`${toRow},${toCol}`);
    if (isLegal) {
      applyMove(fromRow, fromCol, toRow, toCol, board);
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
    setDraggedPiece(null);
  };

  const handlePromotion = (newPiece) => {
    const newBoard = board.map(r => [...r]);
    newBoard[promotion.row][promotion.col] = newPiece;
    setBoard(newBoard);
    const promoLetter = PIECE_LETTER[newPiece] || '?';
    setHistory(h => {
      if (h.length === 0) return h;
      const updated = [...h];
      const last = { ...updated[updated.length - 1] };
      last.notation = last.notation.replace('=?', `=${promoLetter}`);
      updated[updated.length - 1] = last;
      return updated;
    });
    setPromotion(null);
    const nextTurn = turn === 'white' ? 'black' : 'white';
    setTurn(nextTurn);
    evaluatePosition(newBoard, nextTurn, castlingRights, enPassantTarget);
  };

  const getSquareColor = (r, c) => (r + c) % 2 === 0 ? 'white' : 'black';
  const isSelected     = (r, c) => selectedSquare?.row === r && selectedSquare?.col === c;
  const isHighlighted  = (r, c) => highlightSet.has(`${r},${c}`);

  const kingInCheckPiece = checkedColor === 'white' ? '♔' : '♚';
  const isKingInCheckSquare = (r, c) =>
    checkedColor !== null && board[r][c] === kingInCheckPiece;
  const moveRows = history.reduce((acc, entry, i) => {
    if (i % 2 === 0) acc.push([entry]);
    else acc[acc.length - 1].push(entry);
    return acc;
  }, []);

  return (
    <div className="app">
      <div className="header">
        <div className="turn-indicator">
          <span className={`turn-dot ${turn}`}></span>
          {gameStatus === 'checkmate'
            ? `Checkmate — ${checkedColor === 'white' ? 'Black' : 'White'} wins!`
            : gameStatus === 'stalemate'
            ? 'Stalemate — Draw!'
            : gameStatus === 'check'
            ? `${turn.charAt(0).toUpperCase() + turn.slice(1)} is in Check!`
            : `${turn.charAt(0).toUpperCase() + turn.slice(1)}'s turn`
          }
        </div>
      </div>

      <div className="board-container">
        <div className="chessboard">
          {board.map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              {row.map((piece, colIndex) => {
                const highlight = isHighlighted(rowIndex, colIndex);
                const occupied  = highlight && !isEmpty(piece);
                const inCheck   = isKingInCheckSquare(rowIndex, colIndex);

                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={[
                      'square',
                      getSquareColor(rowIndex, colIndex),
                      isSelected(rowIndex, colIndex) ? 'selected' : '',
                      highlight ? 'highlighted' : '',
                      occupied  ? 'capture-highlight' : '',
                      inCheck   ? 'king-in-check' : '',
                    ].join(' ').trim()}
                    onClick={() => handleSquareClick(rowIndex, colIndex)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, rowIndex, colIndex)}
                  >
                    {highlight && isEmpty(piece) && (
                      <div className="move-dot" />
                    )}

                    {piece && (
                      <div
                        className="piece"
                        draggable={colorOf(piece) === turn && gameStatus !== 'checkmate' && gameStatus !== 'stalemate'}
                        onDragStart={(e) => handleDragStart(e, rowIndex, colIndex)}
                        style={{ fontSize: '42px', lineHeight: '70px', textAlign: 'center',
                                 cursor: colorOf(piece) === turn ? 'grab' : 'default',
                                 userSelect: 'none', zIndex: 1, position: 'relative' }}
                      >
                        {piece}
                      </div>
                    )}

                    {promotion && promotion.row === rowIndex && promotion.col === colIndex && (
                      <div className="promotion-popup">
                        {PROMOTION_PIECES[promotion.color].map(p => (
                          <button
                            key={p}
                            className="promotion-btn"
                            onClick={(e) => { e.stopPropagation(); handlePromotion(p); }}
                            title={PROMOTION_LABELS[p]}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        <div className="history-panel">
          <div className="history-header">Move History</div>
          <div className="history-body">
            {moveRows.length === 0 && (
              <div className="history-empty">No moves yet</div>
            )}
            {moveRows.map((pair, i) => (
              <div key={i} className="history-row">
                <span className="history-num">{i + 1}.</span>
                <span className="history-white">{pair[0]?.notation ?? ''}</span>
                <span className="history-black">{pair[1]?.notation ?? ''}</span>
              </div>
            ))}
          </div>
          <button
            className="undo-btn"
            onClick={handleUndo}
            disabled={history.length === 0}
          >
            ↩ Undo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chessboard;