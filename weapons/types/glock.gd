class_name Glock
extends Weapon
## Pistola semiautomática inicial (nome exibido "GL-9" no config).
## Menor dano, troca rápida, boa mobilidade. O ferrolho recua a cada tiro
## e fica travado aberto quando o carregador esvazia.


func _init() -> void:
	weapon_id = &"glock"


func _on_fired() -> void:
	_action_anim = 1.0


func _animate_parts(_delta: float) -> void:
	var slide: Node3D = _parts.get("slide")
	if slide == null:
		return
	var back := 0.035 if ammo_in_mag == 0 else 0.035 * ease(_action_anim, 0.3)
	slide.position.z = back
