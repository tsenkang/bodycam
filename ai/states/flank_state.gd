class_name FlankState
extends BotState
## Flanqueia: em vez de ir direto, dá a volta por um dos lados da última
## posição do inimigo e ataca de outro ângulo.

var _timeout := 0.0


func enter(_params: Dictionary) -> void:
	var p := perception()
	var target := p.last_known_position
	var to := target - bot.global_position
	to.y = 0.0
	var dir := to.normalized()
	var right := dir.cross(Vector3.UP)
	var best := Vector3.ZERO
	var found := false
	var side := 1.0 if randf() < 0.5 else -1.0
	for attempt in 2:
		var candidate := target + right * side * randf_range(8.0, 12.0) - dir * 2.0
		var snapped := bot.map_data.snap(candidate)
		if snapped.distance_to(candidate) < 3.0:
			best = snapped
			found = true
			break
		side = -side
	if not found:
		brain.change_state(&"chase")
		return
	_timeout = now() + 9.0
	bot.combat.allow_fire = true
	bot.set_crouch(false)
	bot.clear_look()
	bot.move_to(best, true)


func think() -> void:
	if bot.has_arrived() or now() > _timeout:
		brain.change_state(&"chase")
