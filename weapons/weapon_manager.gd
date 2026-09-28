class_name WeaponManager
extends Node3D
## Controla a arma equipada e a TROCA de armas (com atraso e animação).
## Fica como filho da câmera; as armas são filhas dele.

signal weapon_changed(weapon: Weapon)
signal ammo_changed(mag: int, reserve: int)
signal weapon_fired(weapon: Weapon, recoil: Vector2)

var inventory: Inventory
var current: Weapon
var _pending: Weapon
var _previous: Weapon


func setup(p_inventory: Inventory) -> void:
	inventory = p_inventory
	inventory.weapon_added.connect(_on_weapon_added)


func _on_weapon_added(w: Weapon) -> void:
	w.ammo_changed.connect(func(mag, reserve):
		if w == current:
			ammo_changed.emit(mag, reserve))
	w.fired.connect(func(weapon, recoil): weapon_fired.emit(weapon, recoil))


func physics_tick(delta: float, ctx: WeaponContext) -> void:
	if current:
		current.physics_tick(delta, ctx)
		if _pending and current.state == Weapon.State.HOLSTERED:
			_activate(_pending)
	elif _pending:
		_activate(_pending)


func visual_tick(delta: float, ctx: WeaponContext) -> void:
	if current:
		current.visual_tick(delta, ctx)


func select_slot(slot: int) -> void:
	var w := inventory.get_weapon_in_slot(slot)
	if w:
		_request(w)


## dir = +1 próxima, -1 anterior.
func cycle(dir: int) -> void:
	var slots := inventory.get_owned_slots()
	if slots.size() < 2:
		return
	var target: Weapon = _pending if _pending else current
	var idx := slots.find(target.data.slot) if target else 0
	idx = wrapi(idx + dir, 0, slots.size())
	_request(inventory.get_weapon_in_slot(slots[idx]))


## Volta para a última arma usada (tecla Q).
func quick_switch() -> void:
	if _previous and _previous != current:
		_request(_previous)


## Equipa imediatamente, sem animação de guardar (ex.: ao renascer).
func equip_immediate(slot: int) -> void:
	var w := inventory.get_weapon_in_slot(slot)
	if w == null:
		return
	for other in inventory.get_all():
		other.force_holster()
	_pending = null
	current = null
	_activate(w)


func _request(w: Weapon) -> void:
	if w == null:
		return
	if w == current and _pending == null:
		return
	if w == current:
		# Voltou para a arma que estava sendo guardada: saca de novo.
		_pending = null
		current.draw()
		return
	_pending = w
	if current == null or current.state == Weapon.State.HOLSTERED:
		_activate(w)
	else:
		current.holster()


func _activate(w: Weapon) -> void:
	if current and current != w:
		_previous = current
		current.force_holster()
	current = w
	_pending = null
	w.draw()
	weapon_changed.emit(w)
	ammo_changed.emit(w.ammo_in_mag, w.reserve_ammo)


# --- Consultas usadas pela câmera, HUD e movimentação ------------------------
func get_ads_amount() -> float:
	return current.ads_amount if current else 0.0


func get_ads_zoom() -> float:
	return current.data.ads_zoom if current else 1.0


func is_scoped() -> bool:
	return current != null and current.is_scoped()


func get_speed_multiplier() -> float:
	if current == null:
		return 1.0
	return current.data.move_speed_mult * lerpf(1.0, GameConfig.ads_speed_multiplier, current.ads_amount)


func is_busy_switching() -> bool:
	return _pending != null or (current != null and current.state == Weapon.State.DRAWING)
