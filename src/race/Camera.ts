import { WORLD } from "./world";

/**
 * Keeps the whole pack framed, easing rather than snapping. Owns only numbers -
 * the caller writes the viewBox.
 */
export class Camera {
  x = 0;
  private zoom = 1;
  private zoomTarget = 1;

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
   */
  update(leadX: number, lastX: number, smooth: boolean) {
    const spread = Math.abs(leadX - lastX);
    this.zoomTarget = Math.max(1, Math.min(1.7, (spread * 1.6) / this.viewW));
    this.zoom += (this.zoomTarget - this.zoom) * (smooth ? 0.05 : 1);

    const w = this.width();
    const focus = lastX + (leadX - lastX) * 0.58;
    const target = Math.max(0, Math.min(WORLD.w - w, focus - w * 0.5));
    this.x += (target - this.x) * (smooth ? 0.08 : 1);
  }

  /** visible width in world units at the current zoom */
  width() {
    return this.viewW * this.zoom;
  }

  viewBox() {
    const w = this.width();
    const h = WORLD.h * this.zoom;
    return `${this.x} ${(WORLD.h - h) / 2} ${w} ${h}`;
  }
}
