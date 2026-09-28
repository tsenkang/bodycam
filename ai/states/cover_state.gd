class_name CoverState
extends BotState
## Corre para uma cobertura escondida da ameaça, agacha, recarrega e depois
## volta a "espiar" (combate). Se for flanqueado na cobertura, reage.

enum Phase { MOVING, HIDING }

var _phase := Phase.MOVING
var _hide_until := 0.0
var _threat := Vector3.ZERO
var _timeout := 0.0


func _init() -> void:
	handles_enemy = true


func enter(params: Dictionary) -> void:
	var p := perception()
	_threat = p.last_known_position
	var point = CoverFinder.find(bot, bot.map_data, _threat)
	if point == null:
		# Sem cobertura por perto: recarrega no lugar e continua lutando.
		if params.get("reason", "") == "reload":
			bot.combat.start_reload()
		brain.change_state(&"combat")
		return
	_phase = Phase.MOVING
	_timeout = now() + 6.0
	bot.set_crouch(false)
	bot.combat.allow_fire = true
	bot.move_to(point, true)


func exit() -> void:
	bot.set_crouch(false)
	bot.combat.allow_fire = true


func update(_delta: float) -> void:
	var p := perception()
	if p.target_visible and p.has_target():
		bot.look_at_point(p.target.get_chest_position())
	elif _phase == Phase.HIDING:
		bot.look_at_point(_threat + Vector3.UP * 1.3)
	else:
		bot.clear_look()


func think() -> void:
	var p := perception()
	match _phase:
		Phase.MOVING:
			if bot.has_arrived() or now() > _timeout:
				_phase = Phase.HIDING
				bot.stop_moving()
				bot.set_crouch(true)
				bot.combat.allow_fire = false
				if bot.combat.should_top_up():
					bot.combat.start_reload()
				_hide_until = now() + randf_range(1.2, 2.6)
		Phase.HIDING:
			# Foi visto mesmo agachado (flanqueado): volta a lutar.
			if p.target_visible and not bot.combat.reloading:
				brain.change_state(&"combat")
				return
			if now() >= _hide_until and not bot.combat.reloading:
				# "Espia": levanta e volta ao combate / procura.
				if p.has_target():
					brain.change_state(&"combat" if p.time_since_seen() < 4.0 else &"search")
				else:
					brain.change_state(&"patrol")
