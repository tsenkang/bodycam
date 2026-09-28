class_name Game
extends Node3D
## Monta uma partida: ambiente, mapa + navmesh, jogador, bots, HUD, efeitos.

signal exit_to_menu
signal restart

var map_data: MapData
var player: Player
var match_manager: MatchManager
var hud: HUD
var pause_menu: PauseMenu
var _postfx: ColorRect


func _ready() -> void:
	_build_environment()
	var result := MapBuilder.new().build(self)
	map_data = result.map_data
	var nav_region: NavigationRegion3D = result.nav_region
	# Gera a navmesh a partir do cenário (síncrono: ~0,5 s no carregamento).
	nav_region.bake_navigation_mesh(false)
	# Espera o servidor de navegação sincronizar o mapa.
	var nav_map := get_world_3d().navigation_map
	var probe: Vector3 = map_data.spawn_points[0].position
	for i in 120:
		await get_tree().physics_frame
		if NavigationServer3D.map_get_iteration_id(nav_map) > 0 \
				and NavigationServer3D.map_get_closest_point(nav_map, probe).distance_to(probe) < 1.0:
			break
	map_data.finalize(nav_map)

	add_child(ImpactEffects.new())

	player = Player.new()
	player.name = "Player"
	add_child(player)

	match_manager = MatchManager.new()
	match_manager.name = "Match"
	add_child(match_manager)
	match_manager.setup(map_data, player)
	match_manager.match_ended.connect(_on_match_ended)

	_build_postfx()
	hud = HUD.new()
	add_child(hud)
	hud.bind(player, match_manager)

	pause_menu = PauseMenu.new()
	add_child(pause_menu)
	pause_menu.resume_requested.connect(_resume)
	pause_menu.restart_requested.connect(func(): _unpause(); restart.emit())
	pause_menu.menu_requested.connect(func(): _unpause(); exit_to_menu.emit())

	match_manager.start()
	AudioManager.start_ambient()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _exit_tree() -> void:
	AudioManager.stop_ambient()
	AudioManager.stop_all()


func _resume() -> void:
	pause_menu.hide_menu()
	_unpause()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unpause() -> void:
	get_tree().paused = false


func _on_match_ended(winner: int) -> void:
	var title := "EMPATE"
	if winner == 0:
		title = "VITÓRIA  %d x %d" % [match_manager.scores[0], match_manager.scores[1]]
	elif winner == 1:
		title = "DERROTA  %d x %d" % [match_manager.scores[0], match_manager.scores[1]]
	pause_menu.show_end(title)


func _build_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.42, 0.5, 0.6)
	sky_mat.sky_horizon_color = Color(0.68, 0.7, 0.72)
	sky_mat.ground_horizon_color = Color(0.5, 0.5, 0.5)
	sky_mat.ground_bottom_color = Color(0.2, 0.2, 0.2)
	sky.sky_material = sky_mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.9
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	env.ssao_enabled = true
	env.ssao_intensity = 1.5
	env.fog_enabled = true
	env.fog_light_color = Color(0.62, 0.65, 0.68)
	env.fog_density = 0.004
	env.glow_enabled = true
	env.glow_intensity = 0.4
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -35, 0)
	sun.light_energy = 1.1
	sun.light_color = Color(1.0, 0.96, 0.9)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 70.0
	add_child(sun)


func _build_postfx() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 1
	add_child(layer)
	_postfx = ColorRect.new()
	_postfx.set_anchors_preset(Control.PRESET_FULL_RECT)
	_postfx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sm := ShaderMaterial.new()
	sm.shader = load("res://shaders/bodycam_postfx.gdshader")
	sm.set_shader_parameter("distortion", GameConfig.postfx_distortion)
	sm.set_shader_parameter("vignette", GameConfig.postfx_vignette)
	sm.set_shader_parameter("grain", GameConfig.postfx_grain)
	sm.set_shader_parameter("chromatic", GameConfig.postfx_chromatic)
	sm.set_shader_parameter("saturation", GameConfig.postfx_saturation)
	_postfx.material = sm
	_postfx.visible = GameConfig.bodycam_postfx_enabled
	layer.add_child(_postfx)
