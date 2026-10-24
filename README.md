# Turbo League (online)

Files: server.js (Node server, authoritative), sim.js (shared physics), index.html (game client), package.json.

Run locally: npm install && npm start, then open http://localhost:8080 in two tabs.
For two devices on the same Wi-Fi use http://<your-computer-ip>:8080.

Deploy (e.g. Render): New > Web Service > your repo. Build command: npm install. Start command: node server.js.
The client switches to wss:// automatically on https hosts.

Optional environment variables: MATCH_SECONDS (default 300), ALLOWED_ORIGIN (e.g. https://your-app.onrender.com).

Test: open the URL on two devices, tap Play 1v1 on both. Private match: Private room, then share the code or invite link.

Known limits: no client-side prediction, no reconnect into a running match, no automated tests yet, one arena.
