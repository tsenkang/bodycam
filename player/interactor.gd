class_name Interactor
extends RefCounted
## Detecta objetos interativos na frente da câmera (portas, armários de arma).
## Um objeto é interativo se ele (ou um nó pai próximo) tiver os métodos:
##   get_interaction_text(actor) -> String   e   interact(actor)

var actor: Node3D
var camera: Camera3D
var current: Object = null
var _text := ""


func _init(p_actor: Node3D, p_camera: Camera3D) -> void:
	actor = p_actor
	camera = p_camera


func tick() -> void:
	var found: Object = null
	var text := ""
	if actor.is_alive():
		var from := camera.global_position
		var to := from - camera.global_basis.z * GameConfig.interaction_distance
		var q := PhysicsRayQueryParameters3D.create(from, to, Layers.WORLD)
		var hit := actor.get_world_3d().direct_space_state.intersect_ray(q)
		if not hit.is_empty():
			found = _find_interactable(hit.collider)
			if found:
				text = found.get_interaction_text(actor)
	current = found if text != "" else null
	if text != _text:
		_text = text
		Events.interaction_prompt.emit(text)


func try_interact() -> void:
	if current and is_instance_valid(current):
		current.interact(actor)
		_text = "__refresh__"  # força atualizar o texto no próximo tick


func clear() -> void:
	current = null
	if _text != "":
		_text = ""
		Events.interaction_prompt.emit("")


static func _find_interactable(node: Object) -> Object:
	var n := node as Node
	for i in 4:
		if n == null:
			return null
		if n.has_method("interact") and n.has_method("get_interaction_text"):
			return n
		n = n.get_parent()
	return null
