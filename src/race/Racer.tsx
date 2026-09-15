import { DEFAULT_PIECE, PIECE_ART, type PieceId } from "./pieces";
import { PIECE_REAR } from "./piecesRear";

/**
 * Whatever this player is racing, drawn nose-first along +x so the engine's
 * rotate() puts it along the track. Local origin is the centre of the piece.
 *
 * Nothing here animates. The whole piece is one static group that the engine
 * translates, rotates and squashes, so extra detail costs a one-off node and
 * nothing per frame - which is why a piece can be as fussy as it likes.
 */
export default function Piece({ piece, color }: { piece?: PieceId; color: string }) {
  const Art = PIECE_ART[piece ?? DEFAULT_PIECE] ?? PIECE_ART[DEFAULT_PIECE];
  return <Art color={color} />;
}

/**
 * The same piece from behind, standing on the road rather than lying on it.
 * The race view keeps both in the tree and cross-fades between them, because
 * whichever one is right depends on where the camera happens to be.
 */
export function PieceRear({ piece, color }: { piece?: PieceId; color: string }) {
  const Art = PIECE_REAR[piece ?? DEFAULT_PIECE] ?? PIECE_REAR[DEFAULT_PIECE];
  return <Art color={color} />;
}
