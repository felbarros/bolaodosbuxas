# Bolão dos Buxas — site com servidor

Agora ninguém precisa mandar código no WhatsApp. O jogador preenche, toca em
**Enviar palpite**, e o palpite fica guardado no servidor. Quando os cinco
entregarem, o lacre abre sozinho no painel.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `index.html` | A página que os jogadores usam |
| `netlify/functions/palpites.mjs` | O servidor: guarda os palpites e segura o lacre |
| `netlify.toml` | Diz ao Netlify onde está cada coisa |
| `package.json` | A biblioteca de armazenamento que a função usa |

## Como publicar

1. No GitHub, crie um repositório novo (pode ser privado) chamado `bolao-dos-buxas`.
2. Envie **todos** os arquivos desta pasta, mantendo a estrutura de pastas —
   `netlify/functions/palpites.mjs` precisa ficar nesse caminho exato.
   Pelo site do GitHub: botão *Add file* → *Upload files* → arraste a pasta inteira.
3. No Netlify: *Add new site* → *Import an existing project* → *GitHub* →
   escolha o repositório.
4. Na tela de configuração, deixe o comando de build **vazio** e o diretório de
   publicação como `.` (ponto). Clique em *Deploy*.
5. Espere o deploy terminar e abra o endereço `.netlify.app` que aparecer.

Depois disso, cada alteração enviada ao GitHub republica o site sozinho.

## Como testar antes de valer

1. Abra o site, escolha um nome, preencha os dez e envie.
2. Vá na aba **Painel**. Deve aparecer `1 de 5` e um cartão lacrado.
3. Se aparecer "Sem conexão com o servidor", a função não subiu — confira no
   painel do Netlify, aba *Functions*, se `palpites` está listada.
4. Para limpar um teste, basta trocar o nome do GP no topo: cada GP tem seu
   próprio armazenamento.

## O lacre

O bloqueio está no servidor, não na tela. Enquanto faltar alguém, os palpites
não saem da função — quem abrir o painel ou inspecionar a rede do navegador
não recebe os códigos, porque eles simplesmente não são enviados. Isso é mais
forte do que a versão anterior, onde o lacre era só visual.

## Limites

- Plano grátis do Netlify: as funções têm cota mensal generosa, muito acima de
  cinco palpites por corrida.
- Não há senha. Qualquer um com o link pode enviar um palpite no nome de outro
  jogador. Entre amigos isso costuma bastar; se quiser trancar, dá para
  acrescentar uma senha por jogador depois.
