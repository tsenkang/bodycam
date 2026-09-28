class_name Door
extends Node3D
## Porta que abre/fecha girando na dobradiça.
## - Jogador: tecla de interação (E).
## - Bots: abrem sozinhos quando chegam perto (não travam na porta).
## A porta NÃO faz parte da navmesh, então a IA planeja rotas pela passagem.

const OPEN_ANGLE := deg_to_rad(100.0)
const SWING_SPEED := 3.5
const BOT_OPEN_DISTANCE := 1.9

var width := 1.4
var height := 2.3
var is_open := false

var _hinge: Node3D
var _panel: AnimatableBody3D
var _angle := 0.0
var _target := 0.0
var _check_timer := 0.0


## axis_along: direção da parede (Vector3.RIGHT ou Vector3.BACK).
## hinge_pos: posição da dobradiça (chão, em uma ponta da abertura).
func setup(hinge_pos: Vector3, axis_along: Vector3, p_width: float, mat: Material) -> void:
	width = p_width
	position = hinge_pos
	# Gira o nó para que +X local aponte ao longo da parede.
	rotation.y = atan2(-axis_along.z, axis_along.x)
	_hinge = Node3D.new()
	add_child(_hinge)
	_panel = AnimatableBody3D.new()
	_panel.collision_layer = Layers.WORLD
	_panel.collision_mask = 0
	_panel.sync_to_physics = true
	_panel.position = Vector3(width * 0.5, height * 0.5, 0.0)
	_hinge.add_child(_panel)
	var size := Vector3(width - 0.04, height, 0.06)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	_panel.add_child(mi)
	var handle := MeshInstance3D.new()
	var hm := BoxMesh.new()
	hm.size = Vector3(0.12, 0.03, 0.14)
	handle.mesh = hm
	handle.position = Vector3(width * 0.36, -0.1, 0.0)
	_panel.add_child(handle)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	_panel.add_child(cs)
	set_physics_process(false)


func _process(delta: float) -> void:
	# Checagem barata a cada 0,25 s: algum bot vivo encostou na porta fechada?
	_check_timer -= delta
	if _check_timer > 0.0 or is_open:
		return
	_check_timer = 0.25
	var center := _center()
	for bot in get_tree().get_nodes_in_group("bots"):
		if bot.is_alive() and bot.global_position.distance_to(center) < BOT_OPEN_DISTANCE:
			open_away_from(bot.global_position)
			return


func _physics_process(delta: float) -> void:
	_angle = move_toward(_angle, _target, SWING_SPEED * delta)
	_hinge.rotation.y = _angle
	if is_equal_approx(_angle, _target):
		set_physics_process(false)


func get_interaction_text(_actor: Node) -> String:
	return "[E] Fechar porta" if is_open else "[E] Abrir porta"


func interact(actor: Node3D) -> void:
	if is_open:
		close()
	else:
		open_away_from(actor.global_position)


func open_away_from(pos: Vector3) -> void:
	# Abre para o lado oposto de quem está abrindo.
	var local := to_local(pos)
	_target = -OPEN_ANGLE if local.z < 0.0 else OPEN_ANGLE
	is_open = true
	AudioManager.play_at("door", _center(), -6.0)
	set_physics_process(true)


func close() -> void:
	_target = 0.0
	is_open = false
	AudioManager.play_at("door", _center(), -6.0)
	set_physics_process(true)


func _center() -> Vector3:
	return global_transform * Vector3(width * 0.5, 1.0, 0.0)
