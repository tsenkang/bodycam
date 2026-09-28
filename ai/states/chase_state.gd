class_name ChaseState
extends BotState
## Persegue o inimigo até a última posição conhecida (bots melhores
## "preveem" para onde ele foi). Bots fáceis desistem depois de uma
## distância curta (não perseguem pelo mapa inteiro).

var _start := Vector3.ZERO
var _goal := Vector3.ZERO
var _timeout := 0.0


func enter(_params: Dictionary) -> void:
	var p := perception()
	_start = bot.global_position
	var predicted := p.last_known_position + p.last_known_velocity * profile().prediction
	_goal = bot.map_data.snap(predicted)
	_timeout = now() + 10.0
	bot.combat.allow_fire = true
	bot.set_crouch(false)
	bot.clear_look()
	bot.move_to(_goal, true)


func think() -> void:
	if bot.global_position.distance_to(_start) > profile().max_chase_distance:
		brain.change_state(&"search", {"duration": profile().search_time * 0.5})
		return
	if bot.has_arrived() or now() > _timeout:
		brain.change_state(&"search")
