extends Node
## Ponto de entrada: alterna entre o menu principal e a partida.

var _game: Game
var _menu: MainMenu


func _ready() -> void:
	_show_menu()


func _show_menu() -> void:
	_clear_game()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_menu = MainMenu.new()
	add_child(_menu)
	_menu.start_requested.connect(_start_game)


func _start_game() -> void:
	if _menu:
		_menu.queue_free()
		_menu = null
	_clear_game()
	_game = Game.new()
	_game.name = "Game"
	_game.exit_to_menu.connect(_show_menu, CONNECT_DEFERRED)
	_game.restart.connect(_start_game, CONNECT_DEFERRED)
	add_child(_game)


func _clear_game() -> void:
	get_tree().paused = false
	if _game:
		remove_child(_game)
		_game.queue_free()
		_game = null
