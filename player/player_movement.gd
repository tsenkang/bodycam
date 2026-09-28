class_name PlayerMovement
extends Node
## Movimentação do jogador: andar, correr, agachar, pular, aceleração com
## peso e ritmo de passos. Não lê input direto: o Player passa os comandos,
## então o mesmo componente pode ser reaproveitado (ex.: replays, testes).

signal landed(fall_speed: float)
signal footstep(move_state: int)
signal jumped

enum MoveState { IDLE, WALK, SPRINT, CROUCH, AIR }

var body: CharacterBody3D
var collision: CollisionShape3D
var capsule: CapsuleShape3D

var move_state: MoveState = MoveState.IDLE
var is_sprinting := false
var is_crouching := false
## 0 = em pé, 1 = agachado (suavizado) — usado por câmera e hitboxes.
var crouch_amount := 0.0
## 0..1 suavizado — usado para FOV e pose da arma.
var sprint_amount := 0.0
## Fase do passo (cada PI = um passo). Fonte única para head bob e passos.
var step_phase := 0.0
var current_eye_height := 1.62

var _crouch_toggled := false
var _was_on_floor := true
var _fall_speed := 0.0


func setup(p_body: CharacterBody3D, p_collision: CollisionShape3D) -> void:
	body = p_body
	collision = p_collision
	capsule = collision.shape as CapsuleShape3D
	current_eye_height = GameConfig.eye_height_stand


func reset() -> void:
	is_sprinting = false
	is_crouching = false
	_crouch_toggled = false
	crouch_amount = 0.0
	sprint_amount = 0.0
	_fall_speed = 0.0
	_apply_crouch_shape()


## Chamado a cada frame de física pelo Player.
func physics_update(delta: float, input_dir: Vector2, wants_sprint: bool, crouch_held: bool,
		crouch_toggle_pressed: bool, jump_pressed: bool, speed_mult: float) -> void:
	var cfg := GameConfig
	var on_floor := body.is_on_floor()

	# --- Agachar -----------------------------------------------------------
	if crouch_toggle_pressed:
		_crouch_toggled = not _crouch_toggled
	var wants_crouch := crouch_held or _crouch_toggled

	# --- Correr (só para frente) ------------------------------------------
	var moving_forward := input_dir.y < -0.3
	is_sprinting = wants_sprint and moving_forward and (on_floor or is_sprinting)
	if is_sprinting and wants_crouch:
		if crouch_toggle_pressed or crouch_held:
			is_sprinting = false  # apertou agachar: para de correr
		else:
			_crouch_toggled = false
			wants_crouch = false
	if is_sprinting:
		_crouch_toggled = false
		wants_crouch = false
	_update_crouch(delta, wants_crouch)
	if is_crouching:
		is_sprinting = false  # teto baixo impediu de levantar

	# --- Gravidade e pulo -------------------------------------------------
	if not on_floor:
		body.velocity.y -= cfg.gravity * delta
		_fall_speed = maxf(_fall_speed, -body.velocity.y)
	elif jump_pressed:
		if is_crouching:
			_crouch_toggled = false  # pular agachado = levantar
		else:
			body.velocity.y = cfg.jump_velocity
			jumped.emit()

	# --- Velocidade alvo -------------------------------------------------
	var speed := cfg.walk_speed
	if is_crouching:
		speed = cfg.crouch_speed
	elif is_sprinting:
		speed = cfg.sprint_speed
	speed *= speed_mult
	var local := Vector3(input_dir.x * cfg.strafe_speed_multiplier, 0.0, input_dir.y)
	if input_dir.y > 0.0:
		local.z *= cfg.backward_speed_multiplier
	var wish := (body.global_basis * local) * speed
	wish.y = 0.0

	# --- Aceleração com peso ----------------------------------------------
	var hv := Vector3(body.velocity.x, 0.0, body.velocity.z)
	var accel: float
	if not on_floor:
		accel = cfg.air_acceleration
	elif wish.length_squared() < 0.01:
		accel = cfg.ground_deceleration
	elif is_sprinting:
		accel = cfg.sprint_acceleration
	else:
		accel = cfg.ground_acceleration
	# Mudar de direção custa um pouco mais (inércia).
	if on_floor and hv.length_squared() > 1.0 and wish.length_squared() > 0.01:
		if hv.normalized().dot(wish.normalized()) < 0.0:
			accel *= 0.8
	hv = hv.move_toward(wish, accel * delta)
	body.velocity.x = hv.x
	body.velocity.z = hv.z
	body.move_and_slide()

	# --- Pouso ------------------------------------------------------------
	on_floor = body.is_on_floor()
	if on_floor and not _was_on_floor:
		landed.emit(_fall_speed)
	if on_floor:
		_fall_speed = 0.0
	_was_on_floor = on_floor

	# --- Estado e passos --------------------------------------------------
	var hspeed := Vector2(body.velocity.x, body.velocity.z).length()
	if not on_floor:
		move_state = MoveState.AIR
	elif is_crouching:
		move_state = MoveState.CROUCH
	elif hspeed < 0.3:
		move_state = MoveState.IDLE
	elif is_sprinting:
		move_state = MoveState.SPRINT
	else:
		move_state = MoveState.WALK

	if on_floor and hspeed > 0.3:
		var prev_step := floori(step_phase / PI)
		step_phase += hspeed * delta / cfg.get_step_length(move_state) * PI
		if floori(step_phase / PI) != prev_step:
			footstep.emit(move_state)
		if step_phase > TAU * 64.0:
			step_phase -= TAU * 64.0
	else:
		# Parado: a fase volta suavemente para o "passo" mais próximo.
		var rest := roundf(step_phase / PI) * PI
		step_phase = move_toward(step_phase, rest, delta * 3.0)

	var sprint_target := 1.0 if move_state == MoveState.SPRINT else 0.0
	sprint_amount = move_toward(sprint_amount, sprint_target, delta * 4.0)


func get_horizontal_speed() -> float:
	return Vector2(body.velocity.x, body.velocity.z).length()


## Velocidade no espaço local (x = lateral, z = frente/trás).
func get_local_velocity() -> Vector3:
	return body.global_basis.inverse() * body.velocity


func _update_crouch(delta: float, wants_crouch: bool) -> void:
	if wants_crouch:
		is_crouching = true
	elif is_crouching and _can_stand():
		is_crouching = false
	var target := 1.0 if is_crouching else 0.0
	if not is_equal_approx(crouch_amount, target):
		crouch_amount = move_toward(crouch_amount, target, delta * GameConfig.crouch_transition_speed)
		_apply_crouch_shape()


func _apply_crouch_shape() -> void:
	var cfg := GameConfig
	var t := smoothstep(0.0, 1.0, crouch_amount)
	capsule.height = lerpf(cfg.player_height, cfg.crouch_height, t)
	collision.position.y = capsule.height * 0.5
	current_eye_height = lerpf(cfg.eye_height_stand, cfg.eye_height_crouch, t)


## Há espaço acima para levantar?
func _can_stand() -> bool:
	var missing := GameConfig.player_height - capsule.height
	if missing <= 0.01:
		return true
	return not body.test_move(body.global_transform, Vector3.UP * missing)
