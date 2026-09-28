class_name Bot
extends CharacterBody3D
## ============================================================================
##  BOT — inimigo/aliado controlado por IA. Componentes:
##    BotPerception → visão, audição, reação a dano
##    BotBrain      → máquina de estados (ai/states/)
##    BotCombat     → uso da arma
##    Health + HumanoidRig → vida e hitboxes por região
##    NavigationAgent3D    → caminhos pela navmesh
##  Para criar um novo tipo de inimigo: crie outro perfil em BotConfig e/ou
##  registre estados diferentes no BotBrain.
## ============================================================================

signal died(bot: Bot)

const TEAM_COLORS := [Color(0.2, 0.42, 0.75), Color(0.72, 0.2, 0.17)]

var team := 1
var display_name := "Bot"
var profile: BotProfile
var map_data: MapData

var health: Health
var rig: HumanoidRig
var nav: NavigationAgent3D
var perception: BotPerception
var brain: BotBrain
var combat: BotCombat
var is_crouching := false

var _dead := false
var _has_move_target := false
var _running := false
var _look_target := Vector3.ZERO
var _has_look := false
var _yaw := 0.0
var _crouch_amount := 0.0
var _step_accum := 0.0
var _hit_exclusions: Array[RID] = []
var _last_hit_weapon := ""
var _state_label: Label3D


func setup(p_team: int, p_name: String, p_profile: BotProfile, p_map: MapData) -> void:
	team = p_team
	display_name = p_name
	profile = p_profile
	map_data = p_map


func _ready() -> void:
	add_to_group("combatants")
	add_to_group("bots")
	collision_layer = Layers.BOTS
	collision_mask = Layers.MOVEMENT_MASK
	floor_snap_length = 0.35
	floor_max_angle = deg_to_rad(46.0)
	_yaw = rotation.y

	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.35
	capsule.height = 1.8
	shape.shape = capsule
	shape.position.y = 0.9
	add_child(shape)

	health = Health.new()
	add_child(health)
	health.setup(GameConfig.player_max_health)
	health.died.connect(_on_died)
	health.damaged.connect(_on_damaged)

	rig = HumanoidRig.new()
	add_child(rig)
	rig.build(self, health, TEAM_COLORS[team], true)
	_hit_exclusions = rig.get_hitbox_rids()

	nav = NavigationAgent3D.new()
	nav.path_desired_distance = 0.7
	nav.target_desired_distance = 0.9
	nav.radius = 0.4
	nav.height = 1.8
	nav.path_max_distance = 4.0
	add_child(nav)

	perception = BotPerception.new(self, profile)
	combat = BotCombat.new(self, profile)
	combat.equip(profile.weapon_pool.pick_random())
	brain = BotBrain.new(self)

	Events.noise_emitted.connect(perception.on_noise)
	Events.enemy_spotted.connect(_on_enemy_spotted)

	# Marcador sobre aliados (evita confundir amigo e inimigo).
	if team == 0 or GameConfig.debug_show_bot_state:
		_state_label = Label3D.new()
		_state_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_state_label.no_depth_test = team == 0
		_state_label.fixed_size = true
		_state_label.pixel_size = 0.0012
		_state_label.font_size = 28
		_state_label.outline_size = 6
		_state_label.modulate = Color(0.55, 0.8, 1.0) if team == 0 else Color(1, 0.6, 0.5)
		_state_label.position.y = 2.15
		_state_label.text = display_name
		add_child(_state_label)
	brain.reset()


# ============================================================================
#  Loop
# ============================================================================
func _physics_process(delta: float) -> void:
	if _dead:
		velocity = Vector3(0.0, velocity.y - GameConfig.gravity * delta, 0.0)
		move_and_slide()
		return
	perception.tick(delta)
	brain.tick(delta)
	combat.tick(delta)
	_update_movement(delta)
	_update_rotation(delta)
	_crouch_amount = move_toward(_crouch_amount, 1.0 if is_crouching else 0.0, delta * 5.0)
	rig.set_crouch_amount(_crouch_amount)


func _update_movement(delta: float) -> void:
	var desired := Vector3.ZERO
	if _has_move_target:
		if nav.is_navigation_finished():
			_has_move_target = false
		else:
			var next := nav.get_next_path_position()
			var dir := next - global_position
			dir.y = 0.0
			if dir.length_squared() > 0.0004:
				var speed := BotConfig.BOT_RUN_SPEED if _running else BotConfig.BOT_WALK_SPEED
				if is_crouching:
					speed = BotConfig.BOT_CROUCH_SPEED
				desired = dir.normalized() * speed * profile.move_speed_mult
	var hv := Vector3(velocity.x, 0.0, velocity.z).move_toward(desired, BotConfig.BOT_ACCELERATION * delta)
	velocity.x = hv.x
	velocity.z = hv.z
	if not is_on_floor():
		velocity.y -= GameConfig.gravity * delta
	move_and_slide()

	# Passos (som) — só perto do jogador para economizar.
	var hspeed := hv.length()
	if hspeed > 0.5 and is_on_floor():
		_step_accum += hspeed * delta
		var step := 1.2 if _running else 0.85
		if _step_accum >= step:
			_step_accum = 0.0
			var cam := get_viewport().get_camera_3d()
			if cam and cam.global_position.distance_squared_to(global_position) < 900.0:
				var vol := GameConfig.footstep_volume_db + (2.0 if _running else -3.0)
				AudioManager.play_at("footstep", global_position, vol, 0.15)


func _update_rotation(delta: float) -> void:
	var target_yaw := _yaw
	if _has_look:
		var to := _look_target - global_position
		if Vector2(to.x, to.z).length_squared() > 0.01:
			target_yaw = atan2(-to.x, -to.z)
	elif Vector2(velocity.x, velocity.z).length_squared() > 0.3:
		target_yaw = atan2(-velocity.x, -velocity.z)
	var max_step := deg_to_rad(profile.turn_speed_deg) * delta
	_yaw = rotate_toward(_yaw, target_yaw, max_step)
	rotation.y = _yaw


# ============================================================================
#  API de movimento usada pelos estados
# ============================================================================
func move_to(pos: Vector3, run := true) -> void:
	_running = run
	if not _has_move_target or nav.target_position.distance_squared_to(pos) > 0.25:
		nav.target_position = pos
	_has_move_target = true


func stop_moving() -> void:
	_has_move_target = false


func has_arrived() -> bool:
	return not _has_move_target or nav.is_navigation_finished()


func look_at_point(p: Vector3) -> void:
	_look_target = p
	_has_look = true


func clear_look() -> void:
	_has_look = false


func set_crouch(value: bool) -> void:
	is_crouching = value


func is_facing(point: Vector3, tolerance_deg: float) -> bool:
	var to := point - global_position
	var desired := atan2(-to.x, -to.z)
	return absf(angle_difference(_yaw, desired)) <= deg_to_rad(tolerance_deg)


func get_horizontal_speed() -> float:
	return Vector2(velocity.x, velocity.z).length()


func get_random_enemy() -> Node3D:
	var enemies: Array = []
	for a in get_tree().get_nodes_in_group("combatants"):
		if a.team != team and a.is_alive():
			enemies.append(a)
	return enemies.pick_random() if not enemies.is_empty() else null


# ============================================================================
#  Eventos
# ============================================================================
func _on_damaged(_amount: float, source: Node, _region: StringName) -> void:
	perception.on_damaged(source)


func _on_enemy_spotted(spotter: Node, _enemy: Node, pos: Vector3) -> void:
	if _dead or spotter == self or spotter.team != team or not profile.team_callouts:
		return
	if global_position.distance_to(spotter.global_position) < 30.0:
		perception.on_callout(pos)


func _on_died(killer: Node) -> void:
	_dead = true
	_has_move_target = false
	collision_layer = 0
	rig.play_death()
	if _state_label:
		_state_label.visible = false
	Events.actor_died.emit(self, killer, _last_hit_weapon, health.last_region == &"head")
	died.emit(self)
	# Esconde o corpo depois de alguns segundos.
	get_tree().create_timer(2.5, false).timeout.connect(func():
		if _dead:
			rig.visible = false)


func on_state_changed(state_name: StringName) -> void:
	if _state_label and GameConfig.debug_show_bot_state:
		_state_label.text = "%s\n[%s]" % [display_name, state_name]


# ============================================================================
#  Interface comum de "combatente"
# ============================================================================
func is_alive() -> bool:
	return not _dead


func respawn(xform: Transform3D) -> void:
	global_position = xform.origin
	_yaw = xform.basis.get_euler().y
	rotation.y = _yaw
	velocity = Vector3.ZERO
	_dead = false
	collision_layer = Layers.BOTS
	is_crouching = false
	_crouch_amount = 0.0
	rig.reset_pose()
	if _state_label:
		_state_label.visible = true
	health.reset()
	health.set_invulnerable(GameConfig.spawn_protection_time)
	perception.reset()
	combat.reset()
	_has_move_target = false
	_has_look = false
	brain.reset()


func get_eye_position() -> Vector3:
	return global_position + Vector3(0.0, 1.6 - HumanoidRig.CROUCH_DROP * _crouch_amount, 0.0)


func get_chest_position() -> Vector3:
	return global_position + Vector3(0.0, 1.2 - HumanoidRig.CROUCH_DROP * _crouch_amount, 0.0)


func get_head_position() -> Vector3:
	return global_position + Vector3(0.0, 1.62 - HumanoidRig.CROUCH_DROP * _crouch_amount, 0.0)


func get_muzzle_position() -> Vector3:
	return rig.muzzle.global_position


func get_visibility_factor() -> float:
	return 0.7 if is_crouching else 1.0


func get_hit_exclusions() -> Array[RID]:
	return _hit_exclusions


func get_weapon_name() -> String:
	return combat.data.display_name


func set_last_hit_weapon(weapon_name: String) -> void:
	_last_hit_weapon = weapon_name
