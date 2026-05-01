#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_LOG = "/var/log/httpd/access_log"
DEFAULT_OUT = "public/data/log-summary.json"
DEFAULT_LIMIT = 8600
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
ENV_LIMIT_KEY = "PARSER_LIMIT"
TOP_LIMIT = 20
RECENT_LIMIT = 100
TIMELINE_LIMIT = 60
IP_REPORT_RECENT_LIMIT = 10
IP_REPORT_TOP_LIMIT = 10

EXTENDED_PATTERN = re.compile(
    r'^(?P<ip>\S+)\s+'
    r'(?P<vhost>\S+)\s+'
    r'(?P<host>\S+)\s+'
    r'\S+\s+\S+\s+'
    r'\[(?P<time>[^\]]+)\]\s+'
    r'"(?P<request>[^"]*)"\s+'
    r'(?P<status>\d{3})\s+'
    r'(?P<size>\S+)\s+'
    r'"(?P<referer>[^"]*)"\s+'
    r'"(?P<ua>[^"]*)"'
)

COMBINED_PATTERN = re.compile(
    r'^(?P<ip>\S+)\s+'
    r'\S+\s+\S+\s+'
    r'\[(?P<time>[^\]]+)\]\s+'
    r'"(?P<request>[^"]*)"\s+'
    r'(?P<status>\d{3})\s+'
    r'(?P<size>\S+)\s+'
    r'"(?P<referer>[^"]*)"\s+'
    r'"(?P<ua>[^"]*)"'
)


def parse_args():
    env = load_env_file(ENV_FILE)
    limit_default = load_int_setting(ENV_LIMIT_KEY, DEFAULT_LIMIT, env)

    parser = argparse.ArgumentParser(
        description="Parse Apache access logs into dashboard summary JSON."
    )
    parser.add_argument("--log", default=DEFAULT_LOG, help="Path to Apache access log.")
    parser.add_argument(
        "--out",
        default=DEFAULT_OUT,
        help="Path to write the JSON summary.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=limit_default,
        help="Number of most recent log lines to parse.",
    )
    return parser.parse_args()


def load_env_file(path):
    values = {}
    if not path.exists():
        return values

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key:
            values[key] = value

    return values


def load_int_setting(name, fallback, file_values):
    raw_value = os.getenv(name, file_values.get(name))
    if raw_value in (None, ""):
        return fallback

    try:
        return int(raw_value)
    except ValueError as error:
        raise SystemExit(f"Invalid integer for {name}: {raw_value}") from error


def parse_timestamp(value):
    try:
        return datetime.strptime(value, "%d/%b/%Y:%H:%M:%S %z")
    except ValueError:
        return None


def parse_request_details(request):
    parts = request.split()
    if len(parts) >= 2:
        method = parts[0]
        raw_path = parts[1]
        normalized_path = raw_path.split("?", 1)[0] or raw_path
        return {
            "method": method,
            "normalized_path": normalized_path,
        }

    return {
        "method": "",
        "normalized_path": request,
    }


def parse_line(line):
    match = EXTENDED_PATTERN.match(line) or COMBINED_PATTERN.match(line)
    if not match:
        return None

    data = match.groupdict()
    data.setdefault("vhost", "-")
    data.setdefault("host", "-")

    timestamp = parse_timestamp(data["time"])
    if timestamp is None:
        return None

    request = data["request"].strip()
    user_agent = data["ua"].strip()
    host = data["host"] if data["host"] != "-" else data["vhost"]
    minute_key = timestamp.strftime("%Y-%m-%d %H:%M")
    request_details = parse_request_details(request)

    return {
        "ip": data["ip"],
        "vhost": data["vhost"],
        "host": host,
        "time": data["time"],
        "timestamp": timestamp,
        "minute": timestamp.strftime("%H:%M"),
        "minute_key": minute_key,
        "request": request,
        "method": request_details["method"],
        "path": request_details["normalized_path"],
        "status": data["status"],
        "ua": user_agent,
        "category": categorize_request(request, user_agent),
    }


def categorize_request(request, user_agent):
    text = f"{request} {user_agent}".lower()

    if "xmlrpc.php" in text:
        return "xmlrpc"
    if "/wp-login.php" in text:
        return "wp-login"
    if "/wp-admin/install.php" in text or "/wp-admin/setup-config.php" in text:
        return "wp-admin setup/install"
    if "/wp-content/plugins/" in text or "/wp-content/themes/" in text:
        return "wordpress/plugin probe"
    if ".env" in text or "/@vite/env" in text or "/actuator/env" in text:
        if "/actuator/env" in text:
            return "actuator/env"
        return ".env probe"
    if ".git/config" in text:
        return ".git probe"
    if "phpinfo" in text or "/info.php" in text:
        return "phpinfo/info.php"
    if "cmd=" in text:
        return "cmd injection"
    if (
        "/swagger" in text
        or "/swagger-ui" in text
        or "/api-docs" in text
        or "/api/swagger.json" in text
        or "/v2/api-docs" in text
        or "/v3/api-docs" in text
    ):
        return "swagger/api docs"
    if "/graphql" in text or "/api/graphql" in text or "/api/gql" in text:
        return "graphql/api probing"
    if "/debug/default/view" in text or "/telescope/requests" in text:
        return "laravel debug/telescope"
    if "/php-cgi/php-cgi.exe" in text:
        return "php-cgi exploit"
    if "\\x16\\x03" in request.lower() or "pri * http/2.0" in text:
        return "protocol probe"
    if is_known_crawler(text):
        return "known crawler"
    if is_video_or_app(text):
        return "video/app"
    return "normal"


def is_known_crawler(text):
    crawler_markers = (
        "googlebot",
        "bingbot",
        "duckduckbot",
        "yandexbot",
        "baiduspider",
        "petalbot",
        "facebookexternalhit",
        "slackbot",
        "twitterbot",
        "linkedinbot",
        "applebot",
        "crawler",
        "spider",
        "bot/",
    )
    return any(marker in text for marker in crawler_markers)


def is_video_or_app(text):
    app_markers = (
        "exoplayer",
        "okhttp",
        "cfnetwork",
        "exampleplayer",
        "dalvik",
        ".m3u8",
        ".mp4",
        ".mpd",
        "android",
        "iphone",
        "ipad",
    )
    return any(marker in text for marker in app_markers)


def tail_lines(path, limit):
    if not path.exists():
        raise FileNotFoundError(f"Log file not found: {path}")

    with path.open("r", errors="ignore") as handle:
        if limit <= 0:
            return list(handle)
        return list(deque(handle, maxlen=limit))


def summarize_public_row(row):
    item = dict(row)
    item.pop("minute_key", None)
    item.pop("timestamp", None)
    item.pop("method", None)
    item.pop("path", None)
    return item


def classify_ip_report(categories):
    if categories.get("wp-login", 0) >= 3:
        return "WordPress brute force"

    if categories.get("xmlrpc", 0) > 0:
        return "XML-RPC abuse"

    scanner_categories = {
        ".env probe",
        ".git probe",
        "swagger/api docs",
        "graphql/api probing",
        "laravel debug/telescope",
        "actuator/env",
        "phpinfo/info.php",
        "php-cgi exploit",
        "cmd injection",
        "wordpress/plugin probe",
        "wp-admin setup/install",
    }
    if any(categories.get(name, 0) > 0 for name in scanner_categories):
        return "Scanner / recon"

    if categories.get("known crawler", 0) > 0:
        return "Crawler"

    if categories.get("protocol probe", 0) > 0:
        return "Protocol noise"

    if categories:
        dominant_category = max(categories.items(), key=lambda item: item[1])[0]
        if dominant_category in {"normal", "video/app"}:
            return "Normal traffic"

    return "Unknown"


def build_ip_reports(rows):
    grouped = defaultdict(list)
    for row in rows:
        grouped[row["ip"]].append(row)

    reports = {}
    for ip, ip_rows in grouped.items():
        sorted_rows = sorted(ip_rows, key=lambda row: row["timestamp"])
        categories = dict(Counter(row["category"] for row in ip_rows))
        reports[ip] = {
            "ip": ip,
            "total": len(ip_rows),
            "first_seen": sorted_rows[0]["time"],
            "last_seen": sorted_rows[-1]["time"],
            "hosts": Counter(row["host"] for row in ip_rows).most_common(IP_REPORT_TOP_LIMIT),
            "statuses": dict(Counter(row["status"] for row in ip_rows)),
            "categories": categories,
            "top_paths": Counter(row["path"] for row in ip_rows).most_common(IP_REPORT_TOP_LIMIT),
            "user_agents": Counter(row["ua"] for row in ip_rows).most_common(IP_REPORT_TOP_LIMIT),
            "recent": [
                {
                    "time": row["time"],
                    "host": row["host"],
                    "status": row["status"],
                    "category": row["category"],
                    "request": row["request"],
                }
                for row in sorted_rows[-IP_REPORT_RECENT_LIMIT:]
            ],
            "classification": classify_ip_report(categories),
        }

    return reports


def build_summary(rows):
    by_minute_category = defaultdict(Counter)
    for row in rows:
        by_minute_category[row["minute_key"]][row["category"]] += 1

    timeline = []
    for minute_key in sorted(by_minute_category):
        item = {
            "minute": minute_key[-5:],
        }
        item.update(by_minute_category[minute_key])
        timeline.append(item)

    recent_rows = []
    for row in rows[-RECENT_LIMIT:]:
        recent_rows.append(summarize_public_row(row))

    return {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "total": len(rows),
        "by_category": dict(Counter(row["category"] for row in rows)),
        "by_status": dict(Counter(row["status"] for row in rows)),
        "top_ips": Counter(row["ip"] for row in rows).most_common(TOP_LIMIT),
        "top_hosts": Counter(row["host"] for row in rows).most_common(TOP_LIMIT),
        "ip_reports": build_ip_reports(rows),
        "timeline": timeline[-TIMELINE_LIMIT:],
        "recent": recent_rows,
    }


def main():
    args = parse_args()
    log_path = Path(args.log)
    out_path = Path(args.out)

    try:
        lines = tail_lines(log_path, args.limit)
    except FileNotFoundError as error:
        print(str(error), file=sys.stderr)
        return 1

    rows = []
    for line in lines:
        parsed = parse_line(line)
        if parsed is not None:
            rows.append(parsed)

    summary = build_summary(rows)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w") as handle:
        json.dump(summary, handle, indent=2)
        handle.write("\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
