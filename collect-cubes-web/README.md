# Collect Cubes — Jogo Completo

Jogo arcade 3D em PlayCanvas com Firebase: 5 fases, personagens personalizáveis, multiplayer em tempo real e ranking.

**Jogue:** https://dueuler-collect-cubes.web.app

## Funcionalidades

- **5 fases** com progressão e desbloqueio por pontuação
- **4 personagens 3D** personalizáveis (forma + cor)
- **Modo solo** com ranking persistente
- **Multiplayer** — criar sala, entrar com código, matchmaking automático
- **Até 8 jogadores** por sala com sincronização em tempo real
- **Diagnóstico completo** para debug em produção

## Documentação

- [Guia do Jogador (PT-BR)](GUIA-JOGADOR.md)

## Desenvolvimento

```bash
cd collect-cubes-web
./scripts/build.sh    # Gera lib/playcanvas.mjs
npm test              # 27 testes (níveis, personagens, multiplayer, integração)
```

## Deploy Firebase

```bash
npx -y firebase-tools@latest deploy \
  --only hosting,auth,firestore:rules,database,storage \
  --project dueuler-be03b
```

## Estrutura

```
public/
  js/
    levels.mjs          # Configuração das 5 fases
    characters.mjs      # Personagens e cores
    game.mjs            # Motor 3D (solo + multiplayer)
    bootstrap.mjs       # Menu e fluxos
    multiplayer/
      room-service.mjs  # Salas RTDB + matchmaking
    ui/
      menu-controller.mjs
  assets/icons/         # Ícones SVG
test/                   # Testes Node.js
GUIA-JOGADOR.md         # Guia completo em português
```

## Testes

| Arquivo | Cobertura |
|---------|-----------|
| `test/levels.test.mjs` | Fases, desbloqueio, cubos, obstáculos |
| `test/characters.test.mjs` | Personagens, cores, persistência |
| `test/room-service.test.mjs` | Códigos de sala, prontidão, ranking |
| `test/integration.test.mjs` | Fluxo completo solo + multiplayer |
