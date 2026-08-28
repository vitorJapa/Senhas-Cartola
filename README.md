# Cartoleiros Senhas — versão GitHub Pages

Cofre de senhas **compartilhado** com um grupo, hospedado no GitHub Pages. Uma única
**senha-mestra compartilhada** abre o cofre; tudo é **criptografado ponta-a-ponta** no
navegador (AES-GCM 256 + PBKDF2-SHA256, 600 mil iterações). O GitHub só guarda o arquivo
`vault.enc` **embaralhado** — nunca vê as senhas nem a senha-mestra.

- **Dono** cadastra as contas, baixa o `vault.enc` e sobe no repositório.
- **Grupo** abre a URL, digita a senha-mestra compartilhada e vê/usa (com autofill na Huntera).

## Publicar (uma vez)

1. Crie um repositório **privado** no GitHub (ex.: `cartoleiros-senhas`).
2. Suba o `index.html` deste diretório na raiz do repositório.
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   branch `main`, pasta `/ (root)`. Salve. Em ~1 min sai a URL
   (`https://SEU-USUARIO.github.io/cartoleiros-senhas/`).

## Primeiro cofre (dono)

1. Abra a URL do Pages. Como não há `vault.enc` ainda, aparece **"Criar o cofre do grupo"**.
2. Defina a **senha-mestra compartilhada** — use uma **frase longa** (mín. 10 caracteres;
   quanto maior, melhor). Ela **não pode ser recuperada**.
3. Adicione as contas (**+ Nova conta**).
4. Clique em **Baixar vault.enc** e **suba esse arquivo na raiz do repositório** (commit).
5. Passe pro grupo: a **URL** + a **senha-mestra** — a senha por um canal seguro (WhatsApp
   privado, etc.), **nunca dentro do repositório**.

## Atualizar contas depois (dono)

1. Abra a URL, digite a senha-mestra, edite/adicione/exclua.
2. **Baixar vault.enc** → substitua o arquivo no repositório (commit).
   (O site avisa com um banner enquanto houver alterações não baixadas.)

## Usar (grupo)

1. Abra a URL, digite a senha-mestra compartilhada.
2. Veja as contas, copie e-mail/senha, ou clique **Entrar ↗** para abrir a Huntera
   **já preenchida** (precisa do autofill instalado — veja abaixo).

## Autofill "clicar Entrar → Huntera já preenchida" (userscript)

Uma página web não consegue preencher os campos de **outro** site (trava de segurança do
navegador). Por isso o preenchimento roda por um **userscript** (Tampermonkey) — feito
**uma vez por navegador**, por cada pessoa:

1. Instale a extensão **[Tampermonkey](https://www.tampermonkey.net/)** (grátis).
2. No cofre, clique em **Instalar autofill** → **Instalar script ↗** (o Tampermonkey
   confirma a instalação). O script é o `huntera-autofill.user.js` deste diretório —
   suba-o no repositório junto do `index.html`.
3. Na 1ª vez que clicar **Entrar**, o script pede **a URL do cofre** (a que aparece no
   modal *Instalar autofill*, algo como `https://SEU-USUARIO.github.io/REPO/vault.enc`)
   e a **senha-mestra**. Ele guarda as duas — nas próximas é automático.

Depois disso: clicar **Entrar** abre a Huntera numa aba nova e o script preenche e-mail e
senha sozinho. Você só resolve o "não sou robô" e clica em Entrar. (Sem `#csid` na URL vai
só um id opaco da conta — **nunca a senha**.) Para trocar URL/senha guardadas: menu do
Tampermonkey → *Cartoleiros: redefinir…*.

## Segurança — leia

- **Ponta-a-ponta:** a senha-mestra e as contas nunca saem do navegador. O GitHub guarda
  só o `vault.enc` embaralhado.
- ⚠️ **No plano grátis, o site do Pages é público mesmo vindo de repo privado** — ou seja,
  o `vault.enc` é baixável por quem tiver a URL. A proteção real é a **senha-mestra forte**.
  Use uma frase; não use algo curto/óbvio.
- **Uma senha só:** não dá pra revogar uma pessoa sem trocar a senha de todos, e quem tem
  a senha pode editar. Se precisar de controle por pessoa (revogar, só-leitura, auditoria),
  o caminho é o **Vaultwarden** (Bitwarden self-hosted).
- **Sem recuperação:** esqueceu a senha-mestra, perdeu o cofre. Guardem-na bem.
- Nunca comite a senha-mestra nem um `vault.enc` descriptografado.
