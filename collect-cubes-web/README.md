# Collect Cubes — Web + Firebase

Hosting dedicado do mini-jogo **Collect Cubes** com backend Firebase no projeto `dueuler-be03b`.

## URL de produção

- https://dueuler-collect-cubes.web.app

## Stack Firebase

| Serviço | Uso |
|---------|-----|
| **Authentication** | Google + login anônimo (convidado) |
| **Firestore** | Perfil, progresso por fase, ranking persistente |
| **Realtime Database** | Ranking ao vivo + presença online |
| **Storage** | JSON de fases customizadas e thumbnails (futuro criador) |
| **Hosting** | Site estático (`dueuler-collect-cubes`) |

## Modelo de dados

### Firestore

```
users/{uid}
  displayName, photoURL, isAnonymous, updatedAt

users/{uid}/progress/{levelId}
  bestScore, lastScore, timeLeft, completedAt

leaderboards/{levelId}/scores/{uid}
  score, displayName, photoURL, updatedAt

levels/{levelId}            # fases oficiais (somente leitura no cliente)
```

### Realtime Database

```
collectCubes/leaderboards/{levelId}/scores/{uid}
collectCubes/presence/{uid}
```

### Storage

```
collect-cubes/levels/{uid}/{levelId}.json
collect-cubes/thumbnails/{uid}/{levelId}.png
```

## Desenvolvimento local

```bash
./scripts/build.sh
npx serve public -l 8080
```

## Deploy

```bash
./scripts/build.sh
npx -y firebase-tools@latest deploy --only hosting,firestore:rules,storage,database,auth --project dueuler-be03b
```

## Estrutura

```
collect-cubes-web/
  public/
    js/firebase/     # Auth, Firestore, RTDB, Storage
    js/bootstrap.mjs # Menu + login + ranking
    js/game.mjs      # Loop do jogo
  firestore.rules
  storage.rules
  database.rules.json
  firebase.json
```
