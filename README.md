# Apache Log Dashboard

Lightweight Apache log dashboard for real-time traffic analysis and attack detection. It parses access logs into structured JSON and visualizes request patterns, attack types, and top offenders using D3.js. Optional Fail2Ban rules can be used to automatically block common scanner and brute-force behavior.

![Screenshot placeholder](https://via.placeholder.com/1200x700?text=Apache+Log+Dashboard)

## Features

- Dependency-free Python parser
- Static HTML + D3.js dashboard
- JSON summary output for simple hosting
- Categorization for common scanner, probe, and brute-force traffic
- Top IP, top host, timeline, and recent request views
- Sample data fallback for public demos and local development
- Optional Fail2Ban filter and jail examples
- Public-safe Apache vhost examples

## Architecture

```text
Apache access_log
    ↓
Python parser
    ↓
log-summary.json
    ↓
D3 dashboard
    ↓
Fail2Ban rules for mitigation
```

More detail is available in [docs/architecture.md](/Users/nori/Sites/apache-log-insight/docs/architecture.md).

## Repository Layout

```text
apache-log-insight/
├── README.md
├── .gitignore
├── apache/
│   ├── default-deny-http.conf.example
│   ├── default-deny-https.conf.example
│   └── log-dashboard-vhost.conf.example
├── docs/
│   ├── architecture.md
│   ├── attack-patterns.md
│   ├── dashboard-design.md
│   ├── fail2ban-rules.md
│   ├── roadmap.md
│   ├── sample-log-format.md
│   ├── security-notes.md
│   ├── setup-guide.md
│   └── internal/
│       └── .gitkeep
├── fail2ban/
│   ├── apache-web-scanner.conf
│   └── apache-web-scanner.local.example
├── parser/
│   └── parse_logs.py
└── public/
    ├── index.html
    └── data/
        └── log-summary.sample.json
```

## Installation

### Requirements

- Apache or `httpd`
- Python 3
- Static file hosting
- Optional Fail2Ban

### Clone and review sample data

The repository ships with [public/data/log-summary.sample.json](/Users/nori/Sites/apache-log-insight/public/data/log-summary.sample.json) so the dashboard can run without production logs.

### Run the parser manually

```bash
python3 parser/parse_logs.py \
  --log /var/log/httpd/access_log \
  --out public/data/log-summary.json \
  --limit 5000
```

Defaults:

- `--log`: `/var/log/httpd/access_log`
- `--out`: `public/data/log-summary.json`
- `--limit`: `5000`

### Cron example

```cron
* * * * * /usr/bin/python3 /path/to/repo/parser/parse_logs.py --log /var/log/httpd/access_log --out /var/www/log-dashboard/public/data/log-summary.json --limit 5000
```

## Dashboard

The static dashboard lives at [public/index.html](/Users/nori/Sites/apache-log-insight/public/index.html).

Behavior:

- Loads `data/log-summary.json` when live output exists
- Falls back to `data/log-summary.sample.json` when live data is unavailable
- Refreshes every 60 seconds
- Escapes table values before injecting them into the page
- Shows total parsed requests, category counts, top IPs, attack timeline per minute, and recent requests

See [docs/dashboard-design.md](/Users/nori/Sites/apache-log-insight/docs/dashboard-design.md) for the data model and UI notes.

## Apache Config Examples

Public-safe examples are included in:

- [apache/log-dashboard-vhost.conf.example](/Users/nori/Sites/apache-log-insight/apache/log-dashboard-vhost.conf.example)
- [apache/default-deny-http.conf.example](/Users/nori/Sites/apache-log-insight/apache/default-deny-http.conf.example)
- [apache/default-deny-https.conf.example](/Users/nori/Sites/apache-log-insight/apache/default-deny-https.conf.example)

Important:

- The default deny vhost should load first.
- Apache vhost load order matters.
- Example domains and paths are placeholders only.

## Fail2Ban Setup

Public-safe Fail2Ban examples are included in:

- [fail2ban/apache-web-scanner.conf](/Users/nori/Sites/apache-log-insight/fail2ban/apache-web-scanner.conf)
- [fail2ban/apache-web-scanner.local.example](/Users/nori/Sites/apache-log-insight/fail2ban/apache-web-scanner.local.example)

Common workflow:

```bash
sudo fail2ban-regex /var/log/httpd/access_log /etc/fail2ban/filter.d/apache-web-scanner.conf
sudo fail2ban-client reload
sudo fail2ban-client status
sudo fail2ban-client status apache-web-scanner
```

More guidance is in [docs/fail2ban-rules.md](/Users/nori/Sites/apache-log-insight/docs/fail2ban-rules.md).

## Privacy And Security Notes

- Do not commit real Apache logs.
- Do not commit production-generated `log-summary.json`.
- Do not commit real IP addresses, domains, usernames, certificates, keys, or `.env` files.
- Use only placeholder domains such as `example.com`, `logs.example.com`, and `staging.example.com`.
- Use only documentation IP ranges such as `192.0.2.0/24`, `198.51.100.0/24`, and `203.0.113.0/24`.

See [docs/security-notes.md](/Users/nori/Sites/apache-log-insight/docs/security-notes.md) for the public release checklist and safety guidance.

## Sample Data

The committed sample data is safe for demos and development. It is intentionally synthetic and does not represent a real server environment.

For a local demo, serve the `public/` directory and open `index.html`. The page will automatically show sample data when live data is missing.

For sample input shapes and parser expectations, see [docs/sample-log-format.md](/Users/nori/Sites/apache-log-insight/docs/sample-log-format.md).

## Limitations

- This is not a full SIEM.
- The parser only summarizes what it can recognize from the Apache access log format.
- The dashboard is designed for quick visibility, not long-term storage or forensic depth.
- Fail2Ban behavior depends on your exact Apache log format and server policy.

## Roadmap

- Click an IP to show detailed attack breakdown
- Show per-IP timeline
- Export incident report as Markdown
- Support Nginx logs
- Add configurable category rules
- Add GeoIP support
- Add Docker deployment

More future ideas are tracked in [docs/roadmap.md](/Users/nori/Sites/apache-log-insight/docs/roadmap.md).
