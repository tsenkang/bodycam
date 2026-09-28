class_name WeaponConfig
extends RefCounted
## ============================================================================
##  CONFIGURAÇÃO DAS ARMAS — todos os números das armas ficam SÓ aqui.
## ============================================================================
##  Para criar uma arma nova:
##    1. Copie um bloco abaixo, mude o ID e os valores.
##    2. Crie um script em res://weapons/types/ que faça "extends Weapon"
##       (ou reaproveite um existente) e aponte "script_path" para ele.
##    3. Coloque um WeaponLocker no mapa ou adicione o ID em
##       GameConfig.player_start_weapons.
##
##  Legenda dos campos:
##    fire_mode ........ "auto", "semi", "pump" (espingarda) ou "bolt" (ferrolho)
##    damage ........... dano por projétil (a espingarda dispara vários "pellets")
##    fire_rate ........ cadência em disparos por minuto (RPM)
##    magazine_size .... capacidade do carregador
##    reserve_ammo ..... munição reserva inicial / max_reserve = limite
##    reload_time ...... recarga tática (ainda há bala na câmara)
##    reload_empty_time  recarga com carregador vazio
##    reload_commit .... fração da recarga em que a munição entra (0..1).
##                       Antes disso não é possível atirar.
##    effective_range .. até essa distância o dano é total
##    max_range ........ alcance máximo do raio
##    min_damage_ratio . fração do dano no alcance máximo
##    accuracy ......... precisão 0..1 (1 = sem penalidade de dispersão)
##    hip_spread ....... dispersão sem mirar (graus)
##    ads_spread ....... dispersão mirando (graus)
##    move_spread ...... dispersão extra em movimento
##    bloom_per_shot ... dispersão extra acumulada por disparo
##    recoil_vertical .. recuo vertical por disparo (graus)
##    recoil_horizontal  recuo horizontal aleatório (graus)
##    recoil_recovery .. velocidade de recuperação (graus/s). Menor = lenta
##    recoil_aim_carry . parte do recuo que fica na mira (o jogador compensa)
##    ads_zoom ......... zoom ao mirar (FOV / ads_zoom)
##    ads_time ......... tempo para levantar a arma e mirar
##    weight ........... peso (kg) — afeta balanço, inércia e troca
##    move_speed_mult .. multiplicador de velocidade segurando a arma
##    sight ............ "iron" (mira simples) ou "scope" (luneta)
##    model_scene ...... modelo 3D (.glb/.tscn). Vazio = modelo simples gerado
##    model_rotation ... rotação (graus) para o cano apontar para -Z
##    model_length ..... comprimento real da arma em metros
##    model_rear_fraction quanto da arma fica atrás do ponto de empunhadura
##    model_sight_drop . abaixa a linha de mira a partir do topo do modelo (m)
##    model_offset ..... ajuste fino da posição do modelo
##    model_hidden_bones ossos para esconder (partes extras do modelo)
## ============================================================================

const WEAPONS := {
	# ------------------------------------------------------------------
	&"mp4": {
		"display_name": "MP4",
		"category": "Submetralhadora",
		"script_path": "res://weapons/types/mp4.gd",
		"slot": 1,
		"fire_mode": "auto",
		"damage": 25.0,
		"fire_rate": 780.0,
		"pellets": 1,
		"magazine_size": 30,
		"reserve_ammo": 120,
		"max_reserve": 180,
		"reload_time": 2.0,
		"reload_empty_time": 2.45,
		"reload_commit": 0.72,
		"effective_range": 20.0,
		"max_range": 150.0,
		"min_damage_ratio": 0.65,
		"accuracy": 0.8,
		"hip_spread": 2.4,
		"ads_spread": 0.35,
		"move_spread": 1.2,
		"bloom_per_shot": 0.3,
		"max_bloom": 2.2,
		"bloom_recovery": 7.0,
		"recoil_vertical": 0.75,
		"recoil_horizontal": 0.35,
		"recoil_horizontal_bias": 0.1,
		"recoil_recovery": 9.0,
		"recoil_aim_carry": 0.35,
		"ads_recoil_mult": 0.8,
		"visual_kick": 0.028,
		"visual_kick_rotation": 2.5,
		"camera_shake": 0.18,
		"ads_zoom": 1.25,
		"ads_time": 0.2,
		"weight": 2.9,
		"move_speed_mult": 0.98,
		"draw_time": 0.45,
		"holster_time": 0.3,
		"noise_radius": 45.0,
		"sight": "iron",
		"model_type": "smg",
		"model_color": Color(0.16, 0.17, 0.18),
		"model_scene": "res://assets/models/weapons/mp4_m4_free.glb",
		"model_rotation": Vector3(0.0, 180.0, 0.0),
		"model_length": 0.84,
		"model_rear_fraction": 0.42,
		"model_sight_drop": 0.012,
		"model_offset": Vector3(0.0, 0.0, 0.0),
		"model_hidden_bones": [],
		"hip_position": Vector3(0.17, -0.19, -0.42),
		"ads_distance": 0.42,
		"sprint_rotation": Vector3(-12.0, 38.0, 14.0),
		"sound_fire": "mp4_fire",
		"sound_reload": "reload_mag",
		"sound_draw": "weapon_draw",
		"sound_empty": "empty_click",
		"sound_action": "",
	},
	# ------------------------------------------------------------------
	&"glock": {
		"display_name": "GL-9",  # pistola semiautomática (nome genérico)
		"category": "Pistola",
		"script_path": "res://weapons/types/glock.gd",
		"slot": 2,
		"fire_mode": "semi",
		"damage": 21.0,
		"fire_rate": 420.0,
		"pellets": 1,
		"magazine_size": 17,
		"reserve_ammo": 68,
		"max_reserve": 102,
		"reload_time": 1.45,
		"reload_empty_time": 1.75,
		"reload_commit": 0.7,
		"effective_range": 14.0,
		"max_range": 100.0,
		"min_damage_ratio": 0.6,
		"accuracy": 0.85,
		"hip_spread": 1.8,
		"ads_spread": 0.3,
		"move_spread": 0.8,
		"bloom_per_shot": 0.45,
		"max_bloom": 2.0,
		"bloom_recovery": 8.0,
		"recoil_vertical": 1.1,
		"recoil_horizontal": 0.35,
		"recoil_horizontal_bias": 0.0,
		"recoil_recovery": 12.0,
		"recoil_aim_carry": 0.2,
		"ads_recoil_mult": 0.85,
		"visual_kick": 0.03,
		"visual_kick_rotation": 6.0,
		"camera_shake": 0.12,
		"ads_zoom": 1.15,
		"ads_time": 0.14,
		"weight": 0.9,
		"move_speed_mult": 1.04,
		"draw_time": 0.3,
		"holster_time": 0.2,
		"noise_radius": 38.0,
		"sight": "iron",
		"model_type": "pistol",
		"model_color": Color(0.12, 0.12, 0.13),
		"model_scene": "res://assets/models/weapons/glock_scifi_pistol.glb",
		"model_rotation": Vector3(0.0, -90.0, 0.0),
		"model_length": 0.22,
		"model_rear_fraction": 0.30,
		"model_sight_drop": 0.004,
		"model_offset": Vector3(0.0, 0.0, 0.0),
		"model_hidden_bones": [],
		"hip_position": Vector3(0.14, -0.16, -0.40),
		"ads_distance": 0.42,
		"sprint_rotation": Vector3(22.0, 10.0, 6.0),
		"sound_fire": "glock_fire",
		"sound_reload": "reload_pistol",
		"sound_draw": "weapon_draw",
		"sound_empty": "empty_click",
		"sound_action": "",
	},
	# ------------------------------------------------------------------
	&"shotgun": {
		"display_name": "Escopeta M12",
		"category": "Espingarda",
		"script_path": "res://weapons/types/shotgun.gd",
		"slot": 3,
		"fire_mode": "pump",
		"damage": 17.0,  # por pellet
		"fire_rate": 70.0,
		"pellets": 8,
		"pellet_spread": 5.0,
		"magazine_size": 6,
		"reserve_ammo": 30,
		"max_reserve": 42,
		"reload_time": 0.5,  # tempo por cartucho
		"reload_empty_time": 0.5,
		"reload_commit": 0.6,
		"reload_start_time": 0.35,
		"reload_end_time": 0.4,
		"effective_range": 8.0,
		"max_range": 45.0,
		"min_damage_ratio": 0.1,
		"accuracy": 0.7,
		"hip_spread": 5.0,
		"ads_spread": 3.6,
		"move_spread": 1.0,
		"bloom_per_shot": 0.0,
		"max_bloom": 0.0,
		"bloom_recovery": 10.0,
		"recoil_vertical": 5.5,
		"recoil_horizontal": 1.2,
		"recoil_horizontal_bias": 0.0,
		"recoil_recovery": 10.0,
		"recoil_aim_carry": 0.25,
		"ads_recoil_mult": 0.85,
		"visual_kick": 0.075,
		"visual_kick_rotation": 11.0,
		"camera_shake": 0.55,
		"ads_zoom": 1.15,
		"ads_time": 0.24,
		"weight": 3.6,
		"move_speed_mult": 0.95,
		"draw_time": 0.5,
		"holster_time": 0.35,
		"noise_radius": 50.0,
		"sight": "iron",
		"model_type": "shotgun",
		"model_color": Color(0.14, 0.13, 0.12),
		"model_scene": "res://assets/models/weapons/shotgun_escopeta.glb",
		"model_rotation": Vector3(0.0, -90.0, 0.0),
		"model_length": 0.98,
		"model_rear_fraction": 0.40,
		"model_sight_drop": -0.03,
		"model_offset": Vector3(0.0, 0.0, 0.0),
		"model_hidden_bones": [],
		"hip_position": Vector3(0.17, -0.20, -0.44),
		"ads_distance": 0.55,
		"sprint_rotation": Vector3(-14.0, 40.0, 16.0),
		"sound_fire": "shotgun_fire",
		"sound_reload": "reload_shell",
		"sound_draw": "weapon_draw",
		"sound_empty": "empty_click",
		"sound_action": "pump",
	},
	# ------------------------------------------------------------------
	&"ak47": {
		"display_name": "AK-47",
		"category": "Fuzil de assalto",
		"script_path": "res://weapons/types/ak47.gd",
		"slot": 4,
		"fire_mode": "auto",
		"damage": 33.0,
		"fire_rate": 600.0,
		"pellets": 1,
		"magazine_size": 30,
		"reserve_ammo": 90,
		"max_reserve": 150,
		"reload_time": 2.4,
		"reload_empty_time": 2.9,
		"reload_commit": 0.7,
		"effective_range": 35.0,
		"max_range": 200.0,
		"min_damage_ratio": 0.75,
		"accuracy": 0.7,
		"hip_spread": 3.2,
		"ads_spread": 0.3,
		"move_spread": 1.8,
		"bloom_per_shot": 0.45,
		"max_bloom": 3.0,
		"bloom_recovery": 5.0,
		"recoil_vertical": 1.3,
		"recoil_horizontal": 0.75,
		"recoil_horizontal_bias": 0.35,
		"recoil_recovery": 6.5,
		"recoil_aim_carry": 0.55,
		"ads_recoil_mult": 0.85,
		"visual_kick": 0.04,
		"visual_kick_rotation": 3.5,
		"camera_shake": 0.3,
		"ads_zoom": 1.35,
		"ads_time": 0.27,
		"weight": 3.9,
		"move_speed_mult": 0.93,
		"draw_time": 0.55,
		"holster_time": 0.35,
		"noise_radius": 55.0,
		"sight": "iron",
		"model_type": "rifle",
		"model_color": Color(0.13, 0.13, 0.12),
		"model_scene": "res://assets/models/weapons/ak47.glb",
		"model_rotation": Vector3(0.0, 0.0, 0.0),
		"model_length": 0.88,
		"model_rear_fraction": 0.42,
		"model_sight_drop": 0.025,
		"model_offset": Vector3(-0.12, 0.0, 0.0),
		"model_hidden_bones": ["Bone.002_01"],
		"hip_position": Vector3(0.17, -0.20, -0.44),
		"ads_distance": 0.38,
		"sprint_rotation": Vector3(-14.0, 40.0, 16.0),
		"sound_fire": "ak47_fire",
		"sound_reload": "reload_mag",
		"sound_draw": "weapon_draw",
		"sound_empty": "empty_click",
		"sound_action": "",
	},
	# ------------------------------------------------------------------
	&"sniper": {
		"display_name": "Rifle de precisão SR-7",
		"category": "Rifle de precisão",
		"script_path": "res://weapons/types/sniper.gd",
		"slot": 5,
		"fire_mode": "bolt",
		"damage": 110.0,
		"fire_rate": 44.0,
		"pellets": 1,
		"magazine_size": 5,
		"reserve_ammo": 20,
		"max_reserve": 30,
		"reload_time": 3.0,
		"reload_empty_time": 3.4,
		"reload_commit": 0.75,
		"effective_range": 120.0,
		"max_range": 300.0,
		"min_damage_ratio": 0.9,
		"accuracy": 1.0,
		"hip_spread": 7.0,
		"ads_spread": 0.0,
		"move_spread": 3.0,
		"bloom_per_shot": 0.0,
		"max_bloom": 0.0,
		"bloom_recovery": 5.0,
		"recoil_vertical": 5.0,
		"recoil_horizontal": 0.8,
		"recoil_horizontal_bias": 0.0,
		"recoil_recovery": 2.6,  # recuperação lenta
		"recoil_aim_carry": 0.3,
		"ads_recoil_mult": 1.0,
		"visual_kick": 0.08,
		"visual_kick_rotation": 9.0,
		"camera_shake": 0.6,
		"ads_zoom": 4.0,
		"ads_time": 0.38,
		"weight": 5.8,
		"move_speed_mult": 0.88,
		"draw_time": 0.65,
		"holster_time": 0.4,
		"noise_radius": 70.0,
		"sight": "scope",
		"model_type": "sniper",
		"model_color": Color(0.2, 0.22, 0.18),
		"model_scene": "res://assets/models/weapons/sniper_sr.glb",
		"model_rotation": Vector3(0.0, 180.0, 0.0),
		"model_length": 1.18,
		"model_rear_fraction": 0.42,
		"model_sight_drop": 0.030,
		"model_offset": Vector3(0.0, 0.0, 0.0),
		"model_hidden_bones": [],
		"hip_position": Vector3(0.17, -0.20, -0.44),
		"ads_distance": 0.32,
		"sprint_rotation": Vector3(-14.0, 42.0, 16.0),
		"sound_fire": "sniper_fire",
		"sound_reload": "reload_mag",
		"sound_draw": "weapon_draw",
		"sound_empty": "empty_click",
		"sound_action": "bolt",
	},
}


static func has_weapon(id: StringName) -> bool:
	return WEAPONS.has(id)


static func get_ids_by_slot() -> Array[StringName]:
	var ids: Array[StringName] = []
	for id in WEAPONS:
		ids.append(id)
	ids.sort_custom(func(a, b): return int(WEAPONS[a].slot) < int(WEAPONS[b].slot))
	return ids
