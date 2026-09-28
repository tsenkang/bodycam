class_name MatchManager
extends Node
## Modo Mata-mata em equipe: cria jogador + bots conforme o modo (1v1 … 8v8),
## conta pontos, controla tempo e renascimentos.

signal score_changed(scores: Array)
signal time_changed(seconds_left: int)
signal kill_feed(killer_name: String, victim_name: String, weapon: String, headshot: bool, killer_team: int, victim_team: int)
signal match_ended(winning_team: int)

var map_data: MapData
var player: Player
var spawn_manager: SpawnManager
var team_size := 2
var difficulty := BotConfig.Difficulty.MEDIUM
var scores := [0, 0]
var score_limit := 25
var time_left := 600.0
var running := false
var bots: Array[Bot] = []

var _last_second := -1
var _names: Array = []


func setup(p_map: MapData, p_player: Player) -> void:
	map_data = p_map
	player = p_player
	team_size = GameConfig.get_team_size()
	difficulty = GameConfig.selected_difficulty
	score_limit = GameConfig.get_score_limit()
	time_left = GameConfig.match_time_limit
	spawn_manager = SpawnManager.new()
	add_child(spawn_manager)
	spawn_manager.setup(map_data)
	Events.actor_died.connect(_on_actor_died)


func start() -> void:
	_names = BotConfig.BOT_NAMES.duplicate()
	_names.shuffle()
	var xf := spawn_manager.get_initial_spawn(0, 0)
	player.respawn(xf)
	# Aliados (equipe 0) e inimigos (equipe 1).
	for i in range(1, team_size):
		_spawn_bot(0, i)
	for i in team_size:
		_spawn_bot(1, i)
	running = true
	score_changed.emit(scores)


func _spawn_bot(team: int, index: int) -> void:
	var bot := Bot.new()
	var bot_name: String = _names.pop_back() if not _names.is_empty() else "Bot %d" % index
	bot.setup(team, bot_name, BotProfile.from_difficulty(difficulty), map_data)
	bot.name = "Bot_%s" % bot_name
	var xf := spawn_manager.get_initial_spawn(team, index)
	bot.transform = xf
	get_parent().add_child(bot)
	bots.append(bot)


func _process(delta: float) -> void:
	if not running:
		return
	time_left -= delta
	var sec := maxi(ceili(time_left), 0)
	if sec != _last_second:
		_last_second = sec
		time_changed.emit(sec)
	if time_left <= 0.0:
		_end_match()


func _on_actor_died(victim: Node, killer: Node, weapon_name: String, headshot: bool) -> void:
	if not running:
		return
	var killer_name := ""
	var killer_team := -1
	if killer and is_instance_valid(killer) and killer != victim:
		killer_name = killer.display_name
		killer_team = killer.team
		if killer.team != victim.team:
			scores[killer.team] += 1
			score_changed.emit(scores)
	kill_feed.emit(killer_name, victim.display_name, weapon_name, headshot, killer_team, victim.team)
	var delay := GameConfig.player_respawn_delay if victim is Player else GameConfig.bot_respawn_delay
	spawn_manager.schedule_respawn(victim, delay)
	if scores[0] >= score_limit or scores[1] >= score_limit:
		_end_match()


func _end_match() -> void:
	if not running:
		return
	running = false
	var winner := -1
	if scores[0] > scores[1]:
		winner = 0
	elif scores[1] > scores[0]:
		winner = 1
	player.input_enabled = false
	for b in bots:
		b.set_physics_process(false)
	match_ended.emit(winner)
