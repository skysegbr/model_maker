#!/usr/bin/env python3
"""
server.dev.py — Servidor estático para o Model Maker
Uso: python3 server.dev.py [porta]
     Padrão: http://localhost:8080
"""
import sys, os, mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.dirname(os.path.abspath(__file__))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, fmt, *args):
        print(f'  {self.address_string()} {fmt % args}')

if __name__ == '__main__':
    mimetypes.add_type('application/javascript', '.js')
    print(f'Model Maker rodando em http://localhost:{PORT}')
    HTTPServer(('', PORT), Handler).serve_forever()
