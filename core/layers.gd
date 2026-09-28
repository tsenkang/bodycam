class_name Layers
extends RefCounted
## Camadas de física (bitmask). Nomes também definidos no project.godot.

const WORLD := 1      # cenário, portas, caixas
const PLAYER := 2     # corpo (cápsula) do jogador
const BOTS := 4       # corpo (cápsula) dos bots
const HITBOX := 8     # regiões de dano (cabeça, tronco, braços, pernas)

const CHARACTERS := PLAYER | BOTS
## O que as balas acertam: cenário + hitboxes (atravessam as cápsulas).
const SHOT_MASK := WORLD | HITBOX
## Com o que personagens colidem ao andar.
const MOVEMENT_MASK := WORLD | PLAYER | BOTS
