class_name ImpactEffects
extends Node3D
## Efeitos de impacto e traçantes com "pool" (reaproveita nós, sem criar
## e destruir objetos a cada tiro). Sem sangue/gore: impactos em pessoas
## geram apenas uma pequena nuvem escura.

const MARK_POOL := 64
const PUFF_POOL := 12
const TRACER_POOL := 16
const TRACER_TIME := 0.05

var _marks: Array[MeshInstance3D] = []
var _puffs: Array[GPUParticles3D] = []
var _tracers: Array[MeshInstance3D] = []
var _tracer_life: Array[float] = []
var _next_mark := 0
var _next_puff := 0
var _next_tracer := 0
var _world_mat: StandardMaterial3D
var _flesh_mat: StandardMaterial3D


func _ready() -> void:
	Events.bullet_impact.connect(_on_impact)
	Events.tracer.connect(_on_tracer)
	_build_pools()
	set_process(false)


func _build_pools() -> void:
	var mark_mat := StandardMaterial3D.new()
	mark_mat.albedo_color = Color(0.06, 0.06, 0.06, 0.85)
	mark_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mark_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var quad := QuadMesh.new()
	quad.size = Vector2(0.07, 0.07)
	for i in MARK_POOL:
		var m := MeshInstance3D.new()
		m.mesh = quad
		m.material_override = mark_mat
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		m.visible = false
		add_child(m)
		_marks.append(m)

	_world_mat = _puff_mat(Color(0.75, 0.72, 0.65))
	_flesh_mat = _puff_mat(Color(0.2, 0.18, 0.18))
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3(0, 0, 1)
	pm.spread = 35.0
	pm.initial_velocity_min = 1.5
	pm.initial_velocity_max = 4.0
	pm.gravity = Vector3(0, -6, 0)
	pm.scale_min = 0.5
	pm.scale_max = 1.2
	var dust := BoxMesh.new()
	dust.size = Vector3(0.04, 0.04, 0.04)
	for i in PUFF_POOL:
		var p := GPUParticles3D.new()
		p.amount = 8
		p.lifetime = 0.35
		p.one_shot = true
		p.explosiveness = 1.0
		p.emitting = false
		p.process_material = pm
		p.draw_pass_1 = dust
		p.local_coords = false
		add_child(p)
		_puffs.append(p)

	var tracer_mat := StandardMaterial3D.new()
	tracer_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	tracer_mat.albedo_color = Color(1.0, 0.85, 0.5, 0.7)
	tracer_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	tracer_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	var tracer_mesh := BoxMesh.new()
	tracer_mesh.size = Vector3(0.012, 0.012, 1.0)
	for i in TRACER_POOL:
		var t := MeshInstance3D.new()
		t.mesh = tracer_mesh
		t.material_override = tracer_mat
		t.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		t.visible = false
		add_child(t)
		_tracers.append(t)
		_tracer_life.append(0.0)


func _puff_mat(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	return m


func _on_impact(pos: Vector3, normal: Vector3, surface: StringName) -> void:
	var n := normal.normalized() if normal.length_squared() > 0.001 else Vector3.UP
	var up := Vector3.UP if absf(n.y) < 0.95 else Vector3.RIGHT
	if surface == &"world":
		var m := _marks[_next_mark]
		_next_mark = (_next_mark + 1) % MARK_POOL
		m.global_transform = Transform3D(Basis.looking_at(-n, up), pos + n * 0.01)
		m.visible = true
	var p := _puffs[_next_puff]
	_next_puff = (_next_puff + 1) % PUFF_POOL
	p.global_transform = Transform3D(Basis.looking_at(-n, up), pos + n * 0.02)
	p.material_override = _world_mat if surface == &"world" else _flesh_mat
	p.restart()
	AudioManager.play_at("impact_world" if surface == &"world" else "impact_flesh", pos, -10.0, 0.2)


func _on_tracer(from: Vector3, to: Vector3) -> void:
	var length := from.distance_to(to)
	if length < 1.0:
		return
	var t := _tracers[_next_tracer]
	var dir := (to - from) / length
	var up := Vector3.UP if absf(dir.y) < 0.95 else Vector3.RIGHT
	# Traçante curto que "viaja" do meio do caminho até o alvo.
	var seg := minf(length * 0.5, 6.0)
	var center := to - dir * seg * 0.5
	t.global_transform = Transform3D(Basis.looking_at(dir, up).scaled_local(Vector3(1, 1, seg)), center)
	t.visible = true
	_tracer_life[_next_tracer] = TRACER_TIME
	_next_tracer = (_next_tracer + 1) % TRACER_POOL
	set_process(true)


func _process(delta: float) -> void:
	var any := false
	for i in TRACER_POOL:
		if _tracer_life[i] > 0.0:
			_tracer_life[i] -= delta
			if _tracer_life[i] <= 0.0:
				_tracers[i].visible = false
			else:
				any = true
	if not any:
		set_process(false)
