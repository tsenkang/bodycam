class_name BotState
extends RefCounted
## Estado base da IA.
##  enter/exit ... ao entrar/sair do estado
##  update ....... todo frame de física (leve: mirar, olhar)
##  think ........ no intervalo de decisão (decisões e caminhos)

var bot: Bot
var brain: BotBrain
## Se true, o estado cuida sozinho de inimigos visíveis.
var handles_enemy := false


func enter(_params: Dictionary) -> void:
	pass


func exit() -> void:
	pass


func update(_delta: float) -> void:
	pass


func think() -> void:
	pass


# Atalhos
func perception() -> BotPerception:
	return bot.perception


func profile() -> BotProfile:
	return bot.profile


func now() -> float:
	return BotPerception.now()
