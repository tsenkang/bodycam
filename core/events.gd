extends Node
## Barramento de eventos global (autoload "Events").
## Os sistemas se comunicam por sinais, sem precisar conhecer uns aos outros.

## Alguém morreu. killer pode ser null.
signal actor_died(victim: Node, killer: Node, weapon_name: String, headshot: bool)
## Um disparo atingiu um alvo (usado pelo hitmarker da HUD).
signal hit_confirmed(attacker: Node, is_kill: bool, is_headshot: bool)
## Barulho no mundo (tiros, passos). A IA usa para "ouvir".
signal noise_emitted(position: Vector3, radius: float, source: Node)
## Impacto de bala (efeitos visuais e sonoros).
signal bullet_impact(position: Vector3, normal: Vector3, surface: StringName)
## Traçante visível de um disparo.
signal tracer(from: Vector3, to: Vector3)
## Texto do indicador de interação ("" esconde).
signal interaction_prompt(text: String)
## Um bot avisou os aliados sobre um inimigo.
signal enemy_spotted(spotter: Node, enemy: Node, position: Vector3)
## Mensagem curta na HUD (ex.: "Arma desbloqueada").
signal hud_message(text: String)
