# 🎮 Guia do Jogador — Collect Cubes

Bem-vindo ao **Collect Cubes**! Este guia explica como jogar, personalizar seu personagem, competir no ranking e jogar multiplayer com amigos.

**Jogue agora:** https://dueuler-collect-cubes.web.app

---

## 📱 Como começar

1. Abra o link acima no celular ou computador (Chrome, Safari ou Firefox recomendados).
2. Aguarde a tela de carregamento — todos os passos devem ficar verdes ✅.
3. Toque em **Continuar** para entrar no menu principal.
4. Faça login com **Google** ou **Jogar como convidado**.

> **Dica:** O motor 3D (~3,6 MB) só baixa quando você toca em **Jogar**. Isso evita tela preta no celular.

---

## 🕹️ Controles

| Plataforma | Movimento | Reiniciar (após fim) |
|------------|-----------|----------------------|
| **Computador** | `W A S D` ou setas | `ESPAÇO` |
| **Celular/Tablet** | Joystick virtual (canto inferior esquerdo) | Toque na tela |

- Toque em **Menu** (canto superior direito) para voltar ao menu a qualquer momento.
- Use o botão **Diagnóstico** (laranja) se algo travar — copie o erro e envie para suporte.

---

## 🎯 Objetivo do jogo

- **Colete cubos dourados** espalhados pela arena antes do tempo acabar.
- Cada cubo vale **1 ponto**.
- **Vença coletando todos os cubos** ou maximize sua pontuação antes do cronômetro zerar.
- Suas melhores pontuações são salvas no **ranking** (Firebase).

---

## 📋 As 5 Fases

| Fase | Nome | Cubos | Tempo | Desbloqueio |
|------|------|-------|-------|-------------|
| 1 | Tutorial | 12 | 60s | Sempre disponível |
| 2 | Corrida | 20 | 45s | 8 pts na Fase 1 |
| 3 | Labirinto | 15 | 90s | 15 pts na Fase 2 |
| 4 | Noite | 25 | 60s | 20 pts na Fase 3 |
| 5 | Desafio Final | 30 | 120s | 25 pts na Fase 4 |

### Como desbloquear fases

1. No menu, toque em **📋 Fases**.
2. Complete uma fase com pontuação suficiente na fase anterior.
3. Fases bloqueadas mostram 🔒 e o requisito de pontos.

---

## 🎨 Personalização do Personagem

1. No menu, toque em **🎨 Personagem**.
2. Escolha entre 4 formas 3D:
   - **Cubo Herói** — equilibrado
   - **Esfera Veloz** — ágil
   - **Cápsula Ninja** — discreta
   - **Pirâmide Mística** — destaque visual
3. Selecione uma das **8 cores**.
4. Toque em **Salvar personagem**.

Sua escolha aparece no jogo solo e no multiplayer para outros jogadores verem.

---

## 👥 Multiplayer

### Criar sala (host)

1. Toque em **Multiplayer** → **Criar sala**.
2. Compartilhe o **código de 6 letras** com amigos (ex: `ABC123`).
3. Aguarde jogadores entrarem e marcarem **Estou pronto ✅**.
4. Como host 👑, toque em **Iniciar partida**.

### Entrar em sala

1. **Multiplayer** → **Entrar com código**.
2. Digite o código recebido do host.
3. Toque em **Estou pronto ✅** quando estiver preparado.

### Matchmaking automático

1. **Multiplayer** → **Matchmaking automático**.
2. O jogo busca outro jogador na mesma fase.
3. Quando encontrar, vocês entram na sala automaticamente.

### Regras multiplayer

- Até **8 jogadores** por sala.
- Cubos são **compartilhados** — quem chegar primeiro coleta.
- Ao fim do tempo, aparece o **pódio** com ranking da partida.
- Posições dos jogadores são sincronizadas em tempo real.

---

## 🏆 Ranking

- O ranking mostra os **10 melhores** jogadores da fase selecionada.
- Atualiza em tempo real quando alguém bate recorde.
- Login com Google salva seu nome no ranking permanentemente.
- Convidados aparecem como "Jogador" ou "Convidado".

---

## 🔧 Solução de problemas

| Problema | Solução |
|----------|---------|
| Tela preta | Toque **Diagnóstico** → **Copiar erro**. Atualize a página. |
| Login Google falha | Verifique conexão. Tente convidado primeiro. |
| Motor 3D pendente | Normal antes de jogar. Toque **Jogar** para carregar. |
| Sala não encontrada | Confira o código (6 letras, maiúsculas). |
| Jogo lento no celular | Feche outros apps. Use Wi-Fi. |

---

## 🔐 Conta e privacidade

- **Convidado:** sessão anônima, progresso pode ser perdido ao limpar dados do navegador.
- **Google:** progresso e ranking vinculados à sua conta.
- Dados armazenados no Firebase (Google Cloud) — pontuações, presença online e salas multiplayer.

---

## 📞 Suporte

- **Diagnóstico in-app:** botão laranja → Copiar → enviar o texto completo.
- **Repositório:** https://github.com/duEuler/3D-GAME-engine
- **Firebase Hosting:** https://dueuler-collect-cubes.web.app

---

*Bom jogo! Colete todos os cubos e domine o ranking!* 🏆
