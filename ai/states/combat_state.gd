class_name CombatState
extends BotState
## Combate: mira e atira no alvo, se movimenta (strafe), controla a
## distância, decide entre atacar e procurar cobertura, recarrega e troca
## de posição. A qualidade de tudo isso vem do perfil de dificuldade.

var _reposition_at := 0.0
var _next_strafe := 0.0
var _crouch_until := 0.0


func _init() -> void:
	handles_enemy = true


func enter(_params: Dictionary) -> void:
	bot.combat.allow_fire = true
	bot.stop_moving()
	var interval := profile().reposition_interval
	_reposition_at = now() + (interval * randf_range(0.7, 1.3) if interval > 0.0 else INF)
	_next_strafe = now()


func exit() -> void:
	bot.set_crouch(false)


func update(_delta: float) -> void:
	var p := perception()
	if p.has_target():
		if p.target_visible:
			bot.look_at_point(p.target.get_chest_position())
		else:
			bot.look_at_point(p.last_known_position + Vector3.UP * 1.3)


func think() -> void:
	var p := perception()
	var prof := profile()
	if not p.has_target():
		brain.change_state(&"patrol")
		return

	# --- Perdeu de vista ----------------------------------------------------
	if not p.target_visible:
		if p.time_since_seen() > 0.8:
			if prof.flank_chance > 0.0 and randf() < prof.flank_chance:
				brain.change_state(&"flank")
			elif prof.chase_enabled:
				brain.change_state(&"chase")
			else:
				brain.change_state(&"search")
		return

	var target := p.target
	var dist := bot.global_position.distance_to(target.global_position)

	# --- Recarga: cobertura ou no lugar ------------------------------------
	if bot.combat.needs_reload():
		if randf() < prof.cover_usage:
			brain.change_state(&"cover", {"reason": "reload"})
		else:
			bot.combat.start_reload()
		return

	# --- Vida baixa: procurar cobertura ------------------------------------
	if bot.health.current < bot.health.max_health * 0.5 and randf() < prof.cover_usage * 0.6:
		brain.change_state(&"cover", {"reason": "hurt"})
		return

	# --- Trocar de posição -------------------------------------------------
	if now() >= _reposition_at:
		_reposition_at = now() + prof.reposition_interval * randf_range(0.7, 1.3)
		if randf() < prof.cover_usage:
			brain.change_state(&"cover", {"reason": "reposition"})
			return
		var side := _lateral_point(target.global_position, randf_range(5.0, 9.0))
		bot.move_to(side, true)
		return

	# --- Distância ideal para a arma ---------------------------------------
	var pref := bot.combat.preferred_range()
	if dist > pref * 1.4:
		bot.move_to(bot.map_data.snap(target.global_position), prof.aggression > 0.5)
		return

	# --- Movimentação em combate (strafe / agachar) ------------------------
	if now() >= _next_strafe:
		_next_strafe = now() + randf_range(0.8, 1.8)
		if randf() < prof.strafe_skill:
			bot.move_to(_lateral_point(target.global_position, randf_range(1.5, 3.5)), false)
			bot.set_crouch(false)
		else:
			bot.stop_moving()
			# Bots habilidosos agacham às vezes quando param.
			if randf() < prof.strafe_skill * 0.5:
				bot.set_crouch(true)
				_crouch_until = now() + randf_range(0.8, 1.6)
	if bot.is_crouching and now() > _crouch_until:
		bot.set_crouch(false)


## Ponto para o lado (perpendicular à linha até o alvo).
func _lateral_point(target_pos: Vector3, distance: float) -> Vector3:
	var to := target_pos - bot.global_position
	to.y = 0.0
	var right := to.normalized().cross(Vector3.UP)
	var side := 1.0 if randf() < 0.5 else -1.0
	return bot.map_data.snap(bot.global_position + right * side * distance)
