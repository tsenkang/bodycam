class_name Weapon
extends Node3D
## ============================================================================
##  CLASSE BASE DE TODAS AS ARMAS
## ============================================================================
##  Weapon
##  ├── MP4       (weapons/types/mp4.gd)
##  ├── Glock     (weapons/types/glock.gd)
##  ├── Shotgun   (weapons/types/shotgun.gd)
##  ├── AK47      (weapons/types/ak47.gd)
##  └── Sniper    (weapons/types/sniper.gd)
##
##  A base cuida de: munição, cadência, modos de disparo, recarga, dispersão,
##  recuo, mira (ADS), troca (sacar/guardar) e animação procedural.
##  As subclasses só sobrescrevem o que é diferente (hooks "_on_*").
##  Os números vêm de WeaponData (config/weapon_config.gd).
## ============================================================================

signal fired(weapon: Weapon, recoil: Vector2)
signal ammo_changed(mag: int, reserve: int)
signal reload_state_changed(is_reloading: bool)

enum State { HOLSTERED, DRAWING, READY, RELOADING, HOLSTERING }

## ID em WeaponConfig — cada subclasse define o seu em _init().
var weapon_id: StringName = &""
var data: WeaponData
## Quem segura a arma. Precisa ter: get_aim_transform(), get_hit_exclusions().
var user: Node3D

var ammo_in_mag := 0
var reserve_ammo := 0
var state: State = State.HOLSTERED
## 0 = quadril, 1 = mirando (suavizado).
var ads_amount := 0.0
## Dispersão atual em graus (a HUD usa para abrir/fechar a mira).
var current_spread := 0.0
var shots_in_burst := 0
var sight_height := 0.07

var _cooldown := 0.0
var _bloom := 0.0
var _state_timer := 0.0
var _state_total := 1.0
var _reload_committed := false
var _auto_reload_timer := -1.0
var _trigger_idle := 0.0
var _last_ctx: WeaponContext

# Animação procedural (tudo em espaço local da câmera).
var _model: Node3D
var _muzzle: Node3D
var _parts := {}
var _flash: MeshInstance3D
var _flash_light: OmniLight3D
var _flash_time := 0.0
var _kick_pos := Vector3.ZERO
var _kick_rot := Vector3.ZERO     # graus
var _sway := Vector2.ZERO
var _sprint_blend := 0.0
var _reload_blend := 0.0
var _crouch_blend := 0.0
var _action_anim := 0.0           # 1 → 0 (bombear / ferrolho / ferrolho da pistola)
var _anim_time := 0.0


## Cria a arma certa (subclasse) a partir do ID do config.
static func create(id: StringName) -> Weapon:
	var d := WeaponData.from_config(id)
	var w: Weapon = load(d.script_path).new()
	w.data = d
	w.weapon_id = id
	w.name = String(id)
	return w


func _ready() -> void:
	if data == null:
		data = WeaponData.from_config(weapon_id)
	ammo_in_mag = data.magazine_size
	reserve_ammo = data.reserve_ammo
	var built := WeaponModelBuilder.build(data)
	_model = built.root
	_muzzle = built.muzzle
	_parts = built.parts
	sight_height = built.sight_height
	add_child(_model)
	_build_muzzle_flash()
	visible = false
	if built.get("needs_fit", false):
		# Modelo importado: espera o esqueleto/malhas atualizarem e encaixa.
		await get_tree().process_frame
		await get_tree().process_frame
		sight_height = WeaponModelBuilder.fit_scene(_model, data, _muzzle)


# ============================================================================
#  API usada pelo WeaponManager
# ============================================================================
func draw() -> void:
	visible = true
	state = State.DRAWING
	_state_total = data.draw_time
	_state_timer = data.draw_time
	_sprint_blend = 0.0
	AudioManager.play_2d(data.sound_draw, -6.0)


func holster() -> void:
	if state == State.HOLSTERED:
		return
	if state == State.RELOADING:
		_cancel_reload()
	state = State.HOLSTERING
	_state_total = data.holster_time
	_state_timer = data.holster_time
	ads_amount = minf(ads_amount, 0.5)


func force_holster() -> void:
	_cancel_reload()
	state = State.HOLSTERED
	visible = false
	ads_amount = 0.0


func is_ready() -> bool:
	return state == State.READY


func is_reloading() -> bool:
	return state == State.RELOADING


## Mira telescópica ativa? (a HUD mostra a luneta)
func is_scoped() -> bool:
	return false


func refill_ammo() -> void:
	reserve_ammo = data.max_reserve
	ammo_changed.emit(ammo_in_mag, reserve_ammo)


func reset_ammo() -> void:
	ammo_in_mag = data.magazine_size
	reserve_ammo = data.reserve_ammo
	ammo_changed.emit(ammo_in_mag, reserve_ammo)


## Lógica (física): disparo, recarga, timers. Chamado pelo WeaponManager.
func physics_tick(delta: float, ctx: WeaponContext) -> void:
	_last_ctx = ctx
	_bloom = move_toward(_bloom, 0.0, data.bloom_recovery * delta)
	if ctx.trigger_held:
		_trigger_idle = 0.0
	else:
		_trigger_idle += delta
		if _trigger_idle > 0.25:
			shots_in_burst = 0

	match state:
		State.DRAWING:
			_state_timer -= delta
			if _state_timer <= 0.0:
				state = State.READY
		State.HOLSTERING:
			_state_timer -= delta
			if _state_timer <= 0.0:
				state = State.HOLSTERED
				visible = false
		State.RELOADING:
			_process_reload(delta)

	# Mirar: não mira correndo nem guardando a arma.
	var can_ads := ctx.wants_ads and not ctx.is_sprinting and state != State.HOLSTERING and state != State.HOLSTERED
	var ads_target := 1.0 if can_ads else 0.0
	ads_amount = move_toward(ads_amount, ads_target, delta / maxf(data.ads_time, 0.01))

	# Sprint: a arma fica abaixada; ao parar de correr leva um tempo para voltar.
	var sprint_target := 1.0 if ctx.is_sprinting and state != State.RELOADING else 0.0
	_sprint_blend = move_toward(_sprint_blend, sprint_target, delta / 0.18)

	current_spread = _compute_spread(ctx)

	if ctx.reload_pressed:
		start_reload()
	if _auto_reload_timer >= 0.0:
		_auto_reload_timer -= delta
		if _auto_reload_timer < 0.0 and ammo_in_mag == 0:
			start_reload()

	# Cadência: acumula o tempo para cadências altas não dependerem do FPS.
	_cooldown -= delta
	if _cooldown < 0.0 and not ctx.trigger_held:
		_cooldown = 0.0
	_handle_trigger(ctx)


## Animação (frame): pose da arma, balanço, recuo visual, troca.
func visual_tick(delta: float, ctx: WeaponContext) -> void:
	_anim_time += delta
	var cfg := GameConfig
	var weight_factor := 0.8 + data.weight * 0.08
	var ads_e := smoothstep(0.0, 1.0, ads_amount)
	var not_ads := 1.0 - ads_e * 0.9

	# Recarga e agachar (suavizados).
	_reload_blend = move_toward(_reload_blend, 1.0 if state == State.RELOADING else 0.0, delta * 5.0)
	_crouch_blend = move_toward(_crouch_blend, 1.0 if ctx.is_crouching else 0.0, delta * 5.0)

	# Recuo visual volta para zero (armas pesadas voltam mais devagar).
	var ret := 1.0 - exp(-(16.0 / weight_factor) * delta)
	_kick_pos = _kick_pos.lerp(Vector3.ZERO, ret)
	_kick_rot = _kick_rot.lerp(Vector3.ZERO, ret)
	_action_anim = move_toward(_action_anim, 0.0, delta * 2.2)

	# Sway: a arma atrasa ao virar (mais peso = mais atraso).
	var turn_rate := ctx.look_delta / maxf(delta, 0.0001)
	var sway_target := (-turn_rate * cfg.weapon_sway_amount * cfg.sway_intensity * weight_factor * not_ads)
	sway_target = sway_target.limit_length(cfg.weapon_sway_max)
	_sway = _sway.lerp(sway_target, 1.0 - exp(-(9.0 / weight_factor) * delta))

	# Balanço ao andar: padrões diferentes para caminhar/correr/agachar.
	var bob_amp := cfg.get_weapon_bob(ctx.move_state) * weight_factor * cfg.head_bob_intensity
	var bob_k := clampf(ctx.move_ratio, 0.0, 1.4) * not_ads
	var ph := ctx.step_phase
	var bob := Vector3(sin(ph) * bob_amp.x, -absf(sin(ph)) * bob_amp.y, 0.0) * bob_k
	var bob_rot := Vector3(0.0, 0.0, sin(ph) * 1.2) * bob_k
	if ctx.move_state == PlayerMovement.MoveState.SPRINT:
		bob_rot += Vector3(sin(ph * 2.0) * 3.0, sin(ph) * 4.0, 0.0) * _sprint_blend

	# Respiração.
	var breath := Vector3(0.0, sin(_anim_time * 1.6) * 0.002, 0.0) * not_ads

	# --- Pose base: quadril ↔ mira ---------------------------------------
	var ads_pos := Vector3(0.0, -sight_height, -data.ads_distance)
	var pos := data.hip_position.lerp(ads_pos, ads_e)
	var rot := Vector3.ZERO

	pos += bob + breath + Vector3(_sway.x, _sway.y, 0.0)
	rot += bob_rot + Vector3(_sway.y * 60.0, _sway.x * 60.0, -_sway.x * 40.0)

	# Corrida.
	var sp := smoothstep(0.0, 1.0, _sprint_blend)
	pos += Vector3(-0.04, -0.05, 0.04) * sp
	rot += data.sprint_rotation * sp

	# Agachado: leve inclinação.
	rot += Vector3(0.0, 0.0, 4.0) * _crouch_blend * not_ads

	# Recarga: arma inclina e desce.
	var rl := smoothstep(0.0, 1.0, _reload_blend)
	var rattle := sin(_anim_time * 22.0) * 1.5 * rl
	pos += Vector3(-0.02, -0.07, 0.03) * rl
	rot += Vector3(-18.0 + rattle, 12.0, 28.0) * rl

	# Sacar / guardar.
	var sw := _switch_amount()
	pos += Vector3(0.0, -0.32, 0.08) * sw
	rot += Vector3(-45.0, 0.0, 10.0) * sw

	# Recuo visual.
	pos += _kick_pos
	rot += _kick_rot

	transform = Transform3D(Basis.from_euler(rot * (PI / 180.0)), pos)
	_animate_parts(delta)
	_update_flash(delta)


# ============================================================================
#  Disparo
# ============================================================================
func _handle_trigger(ctx: WeaponContext) -> void:
	if not (ctx.trigger_held or ctx.trigger_pressed):
		return
	if state != State.READY and state != State.RELOADING:
		return
	if _sprint_blend > 0.35:
		return  # ainda levantando a arma depois de correr
	if ammo_in_mag <= 0:
		if ctx.trigger_pressed:
			AudioManager.play_2d(data.sound_empty, -4.0)
			start_reload()
		return
	if state == State.RELOADING:
		if not _can_fire_during_reload():
			return
		_cancel_reload()
	if not data.is_automatic() and not ctx.trigger_pressed:
		return
	if _cooldown > 0.0:
		return
	# Automáticas: pode disparar mais de uma vez por frame em FPS baixo.
	var guard := 0
	while _cooldown <= 0.0 and ammo_in_mag > 0 and guard < 3:
		_fire(ctx)
		_cooldown += data.seconds_per_shot()
		guard += 1
		if not data.is_automatic():
			break


func _fire(ctx: WeaponContext) -> void:
	ammo_in_mag -= 1
	shots_in_burst += 1
	var aim: Transform3D = user.get_aim_transform()
	var exclude: Array[RID] = user.get_hit_exclusions()
	var spread := current_spread
	for i in data.pellets:
		var pellet_spread := spread
		if data.pellets > 1:
			pellet_spread = maxf(spread, data.pellet_spread * lerpf(1.0, 0.8, ads_amount))
		var dir := Ballistics.spread_direction(aim.basis, pellet_spread)
		Ballistics.fire_ray(user, aim.origin, dir, data, exclude)
	_bloom = minf(_bloom + data.bloom_per_shot, data.max_bloom)

	# Recuo (a câmera recebe pelo sinal "fired").
	var recoil := _compute_recoil(shots_in_burst)
	if ctx.is_crouching:
		recoil *= 0.85
	recoil *= lerpf(1.0, data.ads_recoil_mult, ads_amount) * GameConfig.recoil_intensity

	# Recuo visual da arma.
	var kick_mult := lerpf(1.0, 0.55, ads_amount) * GameConfig.recoil_intensity
	_kick_pos += Vector3(randf_range(-0.004, 0.004), 0.004, data.visual_kick) * kick_mult
	_kick_rot += Vector3(data.visual_kick_rotation, randf_range(-1.0, 1.0) * data.visual_kick_rotation * 0.3,
		randf_range(-1.0, 1.0) * data.visual_kick_rotation * 0.4) * kick_mult

	_show_muzzle_flash()
	AudioManager.play_2d(data.sound_fire, 0.0, 0.05)
	Events.noise_emitted.emit(user.global_position, data.noise_radius, user)
	_on_fired()
	fired.emit(self, recoil)
	ammo_changed.emit(ammo_in_mag, reserve_ammo)
	if ammo_in_mag == 0 and reserve_ammo > 0:
		_auto_reload_timer = 0.3


func _compute_spread(ctx: WeaponContext) -> float:
	var base := lerpf(data.hip_spread, data.ads_spread, ads_amount)
	var move := data.move_spread * clampf(ctx.move_ratio, 0.0, 1.5) * lerpf(1.0, 0.35, ads_amount)
	if not ctx.is_grounded:
		move += data.move_spread * 1.5
	var bloom := _bloom * lerpf(1.0, 0.5, ads_amount)
	var crouch := 0.85 if ctx.is_crouching else 1.0
	# Precisão 1.0 = sem penalidade; 0.5 = 50% mais dispersão.
	var accuracy_mult := 1.0 + (1.0 - clampf(data.accuracy, 0.0, 1.0))
	return (base + move + bloom) * crouch * accuracy_mult


# ============================================================================
#  Recarga (subclasses podem sobrescrever — ex.: espingarda cartucho a cartucho)
# ============================================================================
func start_reload() -> bool:
	if state != State.READY:
		return false
	if ammo_in_mag >= data.magazine_size or reserve_ammo <= 0:
		return false
	state = State.RELOADING
	_reload_committed = false
	_auto_reload_timer = -1.0
	_begin_reload()
	reload_state_changed.emit(true)
	return true


## Progresso da recarga 0..1 (HUD).
func get_reload_progress() -> float:
	if state != State.RELOADING:
		return 0.0
	return clampf(1.0 - _state_timer / maxf(_state_total, 0.001), 0.0, 1.0)


func _begin_reload() -> void:
	_state_total = data.reload_empty_time if ammo_in_mag == 0 else data.reload_time
	_state_timer = _state_total
	AudioManager.play_2d(data.sound_reload, -3.0)


func _process_reload(delta: float) -> void:
	_state_timer -= delta
	if not _reload_committed and get_reload_progress() >= data.reload_commit:
		_commit_reload()
	if _state_timer <= 0.0:
		_finish_reload()


func _commit_reload() -> void:
	_reload_committed = true
	var taken := mini(data.magazine_size - ammo_in_mag, reserve_ammo)
	ammo_in_mag += taken
	reserve_ammo -= taken
	ammo_changed.emit(ammo_in_mag, reserve_ammo)


func _finish_reload() -> void:
	if not _reload_committed:
		_commit_reload()
	state = State.READY
	reload_state_changed.emit(false)


func _cancel_reload() -> void:
	if state == State.RELOADING:
		state = State.READY
		reload_state_changed.emit(false)


## Depois que a munição entrou, dá para atirar e pular o fim da animação.
func _can_fire_during_reload() -> bool:
	return _reload_committed


# ============================================================================
#  Hooks para subclasses
# ============================================================================
## Padrão de recuo (graus): x = vertical, y = horizontal.
func _compute_recoil(_shot_index: int) -> Vector2:
	var v := data.recoil_vertical * randf_range(0.85, 1.15)
	var h := data.recoil_horizontal * (randf_range(-1.0, 1.0) + data.recoil_horizontal_bias)
	return Vector2(v, h)


## Chamado depois de cada disparo (bombear, ferrolho, etc.).
func _on_fired() -> void:
	pass


## Anima peças móveis do modelo (ferrolho, bomba...).
func _animate_parts(_delta: float) -> void:
	pass


# ============================================================================
#  Visual
# ============================================================================
func _switch_amount() -> float:
	match state:
		State.DRAWING:
			return ease(clampf(_state_timer / maxf(_state_total, 0.001), 0.0, 1.0), 2.0)
		State.HOLSTERING:
			return ease(clampf(1.0 - _state_timer / maxf(_state_total, 0.001), 0.0, 1.0), 2.0)
		State.HOLSTERED:
			return 1.0
	return 0.0


func _build_muzzle_flash() -> void:
	_flash = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.14, 0.14)
	_flash.mesh = q
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(1.0, 0.7, 0.35, 0.9)
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.use_z_clip_scale = true
	m.z_clip_scale = 0.35
	m.use_fov_override = true
	m.fov_override = WeaponModelBuilder.VIEWMODEL_FOV
	_flash.material_override = m
	_flash.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_flash.visible = false
	_muzzle.add_child(_flash)
	_flash_light = OmniLight3D.new()
	_flash_light.light_color = Color(1.0, 0.75, 0.45)
	_flash_light.omni_range = 6.0
	_flash_light.light_energy = 0.0
	_muzzle.add_child(_flash_light)


func _show_muzzle_flash() -> void:
	_flash_time = 0.045
	_flash.visible = not is_scoped()
	_flash.rotation.z = randf() * TAU
	var s := randf_range(0.8, 1.3) * (1.8 if data.pellets > 1 else 1.0)
	_flash.scale = Vector3(s, s, s)
	_flash_light.light_energy = 3.0


func _update_flash(delta: float) -> void:
	if _flash_time > 0.0:
		_flash_time -= delta
		if _flash_time <= 0.0:
			_flash.visible = false
			_flash_light.light_energy = 0.0
