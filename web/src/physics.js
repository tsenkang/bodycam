// Movimento de personagens (cilindro) contra caixas do cenário.
// Resolve eixo a eixo (X, Z, Y) — simples, estável e rápido.

/**
 * pos: [x,y,z] (pés), vel: [x,y,z]. Retorna true se está no chão.
 * Permite subir degraus baixos (stepUp) como calçadas.
 */
export function moveCharacter(world, pos, vel, dt, radius, height, stepUp = 0.3) {
  let grounded = false;
  // --- X ---
  pos[0] += vel[0] * dt;
  resolveAxis(world, pos, radius, height, 0, vel, stepUp);
  // --- Z ---
  pos[2] += vel[2] * dt;
  resolveAxis(world, pos, radius, height, 2, vel, stepUp);
  // --- Y ---
  pos[1] += vel[1] * dt;
  for (const b of world.colliders) {
    if (pos[0] + radius <= b.minX || pos[0] - radius >= b.maxX || pos[2] + radius <= b.minZ || pos[2] - radius >= b.maxZ) continue;
    if (pos[1] < b.maxY && pos[1] + height > b.minY) {
      if (vel[1] <= 0 && pos[1] >= b.maxY - 0.5) { pos[1] = b.maxY; vel[1] = 0; grounded = true; }
      else if (vel[1] > 0 && pos[1] + height - vel[1] * dt <= b.minY + 0.05) { pos[1] = b.minY - height; vel[1] = 0; }
    }
  }
  // "Grudar" no chão (descer rampas/degraus sem flutuar).
  if (!grounded && vel[1] <= 0) {
    let top = -Infinity;
    for (const b of world.colliders) {
      if (pos[0] + radius * 0.7 <= b.minX || pos[0] - radius * 0.7 >= b.maxX || pos[2] + radius * 0.7 <= b.minZ || pos[2] - radius * 0.7 >= b.maxZ) continue;
      if (b.maxY <= pos[1] + 0.001 && b.maxY > top) top = b.maxY;
    }
    if (pos[1] - top < 0.06) { pos[1] = top; vel[1] = 0; grounded = true; }
  }
  return grounded;
}

function resolveAxis(world, pos, r, h, axis, vel, stepUp) {
  for (const b of world.colliders) {
    if (pos[1] + h <= b.minY + 0.001 || pos[1] >= b.maxY - 0.001) continue;
    // círculo (x,z) vs retângulo
    const cx = Math.max(b.minX, Math.min(pos[0], b.maxX)), cz = Math.max(b.minZ, Math.min(pos[2], b.maxZ));
    const dx = pos[0] - cx, dz = pos[2] - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    // degrau baixo: sobe em vez de bloquear
    if (b.maxY - pos[1] <= stepUp && b.maxY - pos[1] > 0) { pos[1] = b.maxY; continue; }
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), push = r - d;
      if (axis === 0) pos[0] += (dx / d) * push; else pos[2] += (dz / d) * push;
    } else {
      // centro dentro da caixa: empurra pelo eixo de menor penetração
      if (axis === 0) pos[0] = (pos[0] - b.minX < b.maxX - pos[0]) ? b.minX - r : b.maxX + r;
      else pos[2] = (pos[2] - b.minZ < b.maxZ - pos[2]) ? b.minZ - r : b.maxZ + r;
    }
    if (axis === 0) vel[0] *= 0.0; else vel[2] *= 0.0;
  }
}
