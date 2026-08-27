# Cartoleiros Senhas

Cofre local pra guardar e-mail + senha de várias contas do
[huntera.com.br/login](https://huntera.com.br/login). Tudo fica **no seu computador**,
**criptografado** com uma senha-mestra.

## Como rodar

Na pasta do repositório:

```bash
python cartoleiros-senhas/cofre.py
```

Isso sobe um servidor em `http://127.0.0.1:8787` (só localhost, nunca exposto na rede)
e abre o navegador. Na primeira vez, você **define a senha-mestra**; depois é só digitá-la
para abrir.

Porta ocupada? `python cartoleiros-senhas/cofre.py --port 9000`

## Como funciona (segurança)

- A criptografia (**AES-GCM 256** com chave derivada por **PBKDF2-SHA256**, 250 mil iterações)
  acontece **no navegador**. A senha-mestra e as senhas em texto **nunca saem** do navegador.
- O servidor Python e o arquivo `.env` só enxergam o **blob embaralhado** — inútil sem a senha.
- O cofre é gravado na linha `CARTOLEIROS_SENHAS=...` do arquivo `cartoleiros-senhas/.env`,
  que é **git-ignorado** (não vai pro GitHub).

⚠️ **Não dá pra recuperar a senha-mestra.** Se você esquecer, o cofre não abre. Guarde-a bem.

## Backup

Botão **Backup** baixa um `.env` criptografado. Botão **Restaurar** lê esse arquivo de volta
(pede a senha-mestra do backup para conferir antes de substituir o cofre atual).
