class_name AK47
extends Weapon
## AK-47 — fuzil automático. Dano alto, recuo forte e mais difícil de
## controlar: o recuo vertical cresce durante a rajada e "puxa" para a
## direita e depois para a esquerda.


func _init() -> void:
	weapon_id = &"ak47"


func _compute_recoil(shot_index: int) -> Vector2:
	var r := super(shot_index)
	var climb := 1.0 + minf(float(shot_index), 10.0) * 0.06
	r.x *= climb
	# Deriva horizontal: direita nos primeiros tiros, esquerda depois.
	var drift := 0.35 if shot_index < 8 else -0.45
	r.y += drift * data.recoil_horizontal
	return r
