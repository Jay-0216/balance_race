/** One-shot flourishes the race view plays when a round resolves. */
export type RaceEffect = {
  /** rerun the same effect by bumping this */
  key: number;
  playerId: number;
  kind: "advance" | "booster";
};
