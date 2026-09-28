class_name Inventory
extends Node
## Guarda as armas que o jogador possui (desbloqueadas), uma por slot.
## Slot 1 = MP4, 2 = Glock, 3 = Espingarda, 4 = AK-47, 5 = Rifle de precisão
## (definidos em weapon_config.gd). As armas desbloqueadas continuam com o
## jogador depois de morrer; só a munição é reposta.

signal weapon_added(weapon: Weapon)

var user: Node3D
## Nó onde as armas ficam na cena (o WeaponManager, filho da câmera).
var holder: Node3D
var _by_slot := {}


func setup(p_user: Node3D, p_holder: Node3D) -> void:
	user = p_user
	holder = p_holder


## Adiciona (desbloqueia) uma arma. Se já tiver, só enche a munição.
func add_weapon(id: StringName) -> Weapon:
	if not WeaponConfig.has_weapon(id):
		push_warning("Inventory: arma desconhecida %s" % id)
		return null
	var existing := get_weapon(id)
	if existing:
		existing.refill_ammo()
		return existing
	var w := Weapon.create(id)
	w.user = user
	holder.add_child(w)
	_by_slot[w.data.slot] = w
	weapon_added.emit(w)
	return w


func has_weapon(id: StringName) -> bool:
	return get_weapon(id) != null


func get_weapon(id: StringName) -> Weapon:
	for w in _by_slot.values():
		if w.weapon_id == id:
			return w
	return null


func get_weapon_in_slot(slot: int) -> Weapon:
	return _by_slot.get(slot)


func get_owned_slots() -> Array[int]:
	var slots: Array[int] = []
	for s in _by_slot.keys():
		slots.append(int(s))
	slots.sort()
	return slots


func get_all() -> Array[Weapon]:
	var list: Array[Weapon] = []
	for s in get_owned_slots():
		list.append(_by_slot[s])
	return list


## Reabastece a reserva de todas as armas.
func refill_all() -> void:
	for w in _by_slot.values():
		w.refill_ammo()


## Ao renascer: carregador cheio e munição inicial.
func reset_ammo_all() -> void:
	for w in _by_slot.values():
		w.reset_ammo()
