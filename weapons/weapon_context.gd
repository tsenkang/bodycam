class_name WeaponContext
extends RefCounted
## "Pacote" com o estado do jogador que a arma precisa a cada frame.
## Assim a arma não depende diretamente da classe Player.

var trigger_held := false
var trigger_pressed := false
var wants_ads := false
var reload_pressed := false
var is_sprinting := false
var is_grounded := true
var is_crouching := false
## 0..1 — velocidade atual relativa à caminhada.
var move_ratio := 0.0
var move_state := 0
var step_phase := 0.0
## Graus girados pela mira neste frame (yaw, pitch).
var look_delta := Vector2.ZERO
