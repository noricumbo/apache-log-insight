# Dashboard Design

## Overview

The dashboard is a static HTML page that reads a JSON summary file and renders charts and tables with D3.js. Its purpose is to make recent Apache request patterns visible without adding a database or server-side application.

## JSON schema

The parser produces a summary shaped like this:

```json
{
  "generated_at": "2026-04-29T10:12:00-06:00",
  "total": 1200,
  "by_category": {
    "normal": 900,
    "xmlrpc": 120,
    "wp-login": 55,
    ".env probe": 25,
    "protocol probe": 12,
    "known crawler": 88
  },
  "by_status": {
    "200": 940,
    "403": 90,
    "404": 140,
    "405": 30
  },
  "top_ips": [
    ["203.0.113.10", 120],
    ["198.51.100.20", 84],
    ["192.0.2.30", 63]
  ],
  "top_hosts": [
    ["example.com", 700],
    ["logs.example.com", 320],
    ["staging.example.com", 180]
  ],
  "timeline": [
    {"minute": "10:08", "xmlrpc": 3, "wp-login": 1},
    {"minute": "10:09", ".env probe": 2, "protocol probe": 1},
    {"minute": "10:10", "known crawler": 4}
  ],
  "recent": [
    {
      "ip": "203.0.113.10",
      "host": "example.com",
      "status": "405",
      "category": "xmlrpc",
      "request": "POST /xmlrpc.php HTTP/1.1"
    }
  ]
}
```

## Category chart

The category chart shows the current request distribution by category. It helps answer simple questions quickly:

- Is the traffic mostly normal?
- Are scanner requests spiking?
- Is one attack family dominating the noise?

For a lightweight dashboard, a bar chart is easy to read and compare over time.

## Attack timeline per minute

The timeline groups categorized requests by minute. This makes short bursts visible, especially when probes arrive in clusters.

The dashboard can choose to de-emphasize normal traffic so suspicious categories remain easier to spot.

## Top IPs

The top IPs table highlights the most active clients in the current summary window. It is useful for triage, especially when a single scanner dominates the recent log slice.

This list is meant for quick visibility, not long-term attribution.

## Recent requests

The recent requests table shows the most recent parsed entries with safe HTML escaping before values are inserted into the page.

This makes it easier to inspect:

- request paths
- status codes
- category assignments
- host targeting patterns

## Auto-refresh behavior

The dashboard can refresh every 60 seconds by re-fetching the summary JSON. This keeps the page lightweight while still feeling near-real-time for basic monitoring.

## Sample data fallback

For public demos and local development, the dashboard should try live data first and then fall back to `log-summary.sample.json` if live data is unavailable.

When sample data is shown, the page should display a visible notice so viewers know they are not looking at production output.

## Possible future feature: click IP to view details

A useful next step would be making an IP row clickable to show a focused breakdown for that client, such as:

- category counts
- request paths
- minute-by-minute activity
- related hosts
