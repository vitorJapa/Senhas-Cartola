#!/usr/bin/env python3
"""
Cartoleiros Senhas — servidor local minimo (so biblioteca padrao).

- Serve a interface (index.html) em http://127.0.0.1:8787
- Guarda o cofre CRIPTOGRAFADO numa unica linha do arquivo .env
- A criptografia acontece 100% no navegador (Web Crypto). Este servidor
  NUNCA ve a senha-mestra nem as senhas em texto — so o blob embaralhado.

Uso:
    python cofre.py                 # sobe o servidor e abre o navegador
    python cofre.py --port 9000     # porta alternativa
    python cofre.py --no-browser    # nao abre o navegador sozinho
"""
import argparse
import http.server
import json
import os
import socketserver
import sys
import webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
INDEX = HERE / "index.html"
ENV_FILE = HERE / ".env"
ENV_KEY = "CARTOLEIROS_SENHAS"   # linha do .env com o cofre criptografado
MASTER_KEY = "SENHA_MESTRA"      # linha do .env com a senha-mestra
DEFAULT_MASTER = "tacarata"      # senha-mestra padrao (fica salva no .env)


def _read_key(key: str) -> str:
    if not ENV_FILE.exists():
        return ""
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:].strip()
    return ""


def read_vault() -> str:
    """Le o blob criptografado da linha CARTOLEIROS_SENHAS=... do .env (ou '')."""
    return _read_key(ENV_KEY)


def read_master() -> str:
    """Le a senha-mestra do .env; usa o padrao se a linha nao existir."""
    return _read_key(MASTER_KEY) or DEFAULT_MASTER


def ensure_master() -> None:
    """Garante que a senha-mestra exista no .env (cria com o padrao se faltar).

    Assim voce nao precisa configurar a senha-mestra toda vez — ela fica
    salva aqui. (Trade-off: quem tiver este arquivo tem a senha E o cofre.)
    """
    existing = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    for line in existing.splitlines():
        if line.strip().startswith(MASTER_KEY + "="):
            return  # ja configurada
    header = ("# Senha-mestra do Cartoleiros Senhas — fica salva pra nao "
              "digitar toda vez.\n"
              f"{MASTER_KEY}={DEFAULT_MASTER}\n")
    ENV_FILE.write_text(header + existing, encoding="utf-8")


def write_vault(blob: str) -> None:
    """Grava/atualiza a linha CARTOLEIROS_SENHAS=... preservando outras linhas."""
    lines = []
    if ENV_FILE.exists():
        lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
    out, found = [], False
    for line in lines:
        if line.strip().startswith(ENV_KEY + "="):
            out.append(f"{ENV_KEY}={blob}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"{ENV_KEY}={blob}")
    ENV_FILE.write_text("\n".join(out) + "\n", encoding="utf-8")


class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body=b"", ctype="text/plain; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        # Sem cache: sempre a versao mais nova da UI.
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            if not INDEX.exists():
                return self._send(500, b"index.html nao encontrado")
            return self._send(200, INDEX.read_bytes(), "text/html; charset=utf-8")
        if self.path.split("?")[0] == "/huntera-autofill.user.js":
            f = HERE / "huntera-autofill.user.js"
            if not f.exists():
                return self._send(404, b"userscript nao encontrado")
            # content-type + nome .user.js fazem o Tampermonkey oferecer instalar
            return self._send(200, f.read_bytes(), "text/javascript; charset=utf-8")
        if self.path == "/vault":
            payload = json.dumps({
                "blob": read_vault(),
                "master": read_master(),
            }).encode("utf-8")
            return self._send(200, payload, "application/json")
        return self._send(404, b"nao encontrado")

    def do_POST(self):
        if self.path != "/vault":
            return self._send(404, b"nao encontrado")
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length) or b"{}")
            blob = str(data.get("blob", ""))
            write_vault(blob)
            return self._send(200, b'{"ok":true}', "application/json")
        except Exception as e:  # noqa: BLE001
            return self._send(400, f'{{"ok":false,"erro":"{e}"}}'.encode("utf-8"),
                              "application/json")

    def log_message(self, *args):  # silencia o log ruidoso
        pass


def main():
    ap = argparse.ArgumentParser(description="Cartoleiros Senhas (local)")
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    ensure_master()                  # garante a senha-mestra salva no .env
    addr = ("127.0.0.1", args.port)  # SO localhost — nunca exposto na rede
    url = f"http://127.0.0.1:{args.port}/"

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(addr, Handler) as httpd:
        print(f"Cartoleiros Senhas rodando em {url}")
        print(f"Arquivo do cofre (criptografado): {ENV_FILE}")
        print("Ctrl+C para encerrar.")
        if not args.no_browser:
            try:
                webbrowser.open(url)
            except Exception:
                pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nEncerrado.")
            sys.exit(0)


if __name__ == "__main__":
    main()
