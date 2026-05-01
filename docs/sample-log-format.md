# Sample Log Format

## Overview

The parser is designed around Apache access logs. It currently aims to support:

- an extended format with IP, vhost, and host fields
- a simpler Apache combined-style format

The examples below are synthetic and use placeholders only.

## Extended format example

This project originally assumes a format like:

```text
203.0.113.10 example.com example.com - - [29/Apr/2026:10:00:00 -0600] "POST /xmlrpc.php HTTP/1.1" 405 4329 "-" "WordPress.com"
```

Field breakdown:

- `203.0.113.10`: client IP
- `example.com`: vhost
- `example.com`: host
- `- -`: unused auth or ident fields
- `[29/Apr/2026:10:00:00 -0600]`: timestamp with timezone
- `"POST /xmlrpc.php HTTP/1.1"`: request line
- `405`: response status
- `4329`: response size
- `"-"`: referer
- `"WordPress.com"`: user agent

## Combined-style example

The parser also tries to tolerate a simpler Apache combined log shape:

```text
198.51.100.20 - - [29/Apr/2026:10:01:00 -0600] "GET /.env HTTP/1.1" 404 196 "-" "curl/8.0"
```

In this case there may be no explicit vhost or host fields in the line. The parser keeps going with the fields that are available.

## Example categories

Safe example requests that the parser may classify:

```text
203.0.113.10 example.com example.com - - [29/Apr/2026:10:00:00 -0600] "POST /xmlrpc.php HTTP/1.1" 405 4329 "-" "WordPress.com"
198.51.100.20 example.com example.com - - [29/Apr/2026:10:02:00 -0600] "POST /wp-login.php HTTP/1.1" 403 512 "-" "Mozilla/5.0"
192.0.2.30 staging.example.com staging.example.com - - [29/Apr/2026:10:03:00 -0600] "GET /.git/config HTTP/1.1" 404 196 "-" "Mozilla/5.0"
203.0.113.10 api.example.com api.example.com - - [29/Apr/2026:10:04:00 -0600] "GET /swagger-ui HTTP/1.1" 404 196 "-" "Mozilla/5.0"
198.51.100.20 api.example.com api.example.com - - [29/Apr/2026:10:05:00 -0600] "POST /graphql HTTP/1.1" 404 210 "-" "Mozilla/5.0"
192.0.2.30 example.com example.com - - [29/Apr/2026:10:06:00 -0600] "\\x16\\x03\\x01\\x02\\x00" 400 226 "-" "-"
```

These may map to categories such as:

- `xmlrpc`
- `wp-login`
- `.git probe`
- `swagger/api docs`
- `graphql/api probing`
- `protocol probe`

## Malformed lines

The parser is intentionally defensive. If a line does not match one of the expected patterns or the timestamp cannot be parsed, that line should be skipped instead of crashing the whole run.

## Notes for custom Apache formats

If your Apache log format differs significantly, you may need to adjust the parser patterns so the fields line up correctly.

The most important fields for this dashboard are:

- client IP
- timestamp
- request line
- status code
- host or virtual host when available
- user agent

## Example parser command

```bash
python3 parser/parse_logs.py \
  --log /var/log/httpd/access_log \
  --out public/data/log-summary.json \
  --limit 8600
```
