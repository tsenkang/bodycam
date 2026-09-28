class_name Shotgun
extends Weapon
## Espingarda de bombear. Vários "pellets" por disparo (data.pellets),
## dano altíssimo de perto e recuo forte.
## Recarga CARTUCHO A CARTUCHO: dá para interromper atirando.

enum ReloadPhase { START, SHELLS, END }

var _phase: ReloadPhase = ReloadPhase.START


func _init() -> void:
	weapon_id = &"shotgun"


func _on_fired() -> void:
	_action_anim = 1.0
	if data.sound_action != "":
		get_tree().create_timer(0.22).timeout.connect(
			func(): AudioManager.play_2d(data.sound_action, -5.0))


func _animate_parts(_delta: float) -> void:
	var pump: Node3D = _parts.get("pump")
	if pump == null:
		return
	# Bomba vai para trás e volta (curva em "sino").
	var t := 1.0 - _action_anim
	pump.position.z = sin(clampf(t * 1.6, 0.0, 1.0) * PI) * 0.07 if _action_anim > 0.0 else 0.0


# --- Recarga cartucho a cartucho -------------------------------------------
func _begin_reload() -> void:
	_phase = ReloadPhase.START
	_state_total = data.reload_start_time
	_state_timer = data.reload_start_time


func _process_reload(delta: float) -> void:
	_state_timer -= delta
	if _state_timer > 0.0:
		return
	match _phase:
		ReloadPhase.START:
			_phase = ReloadPhase.SHELLS
			_state_total = data.reload_time
			_state_timer = data.reload_time
		ReloadPhase.SHELLS:
			# Um cartucho entra.
			ammo_in_mag += 1
			reserve_ammo -= 1
			_reload_committed = true
			AudioManager.play_2d(data.sound_reload, -4.0)
			ammo_changed.emit(ammo_in_mag, reserve_ammo)
			if ammo_in_mag >= data.magazine_size or reserve_ammo <= 0:
				_phase = ReloadPhase.END
				_state_total = data.reload_end_time
				_state_timer = data.reload_end_time
			else:
				_state_timer = data.reload_time
		ReloadPhase.END:
			state = State.READY
			reload_state_changed.emit(false)


func _can_fire_during_reload() -> bool:
	# Pode interromper entre cartuchos, desde que tenha munição.
	return ammo_in_mag > 0
