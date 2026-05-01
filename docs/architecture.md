# Architecture

## Overview

This project is a lightweight Apache log dashboard for learning, visibility, and basic security monitoring.

It reads Apache access logs, classifies common request patterns, writes a summarized JSON file, and renders that summary in a static D3.js dashboard. Optional Fail2Ban rules can then use the same access log stream to block common scanner and brute-force traffic.

## Data flow

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

## Components

### Apache access log

The input is a standard Apache `access_log` or a closely related custom log format. The project focuses on request metadata such as client IP, host, timestamp, request line, status code, referer, and user agent.

### Python parser

The parser reads recent log lines, handles malformed input defensively, classifies requests into categories, and produces a JSON summary designed for dashboard use. Its recent-line limit can come from a repo-root `.env` file or be overridden on the command line for one-off runs and cron jobs.

### JSON summary

The summary file is the contract between parsing and visualization. It contains aggregate counts, top offenders, a minute-by-minute timeline, and a small recent activity list.

### Static dashboard

The dashboard is a static HTML page powered by D3.js. It fetches the JSON summary and turns it into charts and tables without requiring a database or a backend API.

### Fail2Ban integration

Fail2Ban is optional. When enabled, it watches the Apache log directly and can ban clients that hit known scanner or exploit paths.

## Runtime model

The runtime model is intentionally simple:

1. Apache writes requests to `/var/log/httpd/access_log`.
2. A scheduled parser run converts the latest log lines into `log-summary.json`.
3. The dashboard fetches that JSON file on load and refreshes it periodically.
4. Fail2Ban independently monitors the same log file and applies bans when filter rules match.

This separation keeps the dashboard read-only and easy to host as static content.

## Why static JSON + static dashboard

- It keeps deployment small and understandable.
- It avoids adding a database or a long-running app server.
- It works on basic Apache or shared Linux environments.
- It makes the dashboard easy to inspect, back up, and troubleshoot.
- It keeps the project educational and approachable.

## Limitations

- The dashboard only shows what the parser writes into the JSON summary.
- It is not a full SIEM, IDS, or log retention system.
- Large logs may require tighter parser limits or more frequent summaries.
- IP reputation, GeoIP, and correlation across services are out of scope by default.
- Fail2Ban matching depends on the exact Apache log format and local jail setup.
