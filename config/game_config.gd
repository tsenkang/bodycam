extends Node
## ============================================================================
##  CONFIGURAÇÃO CENTRAL DO JOGO  (autoload "GameConfig")
## ============================================================================
##  Todos os valores de "sensação" do jogo ficam aqui: câmera, movimento,
##  vida, dano por região, partida e áudio.
##
##  - Armas:  res://config/weapon_config.gd
##  - Bots:   res://config/bot_config.gd
##
##  Altere os números abaixo e rode o jogo de novo; nenhum outro script
##  precisa ser editado para ajustar a sensação.
## ============================================================================

# ----------------------------------------------------------------------------
#  CÂMERA (sensação bodycam)
# ----------------------------------------------------------------------------
## Campo de visão base (graus). Bodycams reais usam lentes bem abertas.
var camera_fov: float = 88.0
## Multiplicador geral do balanço da cabeça ao andar (0 desliga).
var head_bob_intensity: float = 1.0
## Multiplicador geral do sway (inércia ao virar e balanço da arma).
var sway_intensity: float = 1.0
## Multiplicador geral do recuo (câmera + arma) de todas as armas.
var recoil_intensity: float = 1.0
## Suavização da câmera: quanto MAIOR, mais rápido os efeitos acompanham.
var camera_smoothing: float = 10.0
## Sensibilidade do mouse (graus por pixel).
var mouse_sensitivity: float = 0.12
## Multiplicador extra da sensibilidade ao mirar.
var ads_sensitivity_multiplier: float = 0.85
## Aumento de FOV durante a corrida (graus).
var sprint_fov_boost: float = 4.0
## Limite de inclinação lateral total da câmera (graus) — evita enjoo.
var max_camera_roll: float = 3.0
## Quanto do movimento da câmera continua ao mirar (0 = nada, 1 = tudo).
var ads_camera_motion: float = 0.3

# Head bob por estado: Vector3(lateral m, vertical m, inclinação graus)
var bob_walk := Vector3(0.022, 0.030, 0.45)
var bob_sprint := Vector3(0.045, 0.055, 1.0)
var bob_crouch := Vector3(0.012, 0.016, 0.25)

## Inclinação da câmera ao andar de lado (graus).
var strafe_tilt: float = 1.6
## Atraso da câmera ao virar (segundos de "inércia"). Maior = mais pesado.
var turn_inertia: float = 0.010
## Deslocamento máximo causado pela inércia ao virar (graus).
var turn_inertia_max: float = 2.2
## Quanto a câmera inclina ao virar rápido.
var turn_roll_factor: float = 0.6
## Respiração quando parado (metros).
var idle_breath: float = 0.004
## Impacto ao pousar (multiplicador).
var landing_impact: float = 1.0
## Mola do impacto de pouso (rigidez / amortecimento).
var landing_spring_stiffness: float = 160.0
var landing_spring_damping: float = 16.0
## Velocidade com que a câmera alcança o recuo (maior = recuo mais "seco").
var recoil_snap: float = 28.0
## Tremor máximo por disparo (graus).
var shake_max_degrees: float = 0.6

# Pós-processamento estilo bodycam (lente, vinheta, granulação)
var bodycam_postfx_enabled: bool = true
var postfx_distortion: float = 0.10
var postfx_vignette: float = 0.45
var postfx_grain: float = 0.035
var postfx_chromatic: float = 0.0015
var postfx_saturation: float = 0.82
## Mostra "● REC 00:00:00" no canto (visual de bodycam).
var show_rec_overlay: bool = true

# ----------------------------------------------------------------------------
#  AMBIENTE / ILUMINAÇÃO / GRÁFICOS
# ----------------------------------------------------------------------------
## Horário da partida: "dia", "entardecer" ou "noite".
var time_of_day: String = "entardecer"
## Qualidade gráfica: "baixa", "media" ou "alta".
##   baixa: sem AO/GI; media: SSAO + SSIL; alta: + SDFGI e neblina volumétrica.
var graphics_quality: String = "media"

var lighting_presets := {
	"dia": {
		"sun_rotation": Vector3(-50.0, -35.0, 0.0),
		"sun_color": Color(1.0, 0.96, 0.9),
		"sun_energy": 1.15,
		"sky_top": Color(0.38, 0.5, 0.66),
		"sky_horizon": Color(0.68, 0.71, 0.74),
		"ground": Color(0.25, 0.24, 0.22),
		"ambient_energy": 0.75,
		"fog_color": Color(0.64, 0.67, 0.7),
		"fog_density": 0.004,
		"exposure": 1.0,
		"street_lights": false,
		"interior_light_energy": 0.8,
		"flashlight_on": false,
	},
	"entardecer": {
		"sun_rotation": Vector3(-19.0, -62.0, 0.0),
		"sun_color": Color(1.0, 0.66, 0.42),
		"sun_energy": 1.1,
		"sky_top": Color(0.2, 0.25, 0.36),
		"sky_horizon": Color(0.78, 0.52, 0.36),
		"ground": Color(0.12, 0.11, 0.1),
		"ambient_energy": 0.9,
		"fog_color": Color(0.55, 0.47, 0.42),
		"fog_density": 0.006,
		"exposure": 1.15,
		"street_lights": true,
		"interior_light_energy": 1.0,
		"flashlight_on": false,
	},
	"noite": {
		"sun_rotation": Vector3(-38.0, 20.0, 0.0),
		"sun_color": Color(0.55, 0.65, 0.9),
		"sun_energy": 0.12,
		"sky_top": Color(0.02, 0.03, 0.06),
		"sky_horizon": Color(0.08, 0.09, 0.13),
		"ground": Color(0.02, 0.02, 0.02),
		"ambient_energy": 0.28,
		"fog_color": Color(0.08, 0.09, 0.12),
		"fog_density": 0.012,
		"exposure": 1.25,
		"street_lights": true,
		"interior_light_energy": 1.0,
		"flashlight_on": true,
	},
}

# Lanterna (tecla F) — presa ao peito como uma bodycam.
var flashlight_energy: float = 3.0
var flashlight_range: float = 28.0
var flashlight_angle: float = 26.0
var flashlight_shadows: bool = true


func get_lighting() -> Dictionary:
	return lighting_presets.get(time_of_day, lighting_presets["entardecer"])


# ----------------------------------------------------------------------------
#  MOVIMENTAÇÃO
# ----------------------------------------------------------------------------
var walk_speed: float = 4.3
var sprint_speed: float = 6.6
var crouch_speed: float = 2.3
var backward_speed_multiplier: float = 0.75
var strafe_speed_multiplier: float = 0.9
## Multiplicador de velocidade ao mirar.
var ads_speed_multiplier: float = 0.62
## Aceleração/desaceleração (m/s²). Menor = mais peso.
var ground_acceleration: float = 26.0
var ground_deceleration: float = 30.0
var sprint_acceleration: float = 14.0
var air_acceleration: float = 5.0
var jump_velocity: float = 4.8
var gravity: float = 15.5
## Queda mínima (m/s) para gerar impacto na câmera.
var landing_min_speed: float = 2.5
var crouch_transition_speed: float = 7.0
var player_height: float = 1.8
var crouch_height: float = 1.15
var player_radius: float = 0.35
var eye_height_stand: float = 1.62
var eye_height_crouch: float = 1.02
## Comprimento de cada passo (metros) — controla ritmo do head bob e passos.
var step_length_walk: float = 0.85
var step_length_sprint: float = 1.25
var step_length_crouch: float = 0.65

# Balanço da arma por estado: Vector2(lateral, vertical) em metros
var weapon_bob_walk := Vector2(0.010, 0.008)
var weapon_bob_sprint := Vector2(0.028, 0.020)
var weapon_bob_crouch := Vector2(0.006, 0.005)
## Quanto a arma "atrasa" ao virar (metros por grau/s).
var weapon_sway_amount: float = 0.00012
var weapon_sway_max: float = 0.035

# ----------------------------------------------------------------------------
#  JOGADOR / VIDA / DANO
# ----------------------------------------------------------------------------
var player_max_health: float = 100.0
## Segundos sem levar dano até a vida começar a regenerar (0 desliga).
var health_regen_delay: float = 5.0
var health_regen_rate: float = 30.0
var player_respawn_delay: float = 4.0
## Armas iniciais (IDs de weapon_config.gd).
var player_start_weapons: Array[StringName] = [&"mp4", &"glock"]
var interaction_distance: float = 2.4

## Multiplicadores de dano por região do corpo.
var damage_multipliers := {
	&"head": 2.0,
	&"torso": 1.0,
	&"arms": 0.8,
	&"legs": 0.75,
}
var friendly_fire: bool = false

# ----------------------------------------------------------------------------
#  PARTIDA (Mata-mata em equipe)
# ----------------------------------------------------------------------------
## Modos disponíveis: nome -> jogadores por equipe.
var match_modes := {
	"1v1": 1,
	"2v2": 2,
	"4v4": 4,
	"6v6": 6,
	"8v8": 8,
}
## Limite de pontos por tamanho de equipe.
var score_limits := {1: 15, 2: 25, 4: 40, 6: 55, 8: 70}
var match_time_limit: float = 600.0
## Modo e dificuldade selecionados (alterados no menu).
var selected_mode: String = "2v2"
var selected_difficulty: int = BotConfig.Difficulty.MEDIUM

var bot_respawn_delay: float = 3.5
## Distância mínima de um inimigo para um spawn ser considerado seguro.
var spawn_safe_distance: float = 16.0
## Proteção (s) logo após renascer.
var spawn_protection_time: float = 1.0
## Multiplicador global do dano dos bots (IGUAL em todas as dificuldades).
var bot_damage_multiplier: float = 0.85

# ----------------------------------------------------------------------------
#  ÁUDIO
# ----------------------------------------------------------------------------
## Pasta onde colocar sons reais: <chave>.ogg / .wav / .mp3
## Se o arquivo não existir, um som placeholder é gerado automaticamente.
var audio_folder: String = "res://assets/audio/"
var master_volume_db: float = 0.0
var sfx_volume_db: float = 0.0
var ambient_volume_db: float = -14.0
var footstep_volume_db: float = -8.0

# ----------------------------------------------------------------------------
#  DEBUG
# ----------------------------------------------------------------------------
## F1 desbloqueia todas as armas (útil para testar).
var debug_unlock_key_enabled: bool = true
## Mostra o estado da IA acima de cada bot.
var debug_show_bot_state: bool = false


# ----------------------------------------------------------------------------
#  Funções auxiliares
# ----------------------------------------------------------------------------
func _ready() -> void:
	InputSetup.register_actions()


func get_team_size() -> int:
	return int(match_modes.get(selected_mode, 2))


func get_score_limit() -> int:
	return int(score_limits.get(get_team_size(), 30))


func get_step_length(move_state: int) -> float:
	match move_state:
		PlayerMovement.MoveState.SPRINT:
			return step_length_sprint
		PlayerMovement.MoveState.CROUCH:
			return step_length_crouch
	return step_length_walk


func get_camera_bob(move_state: int) -> Vector3:
	match move_state:
		PlayerMovement.MoveState.SPRINT:
			return bob_sprint
		PlayerMovement.MoveState.CROUCH:
			return bob_crouch
	return bob_walk


func get_weapon_bob(move_state: int) -> Vector2:
	match move_state:
		PlayerMovement.MoveState.SPRINT:
			return weapon_bob_sprint
		PlayerMovement.MoveState.CROUCH:
			return weapon_bob_crouch
	return weapon_bob_walk
