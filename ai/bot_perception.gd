class_name BotPerception
extends RefCounted
## "Sentidos" do bot: visão (cone + linha de visão), audição (tiros e
## passos), reação ao levar dano e avisos de aliados.
## A visão roda em intervalos (profile.perception_interval), não a cada
## frame, e usa no máximo 2 raios por inimigo — barato mesmo com 16 bots.

var bot: Bot
var profile: BotProfile

## Inimigo atual (pode estar fora de vista).
var target: Node3D = null
var target_visible := false
var last_known_position := Vector3.ZERO
var last_known_velocity := Vector3.ZERO
var last_seen_time := -1000.0
## Momento em que o alvo atual foi (re)avistado — base do tempo de reação.
var acquired_time := -1000.0

## Último som relevante ouvido.
var has_noise := false
var noise_position := Vector3.ZERO

var _awareness := {}          # instance_id -> 0..1
var _timer := 0.0
var _pending_damage: Array = []  # [[tempo_para_reagir, atacante], ...]
var _last_callout := -1000.0


func _init(p_bot: Bot, p_profile: BotProfile) -> void:
	bot = p_bot
	profile = p_profile
	_timer = randf() * profile.perception_interval  # espalha as checagens


func reset() -> void:
	target = null
	target_visible = false
	has_noise = false
	_awareness.clear()
	_pending_damage.clear()
	last_seen_time = -1000.0


static func now() -> float:
	return Time.get_ticks_msec() / 1000.0


func time_since_seen() -> float:
	return now() - last_seen_time


func has_target() -> bool:
	return target != null and is_instance_valid(target) and target.is_alive()


## Já passou o tempo de reação desde que avistou o alvo?
func reaction_elapsed() -> bool:
	return now() - acquired_time >= profile.reaction_time


func tick(delta: float) -> void:
	# Reação atrasada ao dano (fácil demora mais).
	for i in range(_pending_damage.size() - 1, -1, -1):
		_pending_damage[i][0] -= delta
		if _pending_damage[i][0] <= 0.0:
			_react_to_attacker(_pending_damage[i][1])
			_pending_damage.remove_at(i)
	_timer -= delta
	if _timer > 0.0:
		return
	var dt := profile.perception_interval - _timer
	_timer = profile.perception_interval
	_scan(dt)


func _scan(dt: float) -> void:
	var eye := bot.get_eye_position()
	var forward := -bot.global_basis.z
	var cos_half := cos(deg_to_rad(profile.fov_degrees * 0.5))
	var best: Node3D = null
	var best_dist := INF
	var t := now()
	for actor in bot.get_tree().get_nodes_in_group("combatants"):
		if actor.team == bot.team or not actor.is_alive():
			continue
		var id: int = actor.get_instance_id()
		var chest: Vector3 = actor.get_chest_position()
		var to := chest - eye
		var dist := to.length()
		var seen := false
		if dist <= profile.detection_range:
			var in_cone := dist < 3.0 or forward.dot(to / dist) >= cos_half
			if in_cone and _line_of_sight(eye, actor):
				seen = true
		var aw: float = _awareness.get(id, 0.0)
		if seen:
			if actor == target and time_since_seen() < 2.0:
				aw = 1.0  # já estava rastreando: mantém
			else:
				var dist_factor := lerpf(2.4, 0.5, clampf(dist / profile.detection_range, 0.0, 1.0))
				aw += dt / profile.detection_time * dist_factor * actor.get_visibility_factor()
		else:
			aw -= dt * 0.3
		aw = clampf(aw, 0.0, 1.0)
		_awareness[id] = aw
		if seen and aw >= 1.0 and dist < best_dist:
			best = actor
			best_dist = dist

	if best:
		if best != target or time_since_seen() > 1.0:
			acquired_time = t
		target = best
		target_visible = true
		last_known_position = best.global_position
		last_known_velocity = best.velocity
		last_seen_time = t
		has_noise = false
		if profile.team_callouts and t - _last_callout > 2.0:
			_last_callout = t
			Events.enemy_spotted.emit(bot, best, best.global_position)
	else:
		target_visible = false
		if target and (not is_instance_valid(target) or not target.is_alive()):
			target = null


func _line_of_sight(eye: Vector3, actor: Node3D) -> bool:
	var space := bot.get_world_3d().direct_space_state
	for point in [actor.get_chest_position(), actor.get_head_position()]:
		var q := PhysicsRayQueryParameters3D.create(eye, point, Layers.WORLD)
		if space.intersect_ray(q).is_empty():
			return true
	return false


# --- Eventos externos --------------------------------------------------------
func on_damaged(attacker: Node) -> void:
	if attacker == null or not is_instance_valid(attacker) or attacker == bot:
		return
	_pending_damage.append([profile.damage_reaction_time, attacker])


func _react_to_attacker(attacker: Node) -> void:
	if not is_instance_valid(attacker) or not attacker.is_alive():
		return
	_awareness[attacker.get_instance_id()] = 1.0
	if not target_visible:
		target = attacker
		last_known_position = attacker.global_position
		last_known_velocity = Vector3.ZERO
		last_seen_time = now() - 0.5
		acquired_time = now()


func on_noise(pos: Vector3, radius: float, source: Node) -> void:
	if source == null or source == bot or not is_instance_valid(source):
		return
	if "team" in source and source.team == bot.team:
		return
	if target_visible:
		return
	var is_gunshot := radius >= 30.0
	if is_gunshot and not profile.reacts_to_gunshots:
		return
	var heard := radius * profile.hearing_multiplier
	if bot.global_position.distance_to(pos) > heard:
		return
	# Bots menos habilidosos estimam a posição com mais erro.
	var err := lerpf(6.0, 1.5, profile.hearing_multiplier)
	noise_position = pos + Vector3(randf_range(-err, err), 0.0, randf_range(-err, err))
	has_noise = true


func on_callout(position: Vector3) -> void:
	if target_visible:
		return
	noise_position = position
	has_noise = true
