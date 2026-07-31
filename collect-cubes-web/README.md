# Collect Cubes — Web

Hosting dedicado e independente para o mini-jogo **Collect Cubes**.

## Estrutura

```
collect-cubes-web/
  public/           # Site estático publicado no Firebase
  firebase.json     # Config do site dueuler-collect-cubes
  scripts/build.sh  # Copia engine + fontes para public/
```

## Build local

```bash
./scripts/build.sh
npx serve public -l 8080
```

## Deploy (Firebase)

Site: **https://dueuler-collect-cubes.web.app**

```bash
./scripts/build.sh
npx -y firebase-tools@latest deploy --only hosting --project dueuler-be03b
```

## URL de produção

- https://dueuler-collect-cubes.web.app
- https://dueuler-collect-cubes.firebaseapp.com
