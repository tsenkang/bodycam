class_name MP4
extends Weapon
## MP4 — submetralhadora automática inicial.
## Boa cadência, dano moderado, ótima em curta/média distância.
## Usa todo o comportamento padrão da classe Weapon; só ajusta o padrão de
## recuo para ficar mais controlável depois dos primeiros tiros.


func _init() -> void:
	weapon_id = &"mp4"


func _compute_recoil(shot_index: int) -> Vector2:
	var r := super(shot_index)
	# Os 3 primeiros tiros sobem um pouco mais; depois estabiliza.
	if shot_index <= 3:
		r.x *= 1.2
	return r
