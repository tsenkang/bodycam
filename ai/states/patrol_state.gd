class_name PatrolState
extends BotState
## Anda pelo mapa entre pontos de patrulha. Bots agressivos (difícil)
## tendem a ir na direção dos inimigos para manter o combate frequente.

var _wait_until := 0.0
var _moving := false


func enter(_params: Dictionary) -> void:
	bot.combat.allow_fire = true
	bot.set_crouch(false)
	bot.clear_look()
	_pick_next()


func think() -> void:
	var p := perception()
	if p.has_noise:
		brain.change_state(&"investigate", {"position": p.noise_position})
		return
	if p.has_target() and p.time_since_seen() < 3.0:
		brain.change_state(&"chase")
		return
	if bot.combat.should_top_up():
		bot.combat.start_reload()
	if _moving and bot.has_arrived():
		_moving = false
		_wait_until = now() + randf_range(0.3, 1.6) * (1.2 - profile().aggression)
		bot.look_at_point(bot.map_data.random_point_near(bot.global_position, 12.0) + Vector3.UP * 1.5)
	elif not _moving and now() >= _wait_until:
		bot.clear_look()
		_pick_next()


func _pick_next() -> void:
	var points := bot.map_data.patrol_points
	if points.is_empty():
		return
	var target := points[randi() % points.size()]
	# Agressividade: às vezes vai para perto de um inimigo (sem "saber" onde
	# exatamente está — escolhe o ponto de patrulha mais próximo dele).
	if randf() < profile().aggression * 0.6:
		var enemy := bot.get_random_enemy()
		if enemy:
			var best_d := INF
			for pt in points:
				var d := pt.distance_squared_to(enemy.global_position) + randf() * 60.0
				if d < best_d:
					best_d = d
					target = pt
	var run := randf() < 0.25 + profile().aggression * 0.6
	bot.move_to(target, run)
	_moving = true
