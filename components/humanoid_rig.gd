class_name HumanoidRig
extends Node3D
## Corpo humanoide PLACEHOLDER montado com formas simples + hitboxes.
## Usado pelos bots (visível) e pelo jogador (só hitboxes, sem malha).
##
## Para usar um modelo real: substitua os MeshInstance3D criados em
## _add_part() por um .glb e mantenha as hitboxes nas mesmas regiões.

const CROUCH_DROP := 0.55

static var _materials := {}

var hitboxes: Array[Hitbox] = []
var upper: Node3D          # tronco, cabeça, braços, arma (desce ao agachar)
var legs: Node3D
var muzzle: Node3D
var _flash_light: OmniLight3D
var _flash_mesh: MeshInstance3D
var _flash_time := 0.0
var _with_visuals := true
var _crouch := 0.0
var _death_tween: Tween


func build(actor: Node, health: Health, team_color: Color, with_visuals: bool) -> void:
	_with_visuals = with_visuals
	upper = Node3D.new()
	upper.name = "Upper"
	add_child(upper)
	legs = Node3D.new()
	legs.name = "Legs"
	add_child(legs)

	var skin := _mat(Color(0.55, 0.45, 0.38))
	var vest := _mat(team_color)
	var cloth := _mat(team_color.darkened(0.55))
	var pants := _mat(Color(0.16, 0.17, 0.16))
	var metal := _mat(Color(0.08, 0.08, 0.08))

	# Cabeça (capacete com a cor da equipe por cima).
	_add_part(upper, &"head", Vector3(0, 1.62, 0), Vector3.ZERO, Vector3(0.26, 0.26, 0.26), skin, actor, health, true)
	if with_visuals:
		var helmet := _mesh_box(Vector3(0.29, 0.12, 0.3), cloth)
		helmet.position = Vector3(0, 1.73, 0.0)
		upper.add_child(helmet)
	# Tronco.
	_add_part(upper, &"torso", Vector3(0, 1.19, 0), Vector3.ZERO, Vector3(0.46, 0.62, 0.28), vest, actor, health)
	# Braços apontando para frente (segurando a arma).
	for side in [-1.0, 1.0]:
		var shoulder := Node3D.new()
		shoulder.position = Vector3(0.27 * side, 1.44, 0)
		shoulder.rotation = Vector3(deg_to_rad(-62.0), deg_to_rad(-12.0 * side), 0)
		upper.add_child(shoulder)
		_add_part(shoulder, &"arms", Vector3(0, -0.3, 0), Vector3.ZERO, Vector3(0.12, 0.6, 0.13), cloth, actor, health)
	# Pernas.
	for side in [-1.0, 1.0]:
		_add_part(legs, &"legs", Vector3(0.12 * side, 0.44, 0), Vector3.ZERO, Vector3(0.17, 0.86, 0.19), pants, actor, health)

	# Arma (visual) e ponto do cano.
	var gun := Node3D.new()
	gun.position = Vector3(0.05, 1.3, -0.42)
	upper.add_child(gun)
	if with_visuals:
		var body := _mesh_box(Vector3(0.07, 0.1, 0.62), metal)
		gun.add_child(body)
		var mag := _mesh_box(Vector3(0.05, 0.16, 0.07), metal)
		mag.position = Vector3(0, -0.11, -0.08)
		gun.add_child(mag)
	muzzle = Node3D.new()
	muzzle.position = Vector3(0, 0.02, -0.34)
	gun.add_child(muzzle)
	if with_visuals:
		_flash_light = OmniLight3D.new()
		_flash_light.light_color = Color(1.0, 0.75, 0.4)
		_flash_light.omni_range = 5.0
		_flash_light.light_energy = 0.0
		_flash_light.shadow_enabled = false
		muzzle.add_child(_flash_light)
		_flash_mesh = MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.07
		sm.height = 0.14
		_flash_mesh.mesh = sm
		_flash_mesh.material_override = _emissive_mat()
		_flash_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_flash_mesh.visible = false
		muzzle.add_child(_flash_mesh)
	set_process(false)


func get_hitbox_rids() -> Array[RID]:
	var rids: Array[RID] = []
	for h in hitboxes:
		rids.append(h.get_rid())
	return rids


func set_hitboxes_enabled(enabled: bool) -> void:
	for h in hitboxes:
		h.collision_layer = Layers.HITBOX if enabled else 0


func set_crouch_amount(amount: float) -> void:
	_crouch = amount
	upper.position.y = -CROUCH_DROP * amount


func flash_muzzle() -> void:
	if _flash_light == null:
		return
	_flash_light.light_energy = 2.5
	_flash_mesh.visible = true
	_flash_mesh.rotation.z = randf() * TAU
	_flash_time = 0.05
	set_process(true)


func _process(delta: float) -> void:
	_flash_time -= delta
	if _flash_time <= 0.0:
		_flash_light.light_energy = 0.0
		_flash_mesh.visible = false
		set_process(false)


## Queda simples ao morrer (sem violência gráfica).
func play_death() -> void:
	set_hitboxes_enabled(false)
	if _death_tween:
		_death_tween.kill()
	_death_tween = create_tween()
	var side := -1.0 if randf() < 0.5 else 1.0
	_death_tween.tween_property(self, "rotation", Vector3(deg_to_rad(-80.0), 0, deg_to_rad(10.0 * side)), 0.45) \
		.set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	_death_tween.parallel().tween_property(self, "position:y", 0.15, 0.45)


func reset_pose() -> void:
	if _death_tween:
		_death_tween.kill()
	rotation = Vector3.ZERO
	position = Vector3.ZERO
	visible = true
	set_crouch_amount(0.0)
	set_hitboxes_enabled(true)


# ---------------------------------------------------------------------------
func _add_part(parent: Node3D, region: StringName, pos: Vector3, rot: Vector3, size: Vector3,
		mat: Material, actor: Node, health: Health, sphere := false) -> void:
	var hb := Hitbox.new()
	hb.region = region
	hb.health = health
	hb.actor = actor
	hb.position = pos
	hb.rotation = rot
	var cs := CollisionShape3D.new()
	if sphere:
		var s := SphereShape3D.new()
		s.radius = size.x * 0.5
		cs.shape = s
	else:
		var b := BoxShape3D.new()
		b.size = size
		cs.shape = b
	hb.add_child(cs)
	parent.add_child(hb)
	hitboxes.append(hb)
	if _with_visuals:
		var mi: MeshInstance3D
		if sphere:
			mi = MeshInstance3D.new()
			mi.layers = DecalBuilder.CHARACTER_LAYER
			var sm := SphereMesh.new()
			sm.radius = size.x * 0.5
			sm.height = size.x
			mi.mesh = sm
			mi.material_override = mat
		else:
			mi = _mesh_box(size, mat)
		hb.add_child(mi)


func _mesh_box(size: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.layers = DecalBuilder.CHARACTER_LAYER
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	return mi


static func _mat(color: Color) -> StandardMaterial3D:
	var key := color.to_html()
	if _materials.has(key):
		return _materials[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.85
	_materials[key] = m
	return m


static func _emissive_mat() -> StandardMaterial3D:
	if _materials.has("flash"):
		return _materials["flash"]
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(1.0, 0.8, 0.45)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color.a = 0.85
	_materials["flash"] = m
	return m
