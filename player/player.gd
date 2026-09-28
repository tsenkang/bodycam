class_name Player
extends CharacterBody3D
## ============================================================================
##  JOGADOR — junta os componentes, sem concentrar a lógica deles:
##    PlayerMovement  → andar/correr/agachar/pular
##    BodycamCamera   → efeitos de câmera
##    WeaponManager   → arma equipada e troca
##    Inventory       → armas desbloqueadas
##    Health          → vida e regeneração
##    HumanoidRig     → hitboxes (cabeça/tronco/braços/pernas)
##    Interactor      → portas e armários de armas
##
##  Hierarquia criada em _ready():
##    Player (CharacterBody3D)
##    ├── CollisionShape3D (cápsula)
##    ├── HumanoidRig (hitboxes)
##    ├── Head (top_level: posição suavizada + mira yaw/pitch)
##    │   └── BodycamCamera
##    │       └── WeaponManager
##    │           └── armas...
##    ├── PlayerMovement / Inventory / Health (nós de lógica)
## ============================================================================

signal died(killer: Node)
signal respawned

var team := 0
var display_name := "Você"
var input_enabled := true

var movement: PlayerMovement
var camera: BodycamCamera
var head: Node3D
var weapon_manager: WeaponManager
var inventory: Inventory
var health: Health
var rig: HumanoidRig
var interactor: Interactor

var _yaw := 0.0          # radianos
var _pitch := 0.0        # radianos
var _dead := false
var _ctx := WeaponContext.new()
var _look_frame := Vector2.ZERO
var _prev_pos := Vector3.ZERO
var _curr_pos := Vector3.ZERO
var _sprint_blocked := false
var _hit_exclusions: Array[RID] = []
var _last_hit_weapon := ""
var _visibility_boost := 0.0


func _ready() -> void:
	add_to_group("combatants")
	add_to_group("player")
	collision_layer = Layers.PLAYER
	collision_mask = Layers.MOVEMENT_MASK
	floor_snap_length = 0.35
	floor_max_angle = deg_to_rad(46.0)

	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = GameConfig.player_radius
	capsule.height = GameConfig.player_height
	shape.shape = capsule
	shape.position.y = capsule.height * 0.5
	add_child(shape)

	health = Health.new()
	health.name = "Health"
	add_child(health)
	health.setup(GameConfig.player_max_health, GameConfig.health_regen_delay, GameConfig.health_regen_rate)
	health.died.connect(_on_died)

	rig = HumanoidRig.new()
	rig.name = "Hitboxes"
	add_child(rig)
	rig.build(self, health, Color.WHITE, false)
	_hit_exclusions = rig.get_hitbox_rids()

	movement = PlayerMovement.new()
	movement.name = "Movement"
	add_child(movement)
	movement.setup(self, shape)
	movement.landed.connect(_on_landed)
	movement.footstep.connect(_on_footstep)

	head = Node3D.new()
	head.name = "Head"
	head.top_level = true
	add_child(head)
	camera = BodycamCamera.new()
	camera.name = "BodycamCamera"
	head.add_child(camera)

	weapon_manager = WeaponManager.new()
	weapon_manager.name = "WeaponManager"
	camera.add_child(weapon_manager)
	inventory = Inventory.new()
	inventory.name = "Inventory"
	add_child(inventory)
	inventory.setup(self, weapon_manager)
	weapon_manager.setup(inventory)
	weapon_manager.weapon_fired.connect(_on_weapon_fired)

	camera.movement = movement
	camera.weapons = weapon_manager
	camera.current = true
	interactor = Interactor.new(self, camera)

	for id in GameConfig.player_start_weapons:
		inventory.add_weapon(id)
	weapon_manager.equip_immediate(inventory.get_owned_slots()[0])
	_curr_pos = global_position
	_prev_pos = global_position


# ============================================================================
#  Input
# ============================================================================
func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled or _dead:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var motion := event as InputEventMouseMotion
		var sens := GameConfig.mouse_sensitivity
		# Mirando: sensibilidade proporcional ao zoom.
		var ads := weapon_manager.get_ads_amount()
		sens *= lerpf(1.0, GameConfig.ads_sensitivity_multiplier / weapon_manager.get_ads_zoom(), ads)
		var d_yaw := -motion.relative.x * sens
		var d_pitch := -motion.relative.y * sens
		var new_pitch := clampf(rad_to_deg(_pitch) + d_pitch, -88.0, 88.0)
		d_pitch = new_pitch - rad_to_deg(_pitch)
		_yaw += deg_to_rad(d_yaw)
		_pitch = deg_to_rad(new_pitch)
		_look_frame += Vector2(d_yaw, d_pitch)
		camera.add_look_input(d_yaw, d_pitch)
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event.is_action_pressed("next_weapon"):
		weapon_manager.cycle(1)
	elif event.is_action_pressed("prev_weapon"):
		weapon_manager.cycle(-1)
	elif event.is_action_pressed("quick_switch"):
		weapon_manager.quick_switch()
	elif event.is_action_pressed("interact"):
		interactor.try_interact()
	elif event.is_action_pressed("debug_unlock_all") and GameConfig.debug_unlock_key_enabled:
		for id in WeaponConfig.get_ids_by_slot():
			inventory.add_weapon(id)
		Events.hud_message.emit("DEBUG: todas as armas desbloqueadas")
	else:
		for i in range(1, 6):
			if event.is_action_pressed("weapon_%d" % i):
				weapon_manager.select_slot(i)
				break


# ============================================================================
#  Física
# ============================================================================
func _physics_process(delta: float) -> void:
	_prev_pos = global_position
	if _dead:
		velocity.x = move_toward(velocity.x, 0.0, 20.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, 20.0 * delta)
		velocity.y -= GameConfig.gravity * delta
		move_and_slide()
		_curr_pos = global_position
		return

	var active := input_enabled
	var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_back") if active else Vector2.ZERO
	var fire_held := active and Input.is_action_pressed("fire")
	var fire_pressed := active and Input.is_action_just_pressed("fire")
	var ads_held := active and Input.is_action_pressed("aim")
	var sprint_held := active and Input.is_action_pressed("sprint")

	# Atirar ou mirar interrompe a corrida até soltar Shift.
	if not sprint_held:
		_sprint_blocked = false
	if (fire_held or ads_held) and movement.is_sprinting:
		_sprint_blocked = true
	var wants_sprint := sprint_held and not _sprint_blocked and not ads_held

	rotation.y = _yaw
	var speed_mult := weapon_manager.get_speed_multiplier()
	movement.physics_update(delta, input_dir, wants_sprint,
		active and Input.is_action_pressed("crouch_hold"),
		active and Input.is_action_just_pressed("crouch_toggle"),
		active and Input.is_action_just_pressed("jump"), speed_mult)
	rig.set_crouch_amount(movement.crouch_amount * 0.9)

	_ctx.trigger_held = fire_held
	_ctx.trigger_pressed = fire_pressed
	_ctx.wants_ads = ads_held
	_ctx.reload_pressed = active and Input.is_action_just_pressed("reload")
	_ctx.is_sprinting = movement.is_sprinting
	_ctx.is_grounded = is_on_floor()
	_ctx.is_crouching = movement.is_crouching
	_ctx.move_ratio = movement.get_horizontal_speed() / GameConfig.walk_speed
	_ctx.move_state = movement.move_state
	_ctx.step_phase = movement.step_phase
	weapon_manager.physics_tick(delta, _ctx)

	interactor.tick()
	_visibility_boost = move_toward(_visibility_boost, 0.0, delta)
	_curr_pos = global_position


func _process(delta: float) -> void:
	# Interpola a posição da cabeça entre frames de física (câmera suave
	# mesmo em monitores de 120/144 Hz).
	var f := Engine.get_physics_interpolation_fraction()
	var eye := movement.current_eye_height
	head.global_position = _prev_pos.lerp(_curr_pos, f) + Vector3(0.0, eye, 0.0)
	head.rotation = Vector3(_pitch, _yaw, 0.0)
	_ctx.look_delta = _look_frame
	weapon_manager.visual_tick(delta, _ctx)
	_look_frame = Vector2.ZERO


# ============================================================================
#  Eventos
# ============================================================================
func _on_weapon_fired(weapon: Weapon, recoil: Vector2) -> void:
	# Parte do recuo fica na mira (o jogador precisa compensar puxando o
	# mouse); o resto é visual e se recupera sozinho.
	var carry := weapon.data.recoil_aim_carry
	_pitch = clampf(_pitch + deg_to_rad(recoil.x * carry), deg_to_rad(-88.0), deg_to_rad(88.0))
	_yaw += deg_to_rad(recoil.y * carry)
	camera.add_recoil(recoil.x * (1.0 - carry), recoil.y * (1.0 - carry),
		weapon.data.recoil_recovery, weapon.data.camera_shake * GameConfig.recoil_intensity)
	_visibility_boost = 1.5


func _on_landed(fall_speed: float) -> void:
	camera.add_landing_impact(fall_speed)
	if fall_speed > GameConfig.landing_min_speed:
		AudioManager.play_at("land", global_position, GameConfig.footstep_volume_db)
		Events.noise_emitted.emit(global_position, 10.0, self)


func _on_footstep(state: int) -> void:
	var vol := GameConfig.footstep_volume_db
	var radius := 7.0
	match state:
		PlayerMovement.MoveState.SPRINT:
			vol += 3.0
			radius = 15.0
		PlayerMovement.MoveState.CROUCH:
			vol -= 8.0
			radius = 0.0
	AudioManager.play_at("footstep", global_position, vol, 0.12)
	if radius > 0.0:
		Events.noise_emitted.emit(global_position, radius, self)


func _on_died(killer: Node) -> void:
	_dead = true
	rig.set_hitboxes_enabled(false)
	if weapon_manager.current:
		weapon_manager.current.force_holster()
	camera.set_dead(true)
	interactor.clear()
	Events.actor_died.emit(self, killer, _last_hit_weapon, health.last_region == &"head")
	died.emit(killer)


# ============================================================================
#  Interface comum de "combatente" (usada por IA, spawn e partida)
# ============================================================================
func is_alive() -> bool:
	return not _dead


func respawn(xform: Transform3D) -> void:
	global_position = xform.origin
	velocity = Vector3.ZERO
	_yaw = xform.basis.get_euler().y
	_pitch = 0.0
	rotation.y = _yaw
	_prev_pos = global_position
	_curr_pos = global_position
	_dead = false
	movement.reset()
	health.reset()
	health.set_invulnerable(GameConfig.spawn_protection_time)
	rig.set_hitboxes_enabled(true)
	camera.set_dead(false)
	inventory.reset_ammo_all()
	weapon_manager.equip_immediate(inventory.get_owned_slots()[0])
	respawned.emit()


func get_aim_transform() -> Transform3D:
	return camera.global_transform


func get_eye_position() -> Vector3:
	return global_position + Vector3(0.0, movement.current_eye_height, 0.0)


func get_chest_position() -> Vector3:
	return global_position + Vector3(0.0, lerpf(1.2, 0.75, movement.crouch_amount), 0.0)


func get_head_position() -> Vector3:
	return global_position + Vector3(0.0, lerpf(1.62, 1.1, movement.crouch_amount), 0.0)


## Quão fácil é notar o jogador (agachado = menos, atirando/correndo = mais).
func get_visibility_factor() -> float:
	var f := 1.0
	if movement.is_crouching:
		f *= 0.65
	if movement.is_sprinting:
		f *= 1.25
	return f + _visibility_boost


func get_hit_exclusions() -> Array[RID]:
	return _hit_exclusions


func get_inventory() -> Inventory:
	return inventory


func get_weapon_name() -> String:
	return weapon_manager.current.data.display_name if weapon_manager.current else ""


func set_last_hit_weapon(weapon_name: String) -> void:
	_last_hit_weapon = weapon_name
