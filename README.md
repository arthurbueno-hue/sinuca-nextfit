# Sinuca Next 🎱

Site interno do campeonato de sinuca da Next Fit. Ele tem inscrição com Google (@nextfit.com.br), chaveamento mata-mata sorteado com disputa de 3º lugar, votação de resultado pelos dois jogadores, prazos que travam o resultado, pódio, botão do Discord e painel da organização. Feito pensando primeiro no celular.

**Stack (tudo no plano grátis):** Next.js 16 na Vercel, Auth.js (Google) e Firestore (Firebase Spark).

---

## Como a segurança funciona

- **Login só pelo botão do Google, com conta `@nextfit.com.br`.** O servidor confere `email_verified`, `hd` e o final do e-mail, e recusa qualquer outra conta.
- **Copiar o link do botão para outro aparelho não funciona.** O login usa PKCE + state + nonce, guardados em cookies do aparelho que clicou. Se o login for concluído em outro celular, ele é recusado e nenhuma sessão é criada.
- **A sessão fica em um cookie `httpOnly` + `Secure`, criptografado.** O JavaScript da página não lê esse cookie, e não existe token no localStorage nem no IndexedDB.
- **O navegador nunca fala com o banco.** O Firestore tem regras `deny all`, e todo acesso passa pelo servidor com o Admin SDK.
- **E-mails nunca saem do servidor.** A página e a API só recebem apelidos e ids opacos. `/api/auth/session` devolve só `{ id, isAdmin }`.
- **Toda ação é validada no servidor.** Isso inclui login, permissão (jogador da partida ou ADM) e dados (zod). Se alguém chamar a API "na mão" pelo DevTools, recebe erro.
- **Headers de segurança configurados:** CSP, `X-Frame-Options: DENY`, HSTS, `noindex`, etc.
- **Tudo fica registrado no Histórico** (página do ADM): votos, disputas, W.O., sorteio.

ADMs: definidos na variável `ADMIN_EMAILS`.

---

## Testar localmente

Precisa do Node 20+.

```bash
npm install
```

Crie `.env.local`:

```env
AUTH_SECRET=qualquer-coisa-longa-aqui
AUTH_GOOGLE_ID=x
AUTH_GOOGLE_SECRET=x
ADMIN_EMAILS=arthur.bueno@nextfit.com.br,felipe.feijo@nextfit.com.br
DATA_BACKEND=memory
DEV_LOGIN=1
```

```bash
npm run dev
```

Abra http://localhost:3000. Abaixo do botão do Google aparece o campo amarelo **"Teste local"**:
- `arthur.bueno` entra como ADM;
- qualquer outro nome (`joao`, `maria`...) entra como jogador comum. Cada nome vira uma pessoa diferente.

Use uma **janela anônima** para ficar logado como duas pessoas ao mesmo tempo. No painel ADM (Gerenciar) tem o botão **"Dev: inscritos falsos"** para encher a chave.

> 🔒 Esse campo de teste **só existe no `npm run dev`** da sua máquina com `DEV_LOGIN=1`. No site publicado (build de produção / Vercel) ele não existe de jeito nenhum: lá só funciona o botão do Google. Os dados em memória somem quando o servidor para.

### Testar o botão do Google de verdade no local (opcional)
Crie o OAuth Client (passo 2 abaixo), com o redirect `http://localhost:3000/api/auth/callback/google`, e troque no `.env.local` os valores `x` de `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` pelos reais. Com o valor `x`, o Google responde **"OAuth client was not found / invalid_client"**. Isso é esperado.

### Testes automáticos

```bash
npm test
```

São 72 testes, entre eles: sorteio, votos, disputa, 3º lugar, pódio, trava por prazo, apelido repetido, jogador tentando usar função de ADM, dados maliciosos, votos simultâneos e vazamento de e-mail.

---

## Colocar no ar (grátis)

### 1. Firebase (banco)
1. Acesse https://console.firebase.google.com e crie um projeto (plano **Spark**, grátis).
2. Vá em **Build → Firestore Database → Criar banco** (modo produção, região `southamerica-east1`).
3. Na aba **Regras**, cole o conteúdo de [`firestore.rules`](firestore.rules) e publique.
4. Vá em **⚙️ Configurações do projeto → Contas de serviço → Gerar nova chave privada**. Isso baixa um JSON.
5. Converta o JSON para base64 (PowerShell):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\da\chave.json")) | Set-Clipboard
   ```
   O valor vai para a variável `FIREBASE_SERVICE_ACCOUNT`. **Depois apague o arquivo JSON** e nunca suba ele pro GitHub.

### 2. Google OAuth (login)
1. Acesse https://console.cloud.google.com, no **mesmo projeto** do Firebase.
2. Vá em **APIs e serviços → Tela de consentimento OAuth** e escolha o tipo **Interno**, se o projeto estiver na organização Google Workspace da Next Fit. Assim o próprio Google bloqueia quem é de fora. Se não der, use **Externo**: o site bloqueia de qualquer forma.
3. Vá em **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**:
   - Origens JavaScript: `https://SEU-APP.vercel.app`
   - URIs de redirecionamento:
     - `https://SEU-APP.vercel.app/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google` (para testar local)
4. Copie o **Client ID** e o **Client Secret**.

### 3. Vercel (hospedagem)
1. Suba esta pasta num repositório **privado** no GitHub. O `.gitignore` já protege o `.env.local`.
2. Em https://vercel.com, clique em **Add New → Project** e importe o repositório.
3. Em **Environment Variables**, cadastre:

   | Variável | Valor |
   |---|---|
   | `AUTH_SECRET` | gere com `npx auth secret` ou `openssl rand -base64 33` |
   | `AUTH_GOOGLE_ID` | Client ID do passo 2 |
   | `AUTH_GOOGLE_SECRET` | Client Secret do passo 2 |
   | `FIREBASE_SERVICE_ACCOUNT` | base64 do passo 1 |
   | `ALLOWED_DOMAIN` | `nextfit.com.br` |
   | `ADMIN_EMAILS` | `arthur.bueno@nextfit.com.br,felipe.feijo@nextfit.com.br` |

   **Não** cadastre `DATA_BACKEND` nem `DEV_LOGIN` na Vercel.

4. Faça o deploy. Depois, entre como ADM, abra **ADM → Novo campeonato** (os dados do 1º campeonato já vêm preenchidos) e crie o campeonato.

---

## Fluxo do campeonato

1. **Inscrição:** cada pessoa entra com o Google e cadastra o apelido, só até o prazo. O apelido é único: "Rui Chapéu", "rui chapeu", "RUI-CHAPÉU" e "Rui.Chapeu" contam como o mesmo.
2. **Sorteio:** o ADM clica em "Sortear chave". A ordem é aleatória (`crypto.randomInt`). Se o número de inscritos não for potência de 2, alguns avançam direto (BYE), e nunca sai BYE contra BYE. O sorteio fecha as inscrições.
3. **Prazos:** o ADM define o prazo de cada rodada escolhendo só o dia (a hora já vem **23:59**, e dá para mudar). Um jogo específico pode ganhar prazo próprio no card da partida.
4. **Resultado:** os dois jogadores votam no vencedor, com placar opcional.
   - Votos iguais: o resultado é confirmado e o vencedor avança sozinho na chave.
   - Votos diferentes: a partida fica **Em disputa** e aparece o aviso *"Cara, tá errado isso aí, corrige!"*. Qualquer um dos dois pode mudar o voto até bater.
5. **Passou do prazo:** o jogo fica **vermelho** e o resultado **trava**. Os jogadores não votam mais e aparece o aviso *"Jogo em atraso! Para ajustar a chave, entre em contato com o ADM: Felipe Feijó"*. O nome é configurável no painel. O ADM decide (resultado ou W.O.) ou dá um prazo novo para aquele jogo, o que destrava a votação.
6. **Semifinal:** o vencedor vai para a final e o perdedor para a **disputa de 3º lugar**.
7. **Fim:** o campeonato só encerra quando a final **e** o 3º lugar terminam. Aí aparece o pódio 🏆🥈🥉.
8. O ADM pode **desfazer** um resultado enquanto as partidas seguintes (próxima fase e 3º lugar) ainda não tiverem terminado.
9. **Próximo campeonato:** em ADM → Novo campeonato. Regras, contato e Discord são copiados do anterior.

## Estrutura

```
src/lib/tournament/    lógica pura (sorteio, votos, prazos) + testes
src/server/actions/    ações (inscrição, voto, ADM) — validadas no servidor
src/server/queries.ts  leitura → dados sem e-mail
src/server/store/      Firestore (produção) ou memória (dev)
src/components/        chave, modal da partida, inscrição, regras
src/auth.ts            login Google + restrição de domínio
```
