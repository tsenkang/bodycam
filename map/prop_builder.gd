class_name PropBuilder
extends RefCounted
## ============================================================================
##  Objetos de cenário (props) procedurais: carros, postes, caçambas, barris,
##  pallets, árvores, bancos, lixeiras, cones, luminárias, sinalização,
##  molduras de janela/porta e prédios de fundo.
##
##  - Objetos com colisão vão em "geo" (entram na navmesh = obstáculos).
##  - Objetos só visuais vão em "detail" (não atrapalham a navegação).
##  Tudo é placeholder de boa qualidade: para arte final, troque as malhas
##  por modelos .glb mantendo posição e colisão.
## ============================================================================

var geo: Node3D
var detail: Node3D
var data: MapData
var street_lights := true
var interior_light_energy := 1.0
var light_color := Color(1.0, 0.82, 0.6)


func _init(p_geo: Node3D, p_detail: Node3D, p_data: MapData) -> void:
	geo = p_geo
	detail = p_detail
	data = p_data


# ============================================================================
#  Primitivas
# ============================================================================
func vbox(parent: Node3D, center: Vector3, size: Vector3, mat: Material, rot_y := 0.0, shadows := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = center
	mi.rotation.y = rot_y
	if not shadows:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


func vcyl(parent: Node3D, center: Vector3, radius: float, height: float, mat: Material, top_radius := -1.0, segments := 16) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.bottom_radius = radius
	cm.top_radius = radius if top_radius < 0.0 else top_radius
	cm.height = height
	cm.radial_segments = segments
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = mat
	mi.position = center
	parent.add_child(mi)
	return mi


func vsphere(parent: Node3D, center: Vector3, radius: float, mat: Material, squash := 1.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = radius
	sm.height = radius * 2.0 * squash
	sm.radial_segments = 12
	sm.rings = 6
	mi.mesh = sm
	mi.material_override = mat
	mi.position = center
	parent.add_child(mi)
	return mi


## Corpo estático só com colisão (o visual é montado à parte).
func collider(center: Vector3, size: Vector3, rot_y := 0.0) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.collision_layer = Layers.WORLD
	body.collision_mask = 0
	body.position = center
	body.rotation.y = rot_y
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	body.add_child(cs)
	geo.add_child(body)
	return body


func cyl_collider(center: Vector3, radius: float, height: float) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.collision_layer = Layers.WORLD
	body.collision_mask = 0
	body.position = center
	var cs := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = radius
	shape.height = height
	cs.shape = shape
	body.add_child(cs)
	geo.add_child(body)
	return body


## Plano no chão (calçada, piso, faixa pintada) — só visual.
func ground_plane(center: Vector3, size: Vector2, mat: Material, rot_y := 0.0) -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = size
	mi.mesh = pm
	mi.material_override = mat
	mi.position = center
	mi.rotation.y = rot_y
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	detail.add_child(mi)


# ============================================================================
#  Veículos
# ============================================================================
## Carro de passeio. Retorna o tamanho da colisão (para pontos de cobertura).
func car(center: Vector3, yaw: float, color: Color) -> Vector3:
	var root := Node3D.new()
	root.position = center
	root.rotation.y = yaw
	detail.add_child(root)
	var paint := MapMaterials.car_paint(color)
	var dark := MapMaterials.plain(Color(0.05, 0.05, 0.05), 0.6)
	var chrome := MapMaterials.plain(Color(0.7, 0.7, 0.72), 0.25, 0.9)
	# Carroceria (comprimento em X).
	vbox(root, Vector3(0, 0.62, 0), Vector3(4.3, 0.62, 1.8), paint)
	vbox(root, Vector3(1.55, 0.95, 0), Vector3(1.1, 0.08, 1.74), paint)   # capô
	vbox(root, Vector3(-1.7, 0.95, 0), Vector3(0.8, 0.08, 1.74), paint)   # porta-malas
	vbox(root, Vector3(-0.2, 1.22, 0), Vector3(2.2, 0.55, 1.62), MapMaterials.glass())
	vbox(root, Vector3(-0.25, 1.52, 0), Vector3(1.9, 0.07, 1.58), paint)  # teto
	for pillar_x in [0.85, -1.25]:
		for side in [-0.79, 0.79]:
			vbox(root, Vector3(pillar_x, 1.22, side), Vector3(0.12, 0.56, 0.06), paint)
	vbox(root, Vector3(2.17, 0.45, 0), Vector3(0.12, 0.3, 1.82), dark)    # para-choques
	vbox(root, Vector3(-2.17, 0.45, 0), Vector3(0.12, 0.3, 1.82), dark)
	vbox(root, Vector3(2.2, 0.72, 0), Vector3(0.05, 0.14, 1.2), dark)     # grade
	for side in [-0.68, 0.68]:
		vbox(root, Vector3(2.21, 0.74, side), Vector3(0.04, 0.12, 0.32), MapMaterials.emissive(Color(1, 0.95, 0.85), 0.6))
		vbox(root, Vector3(-2.21, 0.78, side), Vector3(0.04, 0.12, 0.3), MapMaterials.emissive(Color(0.8, 0.05, 0.03), 0.8))
		vbox(root, Vector3(0.7, 1.02, side * 1.34), Vector3(0.1, 0.08, 0.12), dark)  # retrovisores
	for w in [Vector2(1.35, 0.9), Vector2(-1.35, 0.9), Vector2(1.35, -0.9), Vector2(-1.35, -0.9)]:
		var tire := vcyl(root, Vector3(w.x, 0.34, w.y), 0.34, 0.24, dark)
		tire.rotation.x = PI * 0.5
		var rim := vcyl(root, Vector3(w.x, 0.34, w.y * 1.02), 0.2, 0.22, chrome)
		rim.rotation.x = PI * 0.5
	var size := Vector3(4.4, 1.3, 1.85)
	collider(center + Vector3(0, 0.75, 0), size, yaw)
	return size


## Caminhão/baú (cobertura grande).
func box_truck(center: Vector3, yaw: float, cab_color: Color) -> void:
	var root := Node3D.new()
	root.position = center
	root.rotation.y = yaw
	detail.add_child(root)
	var dark := MapMaterials.plain(Color(0.05, 0.05, 0.05), 0.6)
	vbox(root, Vector3(-0.7, 1.75, 0), Vector3(5.3, 2.5, 2.4), MapMaterials.get_material("corrugated", Color(0.85, 0.86, 0.84)))
	vbox(root, Vector3(0.1, 0.42, 0), Vector3(7.2, 0.25, 1.9), dark)
	vbox(root, Vector3(2.9, 1.25, 0), Vector3(1.7, 1.9, 2.3), MapMaterials.car_paint(cab_color))
	vbox(root, Vector3(3.62, 1.65, 0), Vector3(0.3, 0.75, 2.1), MapMaterials.glass())
	for x in [-2.4, -1.2, 2.9]:
		for z in [-1.0, 1.0]:
			var tire := vcyl(root, Vector3(x, 0.45, z), 0.45, 0.3, dark)
			tire.rotation.x = PI * 0.5
	collider(center + Basis(Vector3.UP, yaw) * Vector3(-0.7, 1.5, 0), Vector3(5.3, 3.0, 2.4), yaw)
	collider(center + Basis(Vector3.UP, yaw) * Vector3(2.9, 1.2, 0), Vector3(1.7, 2.4, 2.3), yaw)


# ============================================================================
#  Mobiliário urbano
# ============================================================================
func lamp_post(base: Vector3, yaw: float) -> void:
	var metal := MapMaterials.plain(Color(0.18, 0.19, 0.2), 0.5, 0.6)
	vcyl(detail, base + Vector3(0, 2.9, 0), 0.08, 5.8, metal, 0.06, 10)
	vcyl(detail, base + Vector3(0, 0.3, 0), 0.14, 0.6, metal, -1.0, 10)
	var dir := Basis(Vector3.UP, yaw) * Vector3(0, 0, -1)
	vbox(detail, base + Vector3(0, 5.75, 0) + dir * 0.6, Vector3(0.08, 0.08, 1.3), metal, yaw)
	var head_pos := base + Vector3(0, 5.65, 0) + dir * 1.2
	vbox(detail, head_pos, Vector3(0.35, 0.14, 0.6), metal, yaw)
	vbox(detail, head_pos - Vector3(0, 0.08, 0), Vector3(0.28, 0.02, 0.5),
		MapMaterials.emissive(light_color, 4.0 if street_lights else 0.0), yaw, false)
	cyl_collider(base + Vector3(0, 2.9, 0), 0.1, 5.8)
	if street_lights:
		var spot := SpotLight3D.new()
		spot.position = head_pos - Vector3(0, 0.1, 0)
		spot.rotation.x = -PI * 0.5
		spot.light_color = light_color
		spot.light_energy = 5.0
		spot.spot_range = 13.0
		spot.spot_angle = 58.0
		spot.spot_attenuation = 0.8
		spot.shadow_enabled = false
		detail.add_child(spot)


func trash_bin(base: Vector3) -> void:
	var mat := MapMaterials.plain(Color(0.2, 0.28, 0.22), 0.6, 0.3)
	vcyl(detail, base + Vector3(0, 0.45, 0), 0.28, 0.9, mat, 0.3, 14)
	vcyl(detail, base + Vector3(0, 0.92, 0), 0.31, 0.05, MapMaterials.plain(Color(0.1, 0.1, 0.1), 0.5), -1.0, 14)
	cyl_collider(base + Vector3(0, 0.45, 0), 0.3, 0.9)


func dumpster(base: Vector3, yaw: float, color := Color(0.16, 0.3, 0.2)) -> Vector3:
	var root := Node3D.new()
	root.position = base
	root.rotation.y = yaw
	detail.add_child(root)
	var body := MapMaterials.get_material("metal", color)
	vbox(root, Vector3(0, 0.72, 0), Vector3(2.0, 1.1, 1.25), body)
	vbox(root, Vector3(0, 1.3, -0.05), Vector3(2.02, 0.06, 1.3), MapMaterials.plain(Color(0.08, 0.08, 0.08), 0.7), 0.0)
	for x in [-0.8, 0.8]:
		for z in [-0.5, 0.5]:
			vcyl(root, Vector3(x, 0.09, z), 0.08, 0.18, MapMaterials.plain(Color(0.05, 0.05, 0.05)))
	var size := Vector3(2.0, 1.35, 1.25)
	collider(base + Vector3(0, 0.68, 0), size, yaw)
	return size


func barrel(base: Vector3, color: Color) -> void:
	var mat := MapMaterials.get_material("metal", color)
	vcyl(detail, base + Vector3(0, 0.45, 0), 0.3, 0.9, mat, -1.0, 16)
	for y in [0.2, 0.7]:
		vcyl(detail, base + Vector3(0, y, 0), 0.31, 0.04, MapMaterials.plain(color.darkened(0.4), 0.6, 0.4), -1.0, 16)
	cyl_collider(base + Vector3(0, 0.45, 0), 0.3, 0.9)


## Pallet com caixas de papelão. Retorna o tamanho (para cobertura).
func pallet_stack(base: Vector3, yaw: float, layers := 2) -> Vector3:
	var root := Node3D.new()
	root.position = base
	root.rotation.y = yaw
	detail.add_child(root)
	var wood := MapMaterials.get_material("wood", Color(0.95, 0.9, 0.8))
	vbox(root, Vector3(0, 0.07, 0), Vector3(1.2, 0.14, 1.0), wood)
	var card := MapMaterials.get_material("cardboard")
	for layer in layers:
		for ix in 2:
			for iz in 2:
				var jitter := Vector3(randf_range(-0.02, 0.02), 0, randf_range(-0.02, 0.02))
				vbox(root, Vector3(-0.29 + ix * 0.58, 0.14 + 0.25 + layer * 0.5, -0.24 + iz * 0.48) + jitter,
					Vector3(0.55, 0.49, 0.46), card, randf_range(-0.05, 0.05))
	var h := 0.14 + layers * 0.5
	var size := Vector3(1.2, h, 1.0)
	collider(base + Vector3(0, h * 0.5, 0), size, yaw)
	return size


func cone(base: Vector3) -> void:
	vcyl(detail, base + Vector3(0, 0.25, 0), 0.14, 0.5, MapMaterials.plain(Color(0.95, 0.35, 0.05), 0.6), 0.025, 12)
	vcyl(detail, base + Vector3(0, 0.3, 0), 0.085, 0.08, MapMaterials.plain(Color(0.95, 0.95, 0.95), 0.5), 0.07, 12)
	vbox(detail, base + Vector3(0, 0.015, 0), Vector3(0.34, 0.03, 0.34), MapMaterials.plain(Color(0.1, 0.1, 0.1)))


func bench(base: Vector3, yaw: float) -> void:
	var root := Node3D.new()
	root.position = base
	root.rotation.y = yaw
	detail.add_child(root)
	var wood := MapMaterials.get_material("wood")
	var metal := MapMaterials.plain(Color(0.15, 0.15, 0.15), 0.5, 0.6)
	vbox(root, Vector3(0, 0.45, 0), Vector3(1.8, 0.06, 0.45), wood)
	vbox(root, Vector3(0, 0.8, 0.2), Vector3(1.8, 0.35, 0.05), wood)
	for x in [-0.8, 0.8]:
		vbox(root, Vector3(x, 0.22, 0), Vector3(0.06, 0.44, 0.45), metal)


func tree(base: Vector3, scale := 1.0) -> void:
	var bark := MapMaterials.plain(Color(0.25, 0.19, 0.14), 0.95)
	var leaves := MapMaterials.plain(Color(0.2, 0.3, 0.16), 0.9)
	var leaves2 := MapMaterials.plain(Color(0.16, 0.25, 0.13), 0.9)
	vcyl(detail, base + Vector3(0, 1.6 * scale, 0), 0.16 * scale, 3.2 * scale, bark, 0.11 * scale, 10)
	vsphere(detail, base + Vector3(0, 3.6 * scale, 0), 1.5 * scale, leaves, 0.8)
	vsphere(detail, base + Vector3(0.7, 3.2, 0.3) * scale, 1.0 * scale, leaves2, 0.8)
	vsphere(detail, base + Vector3(-0.6, 3.3, -0.4) * scale, 1.1 * scale, leaves2, 0.8)
	cyl_collider(base + Vector3(0, 1.6 * scale, 0), 0.18 * scale, 3.2 * scale)
	# Grade de proteção da árvore.
	vbox(detail, base + Vector3(0, 0.02, 0), Vector3(1.4, 0.04, 1.4), MapMaterials.plain(Color(0.12, 0.12, 0.12), 0.7, 0.5))


func shrub(center: Vector3, size: Vector3) -> void:
	var leaves := MapMaterials.plain(Color(0.18, 0.28, 0.14), 0.95)
	var n := maxi(1, int(size.x / 0.8))
	for i in n:
		var t := (float(i) + 0.5) / n - 0.5
		vsphere(detail, center + Vector3(t * size.x, 0, randf_range(-0.1, 0.1)), size.z * 0.55, leaves, 0.7)


func hydrant(base: Vector3) -> void:
	var red := MapMaterials.plain(Color(0.7, 0.1, 0.07), 0.5, 0.2)
	vcyl(detail, base + Vector3(0, 0.35, 0), 0.12, 0.7, red, -1.0, 12)
	vsphere(detail, base + Vector3(0, 0.72, 0), 0.13, red)
	var side := vcyl(detail, base + Vector3(0, 0.45, 0), 0.05, 0.36, red, -1.0, 8)
	side.rotation.z = PI * 0.5


func ac_unit(base: Vector3) -> void:
	var mat := MapMaterials.get_material("metal", Color(0.85, 0.85, 0.83))
	vbox(detail, base + Vector3(0, 0.45, 0), Vector3(1.1, 0.9, 0.8), mat)
	vcyl(detail, base + Vector3(0, 0.91, 0), 0.3, 0.03, MapMaterials.plain(Color(0.1, 0.1, 0.1)), -1.0, 16)


func electrical_box(base: Vector3, yaw: float) -> void:
	vbox(detail, base + Vector3(0, 0.7, 0), Vector3(0.8, 1.4, 0.4), MapMaterials.get_material("metal", Color(0.45, 0.5, 0.45)), yaw)
	collider(base + Vector3(0, 0.7, 0), Vector3(0.8, 1.4, 0.4), yaw)


## Calha vertical no canto do prédio.
func drain_pipe(base: Vector3, height: float) -> void:
	var mat := MapMaterials.plain(Color(0.3, 0.31, 0.3), 0.5, 0.6)
	vcyl(detail, base + Vector3(0, height * 0.5, 0), 0.05, height, mat, -1.0, 8)
	vbox(detail, base + Vector3(0, 0.12, 0), Vector3(0.18, 0.08, 0.18), mat)


## Meio-fio em volta de uma calçada retangular (só visual).
func curb_rect(center: Vector3, size: Vector2) -> void:
	var mat := MapMaterials.get_material("concrete", Color(0.85, 0.85, 0.83))
	var h := 0.12
	var t := 0.18
	var y := h * 0.5 - 0.02
	vbox(detail, center + Vector3(0, y, -size.y * 0.5), Vector3(size.x, h, t), mat)
	vbox(detail, center + Vector3(0, y, size.y * 0.5), Vector3(size.x, h, t), mat)
	vbox(detail, center + Vector3(-size.x * 0.5, y, 0), Vector3(t, h, size.y), mat)
	vbox(detail, center + Vector3(size.x * 0.5, y, 0), Vector3(t, h, size.y), mat)


## Placa de rua simples com texto.
func street_sign(base: Vector3, text: String) -> void:
	var metal := MapMaterials.plain(Color(0.45, 0.46, 0.47), 0.4, 0.7)
	vcyl(detail, base + Vector3(0, 1.3, 0), 0.035, 2.6, metal, -1.0, 8)
	var red := text == "PARE"
	var plate := vbox(detail, base + Vector3(0, 2.35, 0), Vector3(0.7, 0.7 if red else 0.35, 0.03),
		MapMaterials.plain(Color(0.7, 0.08, 0.06) if red else Color(0.08, 0.3, 0.16), 0.5))
	for side in [1.0, -1.0]:
		var l := Label3D.new()
		l.text = text
		l.font_size = 64 if red else 40
		l.pixel_size = 0.004
		l.modulate = Color(0.95, 0.95, 0.95)
		l.outline_size = 0
		l.position = plate.position + Vector3(0, 0, 0.02 * side)
		l.rotation.y = 0.0 if side > 0.0 else PI
		detail.add_child(l)


## Lixo espalhado (papéis, folhas, bitucas) em uma única MultiMesh.
## zones: [[centro_x, centro_z, meia_largura, meia_profundidade], ...]
func litter(rng: RandomNumberGenerator, zones: Array, count: int) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var quad := QuadMesh.new()
	quad.size = Vector2(0.14, 0.1)
	mm.mesh = quad
	mm.instance_count = count
	var palette := [Color(0.8, 0.78, 0.72), Color(0.45, 0.33, 0.18), Color(0.36, 0.3, 0.16),
		Color(0.6, 0.55, 0.45), Color(0.25, 0.3, 0.18)]
	for i in count:
		var z: Array = zones[rng.randi() % zones.size()]
		var p := Vector3(z[0] + rng.randf_range(-z[2], z[2]), 0.02, z[1] + rng.randf_range(-z[3], z[3]))
		var b := Basis(Vector3.UP, rng.randf() * TAU) * Basis(Vector3.RIGHT, -PI * 0.5 + rng.randf_range(-0.15, 0.15))
		var sc := rng.randf_range(0.5, 1.6)
		mm.set_instance_transform(i, Transform3D(b.scaled(Vector3(sc, sc, sc)), p))
		mm.set_instance_color(i, palette[rng.randi() % palette.size()])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.9
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mmi.material_override = mat
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	detail.add_child(mmi)


# ============================================================================
#  Iluminação interna
# ============================================================================
func ceiling_light(pos: Vector3, cool := false, flicker := false) -> void:
	var color := Color(0.85, 0.92, 1.0) if cool else Color(1.0, 0.85, 0.65)
	vbox(detail, pos, Vector3(1.2, 0.05, 0.3), MapMaterials.emissive(color, 3.0 if interior_light_energy > 0.0 else 0.0), 0.0, false)
	if interior_light_energy <= 0.0:
		return
	var light := OmniLight3D.new()
	light.position = pos - Vector3(0, 0.25, 0)
	light.light_color = color
	light.light_energy = 1.3 * interior_light_energy
	light.omni_range = 8.0
	light.omni_attenuation = 1.2
	light.shadow_enabled = false
	detail.add_child(light)
	if flicker:
		light.set_script(preload("res://map/flicker_light.gd"))


func hanging_lamp(pos: Vector3) -> void:
	var metal := MapMaterials.plain(Color(0.2, 0.22, 0.2), 0.5, 0.5)
	vcyl(detail, pos + Vector3(0, 0.6, 0), 0.01, 1.2, metal, -1.0, 4)
	vcyl(detail, pos, 0.35, 0.3, metal, 0.12, 14)
	vcyl(detail, pos - Vector3(0, 0.14, 0), 0.3, 0.02, MapMaterials.emissive(Color(1.0, 0.88, 0.7), 3.5), -1.0, 14)
	if interior_light_energy <= 0.0:
		return
	var spot := SpotLight3D.new()
	spot.position = pos - Vector3(0, 0.2, 0)
	spot.rotation.x = -PI * 0.5
	spot.light_color = Color(1.0, 0.86, 0.66)
	spot.light_energy = 6.0 * interior_light_energy
	spot.spot_range = 11.0
	spot.spot_angle = 60.0
	spot.shadow_enabled = false
	detail.add_child(spot)


# ============================================================================
#  Arquitetura
# ============================================================================
## Moldura de janela/porta. along_x: parede ao longo do eixo X.
func opening_frame(center_xz: Vector2, along_x: bool, width: float, y0: float, y1: float, wall_t: float) -> void:
	var mat := MapMaterials.plain(Color(0.2, 0.2, 0.2), 0.6, 0.2)
	var t := 0.07
	var depth := wall_t + 0.06
	var axis := Vector3.RIGHT if along_x else Vector3.BACK
	var c := Vector3(center_xz.x, 0.0, center_xz.y)
	var size_side := Vector3(t, y1 - y0, depth) if along_x else Vector3(depth, y1 - y0, t)
	for s in [-1.0, 1.0]:
		vbox(detail, c + axis * (width * 0.5 + t * 0.5) * s + Vector3(0, (y0 + y1) * 0.5, 0), size_side, mat)
	var size_top := Vector3(width + t * 2.0, t, depth) if along_x else Vector3(depth, t, width + t * 2.0)
	vbox(detail, c + Vector3(0, y1 + t * 0.5, 0), size_top, mat)
	if y0 > 0.01:
		# Parapeito da janela (sobressai um pouco).
		var sill := Vector3(width + 0.2, 0.05, depth + 0.1) if along_x else Vector3(depth + 0.1, 0.05, width + 0.2)
		vbox(detail, c + Vector3(0, y0 - 0.025, 0), sill, MapMaterials.get_material("concrete"))


## Mureta decorativa em volta do telhado.
func roof_parapet(center: Vector3, size: Vector3) -> void:
	var mat := MapMaterials.get_material("concrete", Color(0.8, 0.8, 0.78))
	var y := center.y + size.y * 0.5 + 0.25
	var hx := size.x * 0.5
	var hz := size.z * 0.5
	vbox(detail, Vector3(center.x, y, center.z - hz), Vector3(size.x, 0.5, 0.25), mat)
	vbox(detail, Vector3(center.x, y, center.z + hz), Vector3(size.x, 0.5, 0.25), mat)
	vbox(detail, Vector3(center.x - hx, y, center.z), Vector3(0.25, 0.5, size.z), mat)
	vbox(detail, Vector3(center.x + hx, y, center.z), Vector3(0.25, 0.5, size.z), mat)


## Prédio de fundo (fora da área jogável, sem colisão).
func skyline_building(center_xz: Vector2, size: Vector3, tint: Color) -> void:
	var c := Vector3(center_xz.x, size.y * 0.5, center_xz.y)
	var mi := vbox(detail, c, size, MapMaterials.get_material("facade", tint), 0.0, false)
	mi.gi_mode = GeometryInstance3D.GI_MODE_DISABLED
	vbox(detail, c + Vector3(0, size.y * 0.5 + 0.3, 0), size + Vector3(0.3, -size.y + 0.6, 0.3),
		MapMaterials.get_material("concrete", Color(0.6, 0.6, 0.6)), 0.0, false)


# ============================================================================
#  Sinalização horizontal
# ============================================================================
## Linha pintada de a até b (no chão). dash > 0 = tracejada.
func road_line(a: Vector3, b: Vector3, width: float, color: Color, dash := 0.0, gap := 0.0) -> void:
	var mat := MapMaterials.road_paint(color)
	var dir := b - a
	var length := dir.length()
	var yaw := atan2(dir.x, dir.z)
	if dash <= 0.0:
		ground_plane((a + b) * 0.5 + Vector3(0, 0.014, 0), Vector2(width, length), mat, yaw)
		return
	var n := int(length / (dash + gap))
	for i in n:
		var t0 := i * (dash + gap)
		var mid := a + dir.normalized() * (t0 + dash * 0.5)
		ground_plane(mid + Vector3(0, 0.014, 0), Vector2(width, dash), mat, yaw)


## Faixa de pedestres. across_x: listras atravessando ao longo de X.
func crosswalk(center: Vector3, length: float, stripe_count: int, along_x: bool) -> void:
	var mat := MapMaterials.road_paint(Color(0.85, 0.85, 0.82))
	var spacing := 0.9
	for i in stripe_count:
		var off := (i - (stripe_count - 1) * 0.5) * spacing
		var pos := center + (Vector3(0, 0, off) if along_x else Vector3(off, 0, 0)) + Vector3(0, 0.014, 0)
		var size := Vector2(length, 0.45) if along_x else Vector2(0.45, length)
		ground_plane(pos, size, mat)
