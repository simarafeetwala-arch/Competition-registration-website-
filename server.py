#!/usr/bin/env python3
"""
Nexus Competitions Portal - Local Development Server
"""
import http.server
import socketserver
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and caching headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
            print("=======================================================")
            print(f"Nexus Competitions Portal Server running on port {PORT}")
            print(f"Home Page:   http://localhost:{PORT}/index.html")
            print(f"Dashboard:   http://localhost:{PORT}/dashboard.html")
            print(f"Auth Page:   http://localhost:{PORT}/auth.html")
            print(f"Admin Page:  http://localhost:{PORT}/admin.html")
            print("=======================================================")
            print("Press Ctrl+C to terminate.")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        sys.exit(0)
