import { TRACK_START, WORLD } from "./world";

/**
 * Keeps the whole pack framed, easing rather than snapping. Owns only numbers -
 * the caller writes the viewBox.
 */

/** how tight and how far back the opening shot sits */
const INTRO_ZOOM = 0.75;
const INTRO_BACK = 0.8;
const INTRO_DROP = 0.06;

const EASE = (k: number) => 1 - Math.pow(1 - k, 3);

export class Camera {
  x = 0;
  private zoom = 1;
  private zoomTarget = 1;
  private placed = false;
  /** vertical offset of the opening shot, in world units */
  private lift = 0;
  /** multiplies the zoom while the opening shot is running */
  private shot = 1;

  /** width of the visible window in world units, set from the view aspect */
  viewW = 260;

  setAspect(px: number, py: number) {
    if (py > 0) this.viewW = WORLD.h * (px / py);
  }

  /**
   * Frames as much of the pack as is worth framing. Zoom widens to fit
   * leader-to-last with margin, but caps: by the end of a race the spread can
   * be the whole track, and fitting that would shrink everyone to specks.
   * Past the cap the tail drops off screen, which is what the leaderboard is
   * for. Focus sits just past the middle so the road ahead gets more room.
   *
   * @param intro 0..1 - the opening shot, which starts close behind the grid
   * and low in frame, then climbs out to the ordinary overhead framing. It
   * cannot go much tighter than this: eight cars are 138 units across the
   * road, and a closer shot would simply cut the outside lanes off.
   */
  update(leadX: number, lastX: number, smooth: boolean, intro = 1) {
    const spread = Math.abs(leadX - lastX);
    this.zoomTarget = Math.max(1, Math.min(1.7, (spread * 1.6) / this.viewW));
    this.zoom += (this.zoomTarget - this.zoom) * (smooth ? 0.05 : 1);

    const k = intro >= 1 ? 1 : EASE(intro);
    this.shot = INTRO_ZOOM + (1 - INTRO_ZOOM) * k;
    this.lift = (1 - k) * WORLD.h * INTRO_DROP;

    const w = this.width();
    const focus = lastX + (leadX - lastX) * 0.58;
    // The floor is the start of the road, not zero. Clamping at zero pinned
    // the opening shot in place: cell 0 sits only ~46 units in, so "behind
    // the grid" is a negative x, and the road is drawn from TRACK_START.
    const clamp = (v: number) => Math.max(TRACK_START + 50, Math.min(WORLD.w - w, v));
    // behind: the grid sits near the far edge, so the shot looks up the road
    const target = clamp(focus - w * (0.5 + (INTRO_BACK - 0.5) * (1 - k)));

    // The opening is a scripted move, so it tracks its own path closely; once
    // it is over the camera goes back to lagging the pack.
    const follow = !smooth || !this.placed ? 1 : intro < 1 ? 0.3 : 0.08;
    this.x += (target - this.x) * follow;
    this.placed = true;
  }

  /** visible width in world units at the current zoom */
  width() {
    return this.viewW * this.zoom * this.shot;
  }

  viewBox() {
    const w = this.width();
    const h = WORLD.h * this.zoom * this.shot;
    return `${this.x} ${(WORLD.h - h) / 2 + this.lift} ${w} ${h}`;
  }
}
