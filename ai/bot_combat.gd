class_name BotCombat
extends RefCounted
## Uso da arma pelo bot: rajadas, tempo de reação, erro de mira, recarga.
## Usa as MESMAS estatísticas das armas do jogador (WeaponData) e o mesmo
## sistema de tiro (Ballistics). A dificuldade muda precisão e reação,
## nunca o dano.

var bot: Bot
var profile: BotProfile
var data: WeaponData
var mag := 0
var reloading := false
## O estado atual da IA permite atirar?
var allow_fire := true

var _reload_timer := 0.0
var _cooldown := 0.0
var _burst_left := 0
var _burst_pause := 0.0
var _track_time := 0.0
var _tracked: Node3D = null


func _init(p_bot: Bot, p_profile: BotProfile) -> void:
	bot = p_bot
	profile = p_profile


func equip(weapon_id: StringName) -> void:
	data = WeaponData.from_config(weapon_id)
	mag = data.magazine_size
	reloading = false


func reset() -> void:
	mag = data.magazine_size
	reloading = false
	_burst_left = 0
	_burst_pause = 0.0
	_track_time = 0.0


## Distância em que o bot prefere lutar com esta arma.
func preferred_range() -> float:
	return clampf(data.effective_range * 1.2, 6.0, 40.0)


func needs_reload() -> bool:
	return not reloading and mag == 0


func should_top_up() -> bool:
	return not reloading and mag < int(data.magazine_size * 0.5)


func start_reload() -> void:
	if reloading or mag >= data.magazine_size:
		return
	reloading = true
	_reload_timer = data.reload_time if mag > 0 else data.reload_empty_time
	if data.pellets > 1:
		_reload_timer = data.reload_start_time + data.reload_time * (data.magazine_size - mag)
	AudioManager.play_at(data.sound_reload, bot.global_position, -6.0)


func tick(delta: float) -> void:
	_cooldown -= delta
	if reloading:
		_reload_timer -= delta
		if _reload_timer <= 0.0:
			reloading = false
			mag = data.magazine_size
		return

	var p := bot.perception
	if not (p.target_visible and p.has_target()):
		_track_time = 0.0
		_tracked = null
		return
	if p.target != _tracked:
		_tracked = p.target
		_track_time = 0.0
	_track_time += delta

	if not allow_fire or not p.reaction_elapsed() or _cooldown > 0.0:
		return
	if mag <= 0:
		start_reload()
		return
	var target := p.target
	var dist := bot.global_position.distance_to(target.global_position)
	if dist > data.max_range * 0.9:
		return
	if data.pellets > 1 and dist > data.effective_range * 2.5:
		return  # espingarda não atira de longe
	if not bot.is_facing(target.global_position, 12.0):
		return

	# Rajadas com pausas (armas automáticas).
	if _burst_left <= 0:
		if _burst_pause > 0.0:
			_burst_pause -= delta
			return
		_burst_left = randi_range(profile.burst_shots.x, profile.burst_shots.y)
		if not data.is_automatic():
			_burst_left = mini(_burst_left, 3)
	_shoot(target)
	_burst_left -= 1
	var interval := data.seconds_per_shot()
	if not data.is_automatic():
		interval = maxf(interval, 0.28) * randf_range(1.0, 1.4)
	_cooldown = interval
	if _burst_left <= 0:
		_burst_pause = randf_range(profile.burst_pause.x, profile.burst_pause.y)


func _shoot(target: Node3D) -> void:
	mag -= 1
	var origin := bot.get_eye_position()
	var aim_point: Vector3 = target.get_head_position() if randf() < profile.headshot_chance else target.get_chest_position()
	var dir := (aim_point - origin).normalized()

	# Erro de mira: começa maior e "assenta" com o tempo rastreando o alvo.
	var settle := clampf(_track_time / maxf(profile.aim_settle_time, 0.01), 0.0, 1.0)
	var error := profile.aim_error_deg * lerpf(profile.initial_error_mult, 1.0, settle)
	var target_speed := Vector2(target.velocity.x, target.velocity.z).length()
	error *= 1.0 + profile.moving_target_penalty * clampf(target_speed / 6.0, 0.0, 1.0)
	if bot.get_horizontal_speed() > 1.0:
		error *= 1.3
	error += data.ads_spread

	var basis := Ballistics.basis_from_direction(dir)
	var exclude := bot.get_hit_exclusions()
	var first_end := Vector3.ZERO
	for i in data.pellets:
		var pellet_error := error
		if data.pellets > 1:
			pellet_error = maxf(error, data.pellet_spread)
		var d := Ballistics.spread_direction(basis, pellet_error)
		var result := Ballistics.fire_ray(bot, origin, d, data, exclude, GameConfig.bot_damage_multiplier)
		if i == 0:
			first_end = result.position
	var muzzle := bot.get_muzzle_position()
	Events.tracer.emit(muzzle, first_end)
	bot.rig.flash_muzzle()
	AudioManager.play_at(data.sound_fire, muzzle, 0.0, 0.06)
	Events.noise_emitted.emit(bot.global_position, data.noise_radius, bot)
