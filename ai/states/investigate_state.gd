class_name InvestigateState
extends BotState
## Vai até um som (tiro, passos, aviso de aliado) e depois procura por perto.

var _pos := Vector3.ZERO
var _timeout := 0.0


func enter(params: Dictionary) -> void:
	_pos = bot.map_data.snap(params.get("position", bot.global_position))
	perception().has_noise = false
	_timeout = now() + 12.0
	bot.combat.allow_fire = true
	bot.set_crouch(false)
	bot.clear_look()
	bot.move_to(_pos, randf() < 0.3 + profile().aggression * 0.6)


func think() -> void:
	var p := perception()
	if p.has_noise:
		# Novo som: atualiza o destino.
		_pos = bot.map_data.snap(p.noise_position)
		p.has_noise = false
		bot.move_to(_pos, true)
	if bot.has_arrived() or now() > _timeout:
		brain.change_state(&"search", {"center": _pos, "duration": profile().search_time * 0.6})
