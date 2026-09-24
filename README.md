# Sinuca Next 🎱

Site interno do campeonato de sinuca da Next Fit. Tem:
- inscrição com Google (só o domínio da empresa);
- chaveamento mata-mata sorteado, com disputa de 3º lugar;
- votação do resultado pelos dois jogadores;
- prazos que travam o resultado;
- pódio, botão do Discord e painel da organização.

Foi feito pensando primeiro no celular.

**Stack:** Next.js 16, Auth.js (login Google) e PostgreSQL. Hospedagem na **Railway**.

---

## Como a segurança funciona

- **Login só pelo botão do Google, com conta do domínio permitido** (`ALLOWED_DOMAIN`). O servidor confere `email_verified`, `hd` (domínio do Workspace) e o final do e-mail, e recusa qualquer outra conta.
- **Copiar o link do botão para outro aparelho não funciona.** O login usa PKCE + state + nonce, guardados em cookies do aparelho que clicou. Se for concluído em outro celular, é recusado e nenhuma sessão é criada.
- **A sessão fica num cookie `httpOnly` + `Secure`, criptografado** com `AUTH_SECRET`. O JavaScript da página não lê esse cookie; cookie adulterado ou inventado é recusado.
- **O navegador nunca fala com o banco.** Todo acesso passa pelo servidor.
- **E-mails nunca saem do servidor.** A página e a API só recebem apelidos e ids opacos, e `/api/auth/session` devolve só `{ id, isAdmin }`.
- **Toda ação é validada no servidor:** login, permissão (jogador da partida ou ADM) e dados (zod). Chamar a API "na mão" pelo DevTools dá erro.
- **Transações no banco:** uma escrita por vez (advisory lock). Os dois jogadores votando ao mesmo tempo não corrompem nada.
- **Headers de segurança:** CSP, `X-Frame-Options: DENY`, HSTS, `noindex`.
- **Histórico** (página do ADM) com todos os votos, disputas, W.O. e sorteio.

Os ADMs são definidos na variável `ADMIN_EMAILS`, só no servidor.

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
ALLOWED_DOMAIN=nextfit.com.br
ADMIN_EMAILS=seu.email@nextfit.com.br
DATA_BACKEND=memory
DEV_LOGIN=1
```

```bash
npm run dev
```

Abra http://localhost:3000. Abaixo do botão do Google aparece o campo amarelo **"Teste local"**:
- digite a parte antes do @ de um e-mail que está em `ADMIN_EMAILS` para entrar como ADM;
- qualquer outro nome (`joao`, `maria`...) entra como jogador.

Use uma **janela anônima** para ter duas pessoas logadas ao mesmo tempo. No painel ADM (Gerenciar) tem o botão **"Dev: inscritos falsos"**.

> 🔒 Esse campo de teste **só existe no `npm run dev`** com `DEV_LOGIN=1`. Em produção (Railway/Vercel, `NODE_ENV=production`) ele não existe: lá só funciona o botão do Google. Os dados em memória somem ao reiniciar.

Com `AUTH_GOOGLE_ID=x`, clicar no botão do Google dá **"OAuth client was not found / invalid_client"**. Isso é esperado. Para testar o Google de verdade no local, use o client real (passo 2 abaixo) com o redirect `http://localhost:3000/api/auth/callback/google`.

### Testes automáticos

```bash
npm test
```

São 86 testes: sorteio, votos, disputa, 3º lugar, pódio, trava por prazo, apelido repetido, jogador tentando usar função de ADM, dados maliciosos, votos simultâneos e vazamento de e-mail. A parte de servidor roda **duas vezes**: em memória e num PostgreSQL real (PGlite).

---

## Colocar no ar (Railway)

### 1. Projeto na Railway
1. Em https://railway.com, clique em **New Project → Deploy from GitHub repo** e escolha este repositório.
2. No mesmo projeto, clique em **+ Create → Database → Add PostgreSQL**.
3. No serviço do site, vá em **Settings → Networking → Generate Domain**. Isso gera o endereço, algo como `https://sinuca-nextfit-production.up.railway.app`.

### 2. Login com Google (Google Cloud Console)
1. Em https://console.cloud.google.com, crie ou escolha um projeto. De preferência, crie dentro da organização da empresa.
2. Em **Google Auth Platform / Tela de consentimento OAuth**, use o público **Interno**, se estiver disponível: só contas da empresa conseguem logar.
3. Em **Clientes → Criar cliente → Aplicativo da Web**:
   - Origens JavaScript autorizadas: `https://SEU-DOMINIO.up.railway.app`
   - URIs de redirecionamento: `https://SEU-DOMINIO.up.railway.app/api/auth/callback/google` (e, para teste local, `http://localhost:3000/api/auth/callback/google`)
4. Copie o **ID do cliente** e a **chave secreta**.

### 3. Variáveis do serviço do site (Railway → serviço → Variables)

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência ao banco criado no passo 1) |
| `DATA_BACKEND` | `postgres` |
| `AUTH_SECRET` | texto aleatório longo. Gere com: `node -e "console.log(require('crypto').randomBytes(33).toString('base64'))"` |
| `AUTH_URL` | `https://SEU-DOMINIO.up.railway.app` |
| `AUTH_GOOGLE_ID` | ID do cliente (passo 2) |
| `AUTH_GOOGLE_SECRET` | chave secreta (passo 2) |
| `ALLOWED_DOMAIN` | `nextfit.com.br` |
| `ADMIN_EMAILS` | e-mails dos ADMs separados por vírgula |

**Não** cadastre `DEV_LOGIN`. A tabela do banco é criada sozinha no primeiro acesso.

A Railway faz o build (`npm run build`) e sobe (`npm start`) sozinha, e a cada `git push` publica de novo.

### 4. Primeiro acesso
Entre com o Google usando um e-mail de ADM, vá em **ADM → Novo campeonato** (os dados do 1º campeonato já vêm preenchidos) e clique em **Criar**. Teste também pelo celular e com um Gmail pessoal, que deve ser bloqueado.

---

## Fluxo do campeonato

1. **Inscrição:** cada pessoa entra com o Google e cadastra o apelido, até o prazo. O apelido é único: "Rui Chapéu", "rui chapeu", "RUI-CHAPÉU" e "Rui.Chapeu" contam como o mesmo.
2. **Sorteio:** o ADM clica em "Sortear chave", e a ordem é aleatória (`crypto.randomInt`). Se o número de inscritos não for potência de 2, alguns avançam direto (BYE), nunca BYE contra BYE. O sorteio fecha as inscrições.
3. **Prazos:** o ADM define o prazo de cada rodada escolhendo só o dia (a hora já vem **23:59**, e dá para mudar). Um jogo específico pode ter prazo próprio, definido no card da partida.
4. **Resultado:** os dois jogadores votam no vencedor, com placar opcional.
   - Votos iguais: confirmado, e o vencedor avança sozinho.
   - Votos diferentes: a partida fica **Em disputa**, com o aviso *"Cara, tá errado isso aí, corrige!"*, e dá para mudar o voto até bater.
5. **Passou do prazo:** o jogo fica **vermelho** e o resultado **trava**. Jogadores não votam mais e aparece *"Jogo em atraso! Para ajustar a chave, entre em contato com o ADM: …"* (o nome do contato é configurável no painel). O ADM decide (resultado ou W.O.) ou dá um prazo novo àquele jogo, e isso destrava a votação.
6. **Semifinal:** o vencedor vai para a final e o perdedor para a **disputa de 3º lugar**.
7. **Fim:** o campeonato encerra quando a final **e** o 3º lugar terminam, e aparece o pódio 🏆🥈🥉.
8. O ADM pode **desfazer** um resultado enquanto as partidas seguintes não tiverem terminado.
9. **Próximo campeonato:** ADM → Novo campeonato. Regras, contato e Discord são copiados do anterior.

## Estrutura

```
src/lib/tournament/    lógica pura (sorteio, votos, prazos) + testes
src/server/actions/    ações (inscrição, voto, ADM), validadas no servidor, + testes de ponta a ponta
src/server/queries.ts  leitura → dados sem e-mail
src/server/store/      PostgreSQL (produção) ou memória (dev)
src/components/        chave, modal da partida, inscrição, regras, pódio
src/auth.ts            login Google + restrição de domínio
```
