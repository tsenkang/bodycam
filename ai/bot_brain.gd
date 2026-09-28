class_name BotBrain
extends RefCounted
## Máquina de estados da IA. Cada comportamento é um BotState separado
## (ai/states/), então adicionar um novo tipo de inimigo = criar/combinar
## estados, sem mexer nos existentes.
##
##   patrol ──(ouviu)──▶ investigate ──▶ search ──▶ patrol
##     │                                   ▲
##     └──(viu inimigo)──▶ combat ──(perdeu)──▶ chase / flank ──▶ search
##                           │  ▲
##                           ▼  │
##                           cover (recarregar / vida baixa)

var bot: Bot
var states := {}
var current: BotState
var current_name: StringName = &""
var _think_timer := 0.0


func _init(p_bot: Bot) -> void:
	bot = p_bot
	_register(&"patrol", PatrolState.new())
	_register(&"investigate", InvestigateState.new())
	_register(&"search", SearchState.new())
	_register(&"combat", CombatState.new())
	_register(&"cover", CoverState.new())
	_register(&"chase", ChaseState.new())
	_register(&"flank", FlankState.new())


func _register(state_name: StringName, state: BotState) -> void:
	state.bot = bot
	state.brain = self
	states[state_name] = state


func change_state(state_name: StringName, params := {}) -> void:
	if current:
		current.exit()
	current_name = state_name
	current = states[state_name]
	current.enter(params)
	bot.on_state_changed(current_name)


func reset() -> void:
	_think_timer = randf() * 0.3
	change_state(&"patrol")


func tick(delta: float) -> void:
	if current == null:
		return
	current.update(delta)
	_think_timer -= delta
	if _think_timer > 0.0:
		return
	# Tempo de decisão depende da dificuldade (com um pouco de variação).
	_think_timer = bot.profile.decision_interval * randf_range(0.8, 1.2)
	# Regra global: viu um inimigo e o estado atual não trata disso → combate.
	if bot.perception.target_visible and not current.handles_enemy:
		change_state(&"combat")
		return
	current.think()
