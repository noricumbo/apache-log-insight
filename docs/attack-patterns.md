# Attack Patterns

## Overview

This project classifies common request patterns seen in Apache access logs. The categories are intended to be practical rather than exhaustive.

The examples below use fake domains, fake IP addresses, and safe placeholder values only.

## XML-RPC probing

Typical request:

```text
203.0.113.10 example.com example.com - - [29/Apr/2026:10:00:00 -0600] "POST /xmlrpc.php HTTP/1.1" 405 4329 "-" "WordPress.com"
```

Why it matters:

- Common WordPress attack surface.
- Often used for brute-force or pingback abuse.

Recommended mitigation:

- Block XML-RPC if it is not needed.
- Add a Fail2Ban rule for repeated probes.

## WordPress login brute force

Typical request:

```text
198.51.100.20 example.com example.com - - [29/Apr/2026:10:01:00 -0600] "POST /wp-login.php HTTP/1.1" 403 512 "-" "Mozilla/5.0"
```

Why it matters:

- Indicates password guessing against WordPress accounts.
- Can create noisy logs and resource spikes.

Recommended mitigation:

- Protect login pages with strong passwords and MFA where possible.
- Rate limit or ban repeated login attempts.

## WordPress user enumeration

Typical request:

```text
192.0.2.30 example.com example.com - - [29/Apr/2026:10:02:00 -0600] "GET /?author=1 HTTP/1.1" 200 1482 "-" "Mozilla/5.0"
```

Why it matters:

- Attackers often enumerate usernames before brute-force attempts.
- It can reveal predictable account naming patterns.

Recommended mitigation:

- Reduce public enumeration when possible.
- Watch for login attempts that follow enumeration requests.

## .env probing

Typical request:

```text
203.0.113.10 staging.example.com staging.example.com - - [29/Apr/2026:10:03:00 -0600] "GET /.env HTTP/1.1" 404 196 "-" "curl/8.0"
```

Why it matters:

- Attackers look for exposed environment files containing secrets.
- Even a `404` shows someone is testing for framework leaks.

Recommended mitigation:

- Ensure dotfiles are never web-accessible.
- Keep the request in scanner categories even when it misses.

## .git/config probing

Typical request:

```text
198.51.100.20 example.com example.com - - [29/Apr/2026:10:04:00 -0600] "GET /.git/config HTTP/1.1" 404 196 "-" "Mozilla/5.0"
```

Why it matters:

- Exposed Git metadata can leak repository history and internal paths.
- It is a common automated scanner target.

Recommended mitigation:

- Deny access to `.git` paths at the web server level.
- Treat probes as suspicious regardless of response code.

## Swagger and API docs probing

Typical request:

```text
192.0.2.30 api.example.com api.example.com - - [29/Apr/2026:10:05:00 -0600] "GET /swagger-ui HTTP/1.1" 404 196 "-" "Mozilla/5.0"
```

Why it matters:

- Attackers often search for interactive API documentation or exposed specs.
- It may indicate follow-up probing against REST endpoints.

Recommended mitigation:

- Restrict public access to internal API documentation.
- Monitor related paths such as `/api-docs`, `/v2/api-docs`, and `/v3/api-docs`.

## GraphQL probing

Typical request:

```text
203.0.113.10 api.example.com api.example.com - - [29/Apr/2026:10:06:00 -0600] "POST /graphql HTTP/1.1" 404 210 "-" "Mozilla/5.0"
```

Why it matters:

- GraphQL endpoints are attractive for schema discovery and query abuse.
- Even simple probes can reveal whether an endpoint exists.

Recommended mitigation:

- Disable unused endpoints.
- Apply authentication, query limits, and schema hardening when GraphQL is used.

## Laravel debug and Telescope probing

Typical request:

```text
198.51.100.20 staging.example.com staging.example.com - - [29/Apr/2026:10:07:00 -0600] "GET /telescope/requests HTTP/1.1" 404 196 "-" "Mozilla/5.0"
```

Why it matters:

- Debug tooling can expose stack traces, config, queries, and request details.
- Attackers commonly scan for public debug interfaces.

Recommended mitigation:

- Keep debug tooling disabled or access-controlled in public environments.
- Include known debug paths in scanner rules.

## PHP-CGI exploit attempts

Typical request:

```text
192.0.2.30 example.com example.com - - [29/Apr/2026:10:08:00 -0600] "POST /php-cgi/php-cgi.exe?%2dd+allow_url_include%3don HTTP/1.1" 404 196 "-" "Mozilla/5.0"
```

Why it matters:

- These probes target old or misconfigured CGI execution paths.
- They are often high-signal malicious requests.

Recommended mitigation:

- Disable unused CGI handlers.
- Ban aggressively when these patterns appear.

## Protocol probes such as TLS sent to HTTP

Typical request:

```text
203.0.113.10 example.com example.com - - [29/Apr/2026:10:09:00 -0600] "\x16\x03\x01\x02\x00" 400 226 "-" "-"
```

Why it matters:

- This usually indicates a client sending the wrong protocol to the wrong port.
- It may also reflect indiscriminate scanning across hosts and ports.

Recommended mitigation:

- Keep the category separate from normal web traffic.
- Consider a default deny vhost for noise reduction on unknown hosts.

## Legitimate crawlers

Typical request:

```text
198.51.100.20 example.com example.com - - [29/Apr/2026:10:10:00 -0600] "GET / HTTP/1.1" 200 2890 "-" "Mozilla/5.0 (compatible; ExampleBot/1.0; +https://example.com/bot)"
```

Why it matters:

- Not every automated request is hostile.
- Search crawlers, uptime checks, and integrations may appear in the same logs.

Recommended mitigation:

- Keep known crawlers in a separate category when possible.
- Avoid treating all automation as attack traffic.

## Video and app traffic

Typical request:

```text
192.0.2.30 media.example.com media.example.com - - [29/Apr/2026:10:11:00 -0600] "GET /stream/video.mp4 HTTP/1.1" 206 1048576 "-" "ExamplePlayer/1.0"
```

Why it matters:

- Media players and mobile apps often generate repeated ranged requests.
- This traffic can look noisy without being malicious.

Recommended mitigation:

- Separate app or media traffic from attack categories.
- Review status codes and user agents before treating it as abuse.
