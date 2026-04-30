# Fail2Ban Rules

## Overview

Fail2Ban can watch the Apache access log and ban clients that hit known scanner or exploit paths. In this project, it is optional and meant to complement the dashboard, not replace broader security controls.

## Jail configuration

A simple jail may look like this:

```ini
[apache-web-scanner]
enabled = true
filter = apache-web-scanner
logpath = /var/log/httpd/access_log
port = http,https
maxretry = 1
findtime = 600
bantime = 86400
action = firewallcmd-rich-rules[name=apache-web-scanner, port="http,https", protocol=tcp]
```

## Filter configuration

The filter should focus on high-signal paths and protocol mismatches such as:

- `/xmlrpc.php`
- `/wp-login.php`
- `/wp-admin/install.php`
- `/.env`
- `/.git/config`
- `/swagger-ui`
- `/graphql`
- `/telescope/requests`
- `/php-cgi/php-cgi.exe`
- TLS handshake bytes sent to an HTTP listener
- `PRI * HTTP/2.0` sent to a plain HTTP listener

Do not put comments inside the indented `failregex =` block. Fail2Ban may interpret those lines as regex entries.

## Why `maxretry = 1` can be reasonable

For scanner-only rules, `maxretry = 1` can be reasonable because many of these paths are high-signal and rarely appear in normal browsing. That said, every environment is different, so test carefully before using aggressive bans.

## How to test filters

Use `fail2ban-regex` against a representative log file:

```bash
sudo fail2ban-regex /var/log/httpd/access_log /etc/fail2ban/filter.d/apache-web-scanner.conf
```

Review both the number of matches and the specific matched lines before enabling a jail in production.

## How to reload safely

Use reload instead of restart when possible so active bans are preserved:

```bash
sudo fail2ban-client reload
```

## How to check status

These commands are useful during rollout and troubleshooting:

```bash
sudo fail2ban-client status
sudo fail2ban-client status apache-web-scanner
sudo tail -f /var/log/fail2ban.log
```

## Common errors

- The jail name and filter name do not match.
- The `logpath` points to the wrong Apache log.
- The regex expects a different Apache log format than the one being written.
- Comments were placed inside the `failregex =` block.
- A restart was used instead of a reload and existing bans were dropped.
