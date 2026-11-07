#!/usr/bin/env python3
"""Report public npm advisory data only. Existing debt is not a secret-scan pass."""
import json
import subprocess
import sys

result = subprocess.run(["npm", "audit", "--package-lock-only", "--ignore-scripts", "--json"],
                        capture_output=True, text=True, timeout=180)
try:
    data = json.loads(result.stdout)
    if result.returncode not in (0, 1) or "metadata" not in data or "error" in data:
        raise ValueError()
    report = {
        "summary": data["metadata"].get("vulnerabilities", {}),
        "packages": [{
            "name": name,
            "severity": info.get("severity"),
            "direct": info.get("isDirect", False),
            "range": info.get("range"),
            "fixAvailable": info.get("fixAvailable", False),
            "advisories": [{
                "id": item.get("source"), "url": item.get("url"),
                "title": item.get("title"), "severity": item.get("severity")
            } for item in info.get("via", []) if isinstance(item, dict)],
        } for name, info in sorted(data.get("vulnerabilities", {}).items())]
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    severe = report["summary"].get("high", 0) + report["summary"].get("critical", 0)
    sys.exit(1 if severe else 0)
except (ValueError, KeyError, TypeError):
    print('{"error":"dependency-audit-incomplete"}')
    sys.exit(2)
