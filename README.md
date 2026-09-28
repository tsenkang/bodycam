# Bodycam FPS — Protótipo (Godot 4.7)

FPS original com câmera e movimentação no estilo **bodycam**. O modo de jogo é mata-mata em equipe (1v1 até 8v8) contra bots com IA, num mapa compacto.
Todo o conteúdo é original e placeholder: formas simples, sons sintetizados e nomes genéricos.

## Como rodar

1. Baixe o **Godot 4.7.2 (Standard)** em <https://godotengine.org/download>. Não precisa instalar: é só descompactar e abrir.
2. No Project Manager, clique em **Import** e escolha o `project.godot` desta pasta.
3. Aperte **F5**. No menu, escolha a dificuldade e o tamanho da partida e clique em **JOGAR**.

| Controle | Ação |
|---|---|
| WASD | mover |
| Shift | correr |
| C (alterna) / Ctrl (segurar) | agachar |
| Espaço | pular |
| Botão esquerdo | atirar |
| Botão direito | mirar |
| R | recarregar |
| E | interagir (portas / armários de arma) |
| 1–5 / roda do mouse | trocar arma |
| Q | arma anterior |
| Esc | pausar |
| F1 | *debug*: desbloqueia todas as armas |

## Onde mudar os números (configuração central)

| Arquivo | O que controla |
|---|---|
| `config/game_config.gd` | câmera (FOV, head bob, sway, recoil, suavização), movimento, vida, dano por região, partida, áudio |
| `config/weapon_config.gd` | **todas** as estatísticas das 5 armas |
| `config/bot_config.gd` | as dificuldades Fácil/Médio/Difícil (reação, precisão, detecção, cobertura, flanco…) |

Nenhum valor de gameplay fica espalhado pelos outros scripts.

## Arquitetura

```
project.godot
config/      game_config.gd (autoload GameConfig) · weapon_config.gd · bot_config.gd
core/        events.gd (autoload Events — barramento de sinais) · audio_manager.gd (autoload)
             placeholder_sounds.gd · ballistics.gd (tiro hitscan) · impact_effects.gd · layers.gd · input_setup.gd
components/  health.gd · hitbox.gd (cabeça/tronco/braços/pernas) · humanoid_rig.gd
player/      player.gd · player_movement.gd · bodycam_camera.gd · interactor.gd
weapons/     weapon.gd (classe base) · weapon_data.gd · weapon_manager.gd · inventory.gd
             weapon_model_builder.gd · weapon_context.gd
             types/ mp4.gd · glock.gd · shotgun.gd · ak47.gd · sniper.gd   (todas "extends Weapon")
ai/          bot.gd · bot_brain.gd (máquina de estados) · bot_perception.gd · bot_combat.gd
             bot_profile.gd · cover_finder.gd
             states/ patrol · investigate · search · combat · cover · chase · flank
map/         map_builder.gd (mapa + navmesh) · map_data.gd · door.gd · weapon_locker.gd
match/       match_manager.gd (pontos, tempo, modos) · spawn_manager.gd (spawn seguro/respawn)
ui/          hud.gd · crosshair.gd · main_menu.gd · pause_menu.gd
shaders/     bodycam_postfx.gdshader (lente/vinheta/granulação) · scope.gdshader
scenes/      main.tscn + main.gd (menu ↔ partida) · game.gd (monta a partida)
```

Os sistemas conversam por sinais (`Events`) e por pequenas interfaces, sem se conhecerem diretamente:

- **Combatente:** tanto `Player` quanto `Bot` expõem `team`, `is_alive()`, `get_chest_position()`, `respawn()`… A IA, o spawn e a partida funcionam igual para os dois.
- **Tiro:** jogador e bots usam o mesmo `Ballistics.fire_ray` e as mesmas estatísticas das armas.
- **Por frame:** só roda o que precisa. A visão dos bots checa em intervalos, a regeneração de vida só processa quando necessária, e sons, impactos e traçantes vêm de *pools* reaproveitados.

### Adicionar uma arma nova
1. Copie um bloco em `config/weapon_config.gd` e dê um ID novo.
2. Crie `weapons/types/minha_arma.gd` com `extends Weapon` e `_init(): weapon_id = &"minha_arma"`. Sobrescreva só o que mudar, por exemplo `_compute_recoil`, `_on_fired` ou a recarga.
3. Coloque um `WeaponLocker` no mapa (`map_builder.gd`) ou adicione o ID em `GameConfig.player_start_weapons`.

### Adicionar um tipo de inimigo
Crie um perfil novo em `BotConfig.PROFILES`. Se o comportamento for diferente, crie um estado em `ai/states/` (`extends BotState`) e registre no `BotBrain`.

## Mapa ("Distrito 7")
O mapa tem cerca de 96 × 76 m e é espelhado, então é justo para as duas equipes. Tem três rotas principais:

- **Rua Norte:** distância longa, carros como cobertura, plataformas elevadas com rampa.
- **Rua Central + praça:** o monumento bloqueia a linha de visão do meio.
- **Armazém:** combate de perto, com corredores, prateleiras e portas.

As rotas alternativas passam pelos prédios (portas e janelas), pelo beco sul e pelos vãos entre os prédios. A navmesh é gerada automaticamente quando a partida começa.

**Armas desbloqueáveis** ficam em armários com faixa colorida, e cada lado tem os seus:
- Escopeta: armazém.
- AK-47: prédio norte.
- Rifle de precisão: plataforma elevada.

## Substituindo placeholders
- **Sons:** coloque arquivos em `assets/audio/` com o nome da chave (`mp4_fire.ogg`, `reload_mag.wav`, `footstep.ogg`, `ambient.ogg`…). A lista completa está em `core/placeholder_sounds.gd`. Quando o arquivo existe, ele tem prioridade sobre o som sintetizado.
- **Modelos de arma:** preencha `model_scene` no `weapon_config.gd` com o caminho de um `.tscn`/`.glb`. O modelo deve apontar para −Z, ter a linha de mira em x = 0 e um nó `Muzzle`.
- **Personagens:** troque as malhas em `components/humanoid_rig.gd`, mantendo as hitboxes.

## Próximos passos sugeridos
Animações com esqueleto, modelos 3D reais, sons gravados, mais modos de jogo, opções de controle no menu, *slide*/*lean* e otimização de LOD.
