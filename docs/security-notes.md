# Security Notes

## Overview

This repository is intended to be safe for public sharing. That means the code, examples, docs, and sample data should teach the workflow without exposing real infrastructure details.

This project is a lightweight Apache log dashboard for learning, visibility, and basic security monitoring. It is not a full SIEM, and it should not be treated as a complete security control on its own.

## Never commit production data

Do not commit:

- real Apache access logs
- real generated `log-summary.json`
- real IP addresses from production traffic
- real domains, subdomains, or internal hostnames
- real usernames
- real server paths that identify infrastructure
- real certificates, private keys, or `.htpasswd` files
- `.env` files
- Fail2Ban ban lists
- firewall exports that include production IP addresses
- internal incident notes or debugging notes copied from a live environment

## Use safe placeholders

When writing examples, use placeholders such as:

- `example.com`
- `logs.example.com`
- `staging.example.com`
- `203.0.113.10`
- `198.51.100.20`
- `192.0.2.30`
- `/var/www/log-dashboard/public`
- `/var/log/httpd/access_log`
- `/path/to/fullchain.pem`
- `/path/to/privkey.pem`
- `YOUR.PUBLIC.IP.HERE`

Use only documentation IP ranges:

- `192.0.2.0/24`
- `198.51.100.0/24`
- `203.0.113.0/24`

## Public release checklist

Before publishing or updating the public repository:

1. Remove real logs and production-generated summaries.
2. Replace any live examples with sanitized sample data.
3. Confirm Apache and Fail2Ban configs use placeholders only.
4. Confirm docs contain no real domains, real IPs, or environment-specific paths.
5. Review `.gitignore` to ensure generated outputs and secrets stay excluded.
6. Re-run grep-based privacy checks across the repository.

## Why the sample data matters

The sample JSON and sample log examples let people understand the dashboard and parser behavior without needing access to a real server.

That sample data should stay:

- synthetic
- generic
- educational
- consistent with the parser schema

## Deployment safety reminders

- Keep the dashboard read-only from the browser side.
- Prefer serving the dashboard behind authentication if it is exposed publicly.
- Consider an Apache default deny vhost for unknown hosts.
- Test Fail2Ban filters carefully before enabling aggressive bans.
- Use reload instead of restart in Fail2Ban when possible so existing bans are preserved.

## If sensitive data was committed previously

If real production data was committed earlier and you plan to publish the project, consider starting from a clean public history:

```bash
rm -rf .git
git init
git add .
git commit -m "Initial public release"
```

Review the repository contents carefully before doing this.
