class_name Health
extends Node
## Componente de vida reutilizável (jogador e bots).

signal health_changed(current: float, maximum: float)
signal damaged(amount: float, source: Node, region: StringName)
signal died(killer: Node)

var max_health := 100.0
var current := 100.0
## Regeneração: segundos sem dano antes de regenerar (0 = desligado).
var regen_delay := 0.0
var regen_rate := 0.0
var last_region: StringName = &"torso"
var last_attacker: Node = null

var _since_damage := 0.0
var _invulnerable := 0.0


func _ready() -> void:
	set_process(false)


func setup(maximum: float, p_regen_delay := 0.0, p_regen_rate := 0.0) -> void:
	max_health = maximum
	regen_delay = p_regen_delay
	regen_rate = p_regen_rate
	reset()


func reset() -> void:
	current = max_health
	last_attacker = null
	_since_damage = 0.0
	health_changed.emit(current, max_health)
	set_process(false)


func is_dead() -> bool:
	return current <= 0.0


func set_invulnerable(seconds: float) -> void:
	_invulnerable = seconds
	set_process(true)


## Aplica dano. Retorna true se este dano matou.
func take_damage(amount: float, source: Node = null, region: StringName = &"torso") -> bool:
	if is_dead() or amount <= 0.0 or _invulnerable > 0.0:
		return false
	current = maxf(current - amount, 0.0)
	last_region = region
	if source:
		last_attacker = source
	_since_damage = 0.0
	damaged.emit(amount, source, region)
	health_changed.emit(current, max_health)
	if current <= 0.0:
		set_process(false)
		died.emit(source)
		return true
	# Só processa por frame quando precisa regenerar (otimização).
	set_process(regen_rate > 0.0)
	return false


func heal(amount: float) -> void:
	if is_dead():
		return
	current = minf(current + amount, max_health)
	health_changed.emit(current, max_health)


func _process(delta: float) -> void:
	if _invulnerable > 0.0:
		_invulnerable -= delta
	if regen_rate <= 0.0 or is_dead():
		if _invulnerable <= 0.0:
			set_process(false)
		return
	_since_damage += delta
	if _since_damage >= regen_delay:
		heal(regen_rate * delta)
		if current >= max_health and _invulnerable <= 0.0:
			set_process(false)
