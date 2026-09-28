class_name SearchState
extends BotState
## Procura o inimigo perdido: visita pontos ao redor da última posição
## conhecida e olha em volta. Depois do tempo limite, volta a patrulhar.

var _end_time := 0.0
var _center := Vector3.ZERO
var _wait_until := 0.0
var _moving := false


func enter(params: Dictionary) -> void:
	var p := perception()
	_center = params.get("center", p.last_known_position)
	_end_time = now() + float(params.get("duration", profile().search_time))
	bot.combat.allow_fire = true
	bot.set_crouch(false)
	_go_next()


func think() -> void:
	var p := perception()
	if now() > _end_time:
		p.target = null
		brain.change_state(&"patrol")
		return
	if p.has_noise:
		brain.change_state(&"investigate", {"position": p.noise_position})
		return
	if bot.combat.should_top_up():
		bot.combat.start_reload()
	if _moving and bot.has_arrived():
		_moving = false
		_wait_until = now() + randf_range(0.5, 1.3)
		# Olha para uma direção aleatória (checando os cantos).
		bot.look_at_point(bot.map_data.random_point_near(bot.global_position, 8.0) + Vector3.UP * 1.4)
	elif not _moving and now() >= _wait_until:
		_go_next()


func _go_next() -> void:
	bot.clear_look()
	bot.move_to(bot.map_data.random_point_near(_center, 9.0), false)
	_moving = true
