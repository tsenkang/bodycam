// Navegação dos bots: grade de ocupação (0,5 m) + A* com suavização por
// linha de visão. Gerada automaticamente a partir das colisões do mapa.
const CELL = 0.5, MINX = -48, MINZ = -38, W = 192, H = 152, AGENT_R = 0.45;

export class NavGrid {
  constructor(world) {
    this.blocked = new Uint8Array(W * H);
    for (const b of world.colliders) {
      if (b.floor || b.maxY < 0.35 || b.minY > 1.7) continue;
      const x0 = Math.max(0, Math.floor((b.minX - AGENT_R - MINX) / CELL)), x1 = Math.min(W - 1, Math.floor((b.maxX + AGENT_R - MINX) / CELL));
      const z0 = Math.max(0, Math.floor((b.minZ - AGENT_R - MINZ) / CELL)), z1 = Math.min(H - 1, Math.floor((b.maxZ + AGENT_R - MINZ) / CELL));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.blocked[z * W + x] = 1;
    }
    // bordas
    for (let x = 0; x < W; x++) { this.blocked[x] = 1; this.blocked[(H - 1) * W + x] = 1; }
    for (let z = 0; z < H; z++) { this.blocked[z * W] = 1; this.blocked[z * W + W - 1] = 1; }
    this.g = new Float32Array(W * H); this.f = new Float32Array(W * H);
    this.parent = new Int32Array(W * H); this.stamp = new Uint32Array(W * H); this.closed = new Uint32Array(W * H); this.run = 0;
  }
  cellOf(x, z) { return [Math.floor((x - MINX) / CELL), Math.floor((z - MINZ) / CELL)]; }
  center(cx, cz) { return [MINX + (cx + 0.5) * CELL, MINZ + (cz + 0.5) * CELL]; }
  walkable(cx, cz) { return cx >= 0 && cz >= 0 && cx < W && cz < H && !this.blocked[cz * W + cx]; }
  walkablePos(x, z) { const [cx, cz] = this.cellOf(x, z); return this.walkable(cx, cz); }

  /** Célula livre mais próxima (busca em espiral). */
  nearestFree(x, z) {
    const [cx, cz] = this.cellOf(x, z);
    if (this.walkable(cx, cz)) return [cx, cz];
    for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
      if (this.walkable(cx + dx, cz + dz)) return [cx + dx, cz + dz];
    }
    return null;
  }
  snap(x, z) { const c = this.nearestFree(x, z); return c ? this.center(c[0], c[1]) : [x, z]; }
  randomNear(x, z, r) { for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI * 2, d = r * Math.sqrt(Math.random()); const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d; if (this.walkablePos(px, pz)) return [px, pz]; } return this.snap(x, z); }

  /** Linha livre na grade (para suavizar o caminho). */
  clearLine(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az), steps = Math.ceil(dist / (CELL * 0.5));
    for (let i = 1; i < steps; i++) { const t = i / steps; if (!this.walkablePos(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }

  /** A* de (ax,az) até (bx,bz). Retorna lista de pontos [x,z] ou null. */
  path(ax, az, bx, bz) {
    const s = this.nearestFree(ax, az), e = this.nearestFree(bx, bz);
    if (!s || !e) return null;
    const run = ++this.run, start = s[1] * W + s[0], goal = e[1] * W + e[0];
    const heap = [start];
    this.stamp[start] = run; this.g[start] = 0; this.f[start] = 0; this.parent[start] = -1;
    const hfn = (i) => { const x = i % W, z = (i / W) | 0, dx = Math.abs(x - e[0]), dz = Math.abs(z - e[1]); return (dx + dz) + (1.414 - 2) * Math.min(dx, dz); };
    const push = (i) => { heap.push(i); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (this.f[heap[p]] <= this.f[heap[k]]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && this.f[heap[l]] < this.f[heap[m]]) m = l; if (r < heap.length && this.f[heap[r]] < this.f[heap[m]]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    let iter = 0, found = false;
    while (heap.length && iter++ < 20000) {
      const cur = pop();
      if (cur === goal) { found = true; break; }
      if (this.closed[cur] === run) continue;
      this.closed[cur] = run;
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.walkable(nx, nz)) continue;
        if (dx && dz && (!this.walkable(cx + dx, cz) || !this.walkable(cx, cz + dz))) continue; // sem cortar quina
        const ni = nz * W + nx, cost = this.g[cur] + (dx && dz ? 1.414 : 1);
        if (this.stamp[ni] !== run || cost < this.g[ni]) {
          this.stamp[ni] = run; this.g[ni] = cost; this.f[ni] = cost + hfn(ni); this.parent[ni] = cur;
          if (this.closed[ni] !== run) push(ni);
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = this.parent[i]) cells.push(this.center(i % W, (i / W) | 0));
    cells.reverse();
    // Suavização: pula pontos intermediários visíveis.
    const out = [cells[0]];
    let anchor = 0;
    for (let i = 2; i < cells.length; i++) {
      if (!this.clearLine(cells[anchor][0], cells[anchor][1], cells[i][0], cells[i][1])) { out.push(cells[i - 1]); anchor = i - 1; }
    }
    out.push([bx, bz].every(Number.isFinite) && this.walkablePos(bx, bz) ? [bx, bz] : cells[cells.length - 1]);
    return out;
  }
}
