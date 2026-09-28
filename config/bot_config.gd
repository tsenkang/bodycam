class_name BotConfig
extends RefCounted
## ============================================================================
##  CONFIGURAÇÃO DOS BOTS — todas as dificuldades ficam SÓ aqui.
## ============================================================================
##  A dificuldade NÃO aumenta o dano. O dano dos bots é o dano da arma
##  multiplicado por GameConfig.bot_damage_multiplier, igual para todos.
##  A diferença vem de reação, precisão, detecção, movimento, cobertura,
##  flanqueamento, tempo de decisão e capacidade de procurar o inimigo.
##
##  Legenda:
##    reaction_time ........ segundos entre ver o inimigo e o 1º disparo
##    damage_reaction_time . segundos para reagir quando leva dano
##    detection_range ...... alcance máximo da visão (m)
##    detection_time ....... segundos de exposição para detectar (média distância)
##    fov_degrees .......... campo de visão do bot
##    hearing_multiplier ... alcance da audição (0 = surdo)
##    reacts_to_gunshots ... investiga sons de disparo?
##    aim_error_deg ........ erro de mira base (graus). Menor = mais preciso
##    initial_error_mult ... erro extra ao começar a mirar num alvo
##    aim_settle_time ...... tempo para a mira "assentar" no alvo
##    moving_target_penalty  erro extra contra alvos em movimento
##    headshot_chance ...... chance de mirar na cabeça
##    burst_shots .......... tamanho da rajada (mín, máx)
##    burst_pause .......... pausa entre rajadas (mín, máx) em segundos
##    turn_speed_deg ....... velocidade de giro (graus/s)
##    decision_interval .... intervalo entre decisões (s). Menor = mais esperto
##    perception_interval .. intervalo entre verificações de visão (s)
##    cover_usage .......... 0..1 frequência de uso de cobertura
##    flank_chance ......... 0..1 chance de flanquear ao perder o alvo
##    strafe_skill ......... 0..1 qualidade da movimentação em combate
##    reposition_interval .. s entre trocas de posição em combate (0 = nunca)
##    chase_enabled ........ persegue o inimigo?
##    max_chase_distance ... distância máxima de perseguição (m)
##    search_time .......... tempo procurando o inimigo perdido (s)
##    prediction ........... prevê para onde o inimigo foi (s à frente)
##    aggression ........... 0..1 tendência a caçar inimigos pelo mapa
##    team_callouts ........ avisa aliados próximos quando vê um inimigo
##    move_speed_mult ...... velocidade de deslocamento
##    weapon_pool .......... armas que o bot pode receber
## ============================================================================

enum Difficulty { EASY, MEDIUM, HARD }

const DIFFICULTY_NAMES := {
	Difficulty.EASY: "Fácil",
	Difficulty.MEDIUM: "Médio",
	Difficulty.HARD: "Difícil",
}

const PROFILES := {
	# ------------------------------------------------------------------
	#  FÁCIL — iniciantes: lentos, imprecisos, pouco táticos.
	# ------------------------------------------------------------------
	Difficulty.EASY: {
		"reaction_time": 0.85,
		"damage_reaction_time": 1.1,
		"detection_range": 30.0,
		"detection_time": 1.3,
		"fov_degrees": 95.0,
		"hearing_multiplier": 0.35,
		"reacts_to_gunshots": false,
		"aim_error_deg": 5.5,
		"initial_error_mult": 2.2,
		"aim_settle_time": 1.6,
		"moving_target_penalty": 1.2,
		"headshot_chance": 0.02,
		"burst_shots": Vector2i(2, 4),
		"burst_pause": Vector2(0.5, 1.0),
		"turn_speed_deg": 130.0,
		"decision_interval": 0.6,
		"perception_interval": 0.3,
		"cover_usage": 0.12,
		"flank_chance": 0.0,
		"strafe_skill": 0.15,
		"reposition_interval": 0.0,
		"chase_enabled": true,
		"max_chase_distance": 12.0,
		"search_time": 3.0,
		"prediction": 0.0,
		"aggression": 0.25,
		"team_callouts": false,
		"move_speed_mult": 0.9,
		"weapon_pool": [&"mp4", &"mp4", &"glock", &"ak47"],
	},
	# ------------------------------------------------------------------
	#  MÉDIO — desafio equilibrado.
	# ------------------------------------------------------------------
	Difficulty.MEDIUM: {
		"reaction_time": 0.45,
		"damage_reaction_time": 0.55,
		"detection_range": 42.0,
		"detection_time": 0.75,
		"fov_degrees": 110.0,
		"hearing_multiplier": 0.7,
		"reacts_to_gunshots": true,
		"aim_error_deg": 3.2,
		"initial_error_mult": 1.8,
		"aim_settle_time": 1.0,
		"moving_target_penalty": 0.8,
		"headshot_chance": 0.08,
		"burst_shots": Vector2i(3, 6),
		"burst_pause": Vector2(0.3, 0.65),
		"turn_speed_deg": 220.0,
		"decision_interval": 0.4,
		"perception_interval": 0.2,
		"cover_usage": 0.4,
		"flank_chance": 0.15,
		"strafe_skill": 0.55,
		"reposition_interval": 6.0,
		"chase_enabled": true,
		"max_chase_distance": 35.0,
		"search_time": 6.0,
		"prediction": 0.5,
		"aggression": 0.5,
		"team_callouts": true,
		"move_speed_mult": 1.0,
		"weapon_pool": [&"mp4", &"ak47", &"ak47", &"shotgun"],
	},
	# ------------------------------------------------------------------
	#  DIFÍCIL — rápidos, táticos e agressivos (mas sem dano extra).
	# ------------------------------------------------------------------
	Difficulty.HARD: {
		"reaction_time": 0.24,
		"damage_reaction_time": 0.22,
		"detection_range": 58.0,
		"detection_time": 0.4,
		"fov_degrees": 125.0,
		"hearing_multiplier": 1.0,
		"reacts_to_gunshots": true,
		"aim_error_deg": 1.8,
		"initial_error_mult": 1.6,
		"aim_settle_time": 0.6,
		"moving_target_penalty": 0.5,
		"headshot_chance": 0.18,
		"burst_shots": Vector2i(4, 9),
		"burst_pause": Vector2(0.15, 0.4),
		"turn_speed_deg": 340.0,
		"decision_interval": 0.25,
		"perception_interval": 0.12,
		"cover_usage": 0.7,
		"flank_chance": 0.5,
		"strafe_skill": 0.9,
		"reposition_interval": 4.0,
		"chase_enabled": true,
		"max_chase_distance": 999.0,
		"search_time": 10.0,
		"prediction": 1.0,
		"aggression": 0.8,
		"team_callouts": true,
		"move_speed_mult": 1.05,
		"weapon_pool": [&"mp4", &"ak47", &"ak47", &"shotgun", &"sniper"],
	},
}

## Movimento dos bots (m/s) — comum a todas as dificuldades.
const BOT_WALK_SPEED := 3.0
const BOT_RUN_SPEED := 5.6
const BOT_CROUCH_SPEED := 1.8
const BOT_ACCELERATION := 18.0

## Nomes (fictícios) usados pelos bots.
const BOT_NAMES := [
	"Falcão", "Vulto", "Ranger", "Coruja", "Tanque", "Raio", "Sombra", "Lince",
	"Brasa", "Cobra", "Nômade", "Granito", "Eco", "Faísca", "Trovão", "Cinza",
	"Areia", "Corvo", "Pardal", "Titã",
]
