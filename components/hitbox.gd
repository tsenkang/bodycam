class_name Hitbox
extends Area3D
## Região do corpo que recebe dano (cabeça, tronco, braços, pernas).
## Os raios dos disparos detectam estas áreas (camada HITBOX).

var region: StringName = &"torso"
var health: Health
## Dono da hitbox (Player ou Bot) — usado para checar equipe.
var actor: Node


func _init() -> void:
	collision_layer = Layers.HITBOX
	collision_mask = 0
	monitoring = false
	monitorable = true


## Aplica um impacto. Retorna { applied: bool, killed: bool }.
func apply_hit(base_damage: float, attacker: Node, weapon_name: String) -> Dictionary:
	if health == null or health.is_dead():
		return {"applied": false, "killed": false}
	if attacker and attacker != actor and not GameConfig.friendly_fire:
		if "team" in attacker and "team" in actor and attacker.team == actor.team:
			return {"applied": false, "killed": false}
	var mult: float = GameConfig.damage_multipliers.get(region, 1.0)
	if actor and actor.has_method("set_last_hit_weapon"):
		actor.set_last_hit_weapon(weapon_name)
	var killed := health.take_damage(base_damage * mult, attacker, region)
	Events.hit_confirmed.emit(attacker, killed, region == &"head")
	return {"applied": true, "killed": killed}
