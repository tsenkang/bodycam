class_name BodycamCamera
extends Camera3D
## Câmera em primeira pessoa com sensação de BODYCAM.
##
## Todos os efeitos são somados como pequenos DESLOCAMENTOS em cima da mira
## real (que fica no nó "Head" do jogador):
##   - head bob e balanço lateral sincronizados com os passos
##   - inclinação ao andar de lado
##   - inércia ao virar rápido (a câmera "atrasa" um pouco)
##   - impacto ao pousar (mola)
##   - recuo dos disparos + tremor
##   - respiração parada
## Os valores ficam em GameConfig (seção CÂMERA).

var movement: PlayerMovement
var weapons: WeaponManager

var _look_input := Vector2.ZERO      # graus aplicados à mira neste frame (yaw, pitch)
var _turn_lag := Vector2.ZERO        # graus de atraso (yaw, pitch)
var _bob_weight := 0.0
var _strafe_roll := 0.0
var _recoil_target := Vector2.ZERO   # graus (pitch, yaw)
var _recoil := Vector2.ZERO
var _recoil_recovery := 8.0
var _land_offset := 0.0
var _land_velocity := 0.0
var _shake := 0.0
var _time := 0.0
var _death_blend := 0.0
var _death_roll := 0.0
var _dead := false


func _ready() -> void:
	fov = GameConfig.camera_fov
	near = 0.03
	far = 500.0


## O jogador informa quanto girou a mira (graus) para calcular a inércia.
func add_look_input(yaw_degrees: float, pitch_degrees: float) -> void:
	_look_input += Vector2(yaw_degrees, pitch_degrees)


## Recuo visual: pitch/yaw em graus. recovery em graus por segundo.
func add_recoil(pitch_degrees: float, yaw_degrees: float, recovery: float, shake: float) -> void:
	_recoil_target += Vector2(pitch_degrees, yaw_degrees)
	_recoil_recovery = maxf(recovery, 0.5)
	add_shake(shake)


func add_shake(amount: float) -> void:
	_shake = minf(_shake + amount, 1.0)


func add_landing_impact(fall_speed: float) -> void:
	var cfg := GameConfig
	if fall_speed < cfg.landing_min_speed:
		return
	var strength := clampf((fall_speed - cfg.landing_min_speed) / 9.0, 0.15, 1.0)
	_land_velocity -= strength * 1.1 * cfg.landing_impact


func set_dead(dead: bool) -> void:
	_dead = dead
	_death_blend = 0.0
	_death_roll = randf_range(-1.0, 1.0)
	if not dead:
		reset_effects()


func reset_effects() -> void:
	_turn_lag = Vector2.ZERO
	_recoil = Vector2.ZERO
	_recoil_target = Vector2.ZERO
	_land_offset = 0.0
	_land_velocity = 0.0
	_shake = 0.0
	position = Vector3.ZERO
	rotation = Vector3.ZERO
	fov = GameConfig.camera_fov


func _process(delta: float) -> void:
	if movement == null or delta <= 0.0:
		return
	var cfg := GameConfig
	_time += delta
	var smooth := 1.0 - exp(-cfg.camera_smoothing * delta)

	if _dead:
		# Câmera "cai" com o corpo ao morrer.
		_death_blend = move_toward(_death_blend, 1.0, delta * 2.5)
		var e := ease(_death_blend, 0.4)
		position = Vector3(0, -1.1 * e, 0.2 * e)
		rotation = Vector3(deg_to_rad(-25.0 * e), 0, deg_to_rad(35.0 * _death_roll * e))
		return

	var ads := weapons.get_ads_amount() if weapons else 0.0
	var calm := lerpf(1.0, cfg.ads_camera_motion, ads)

	# --- Head bob sincronizado com os passos ---------------------------
	var speed_ratio := movement.get_horizontal_speed() / cfg.walk_speed
	var target_weight := clampf(speed_ratio, 0.0, 1.4) if movement.body.is_on_floor() else 0.0
	_bob_weight = lerpf(_bob_weight, target_weight, 1.0 - exp(-8.0 * delta))
	var amp := cfg.get_camera_bob(movement.move_state)
	var k := _bob_weight * cfg.head_bob_intensity * calm
	var phase := movement.step_phase
	# x: balanço lateral (1 ciclo a cada 2 passos); y: desce a cada passo.
	var bob_pos := Vector3(sin(phase) * amp.x, -(1.0 - cos(2.0 * phase)) * 0.5 * amp.y, 0.0) * k
	var bob_roll := sin(phase) * amp.z * k
	var bob_pitch := sin(2.0 * phase) * amp.z * 0.35 * k

	# --- Respiração parada ----------------------------------------------
	var breath := sin(_time * 1.5) * cfg.idle_breath * (1.0 - clampf(_bob_weight, 0.0, 1.0)) * calm

	# --- Inércia ao virar (a câmera atrasa um pouco em relação à mira) ---
	var turn_rate := _look_input / delta
	_look_input = Vector2.ZERO
	var lag_target := (-turn_rate * cfg.turn_inertia * cfg.sway_intensity * calm).limit_length(cfg.turn_inertia_max)
	_turn_lag = _turn_lag.lerp(lag_target, smooth)

	# --- Inclinação ao andar de lado --------------------------------------
	var lateral := movement.get_local_velocity().x / cfg.sprint_speed
	_strafe_roll = lerpf(_strafe_roll, -lateral * cfg.strafe_tilt * calm, 1.0 - exp(-6.0 * delta))

	# --- Recuo ----------------------------------------------------------
	_recoil_target = _recoil_target.move_toward(Vector2.ZERO, _recoil_recovery * delta)
	_recoil = _recoil.lerp(_recoil_target, 1.0 - exp(-cfg.recoil_snap * delta))

	# --- Pouso (mola amortecida) -----------------------------------------
	var spring_accel := -cfg.landing_spring_stiffness * _land_offset - cfg.landing_spring_damping * _land_velocity
	_land_velocity += spring_accel * delta
	_land_offset = clampf(_land_offset + _land_velocity * delta, -0.16, 0.05)

	# --- Tremor ---------------------------------------------------------
	_shake = move_toward(_shake, 0.0, delta * 3.5)
	var s := _shake * _shake * cfg.shake_max_degrees
	var shake := Vector3(sin(_time * 41.0), sin(_time * 37.0 + 1.3), sin(_time * 29.0 + 2.1)) * s

	# --- Composição final ---------------------------------------------------
	position = bob_pos + Vector3(0.0, _land_offset + breath, 0.0)
	var pitch := _recoil.x + bob_pitch + _turn_lag.y + shake.x + _land_offset * 18.0
	var yaw := _recoil.y + _turn_lag.x + shake.y
	var roll := bob_roll + _strafe_roll - _turn_lag.x * cfg.turn_roll_factor + shake.z
	roll = clampf(roll, -cfg.max_camera_roll, cfg.max_camera_roll)
	rotation = Vector3(deg_to_rad(pitch), deg_to_rad(yaw), deg_to_rad(roll))

	# --- FOV (mira e corrida) ------------------------------------------
	var zoom := weapons.get_ads_zoom() if weapons else 1.0
	var target_fov := cfg.camera_fov / lerpf(1.0, zoom, ads) + cfg.sprint_fov_boost * movement.sprint_amount
	fov = lerpf(fov, target_fov, 1.0 - exp(-14.0 * delta))
