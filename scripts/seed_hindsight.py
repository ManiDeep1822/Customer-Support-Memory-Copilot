#!/usr/bin/env python3
"""
seed_hindsight.py — Seed Filtered Customer History into Hindsight Cloud

Reads data/filtered_customers.json and retains each customer's historical threads
as Experiences in Hindsight Cloud using the official hindsight-client SDK.

CRITICAL HARD RULE (TRS §3.3):
Every retain call MUST include metadata:
  { "customer_id": "<cust_id>", "brand": "AmazonHelp" }
This ensures per-customer memory isolation.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv

try:
    from hindsight_client import Hindsight
except ImportError:
    Hindsight = None

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
ENV_FILE = REPO_ROOT / ".env"
INPUT_FILE = REPO_ROOT / "data" / "filtered_customers.json"

# Load environment
load_dotenv(dotenv_path=ENV_FILE)

HINDSIGHT_API_KEY = os.getenv("HINDSIGHT_API_KEY", "").strip()
HINDSIGHT_BASE_URL = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io").rstrip("/")
HINDSIGHT_BANK_ID = os.getenv("HINDSIGHT_BANK_ID", "copilot-demo").strip()


def verify_prerequisites(input_path: Path):
    if not input_path.exists():
        print(f"[!] Filtered dataset not found at: {input_path}", file=sys.stderr)
        print("    Please run scripts/filter_dataset.py first to generate real customer data.", file=sys.stderr)
        sys.exit(1)

    missing_keys = []
    if not HINDSIGHT_API_KEY:
        missing_keys.append("HINDSIGHT_API_KEY")
    if not HINDSIGHT_BANK_ID:
        missing_keys.append("HINDSIGHT_BANK_ID")

    if missing_keys:
        print("\n" + "=" * 70, file=sys.stderr)
        print("ERROR: Missing Hindsight Credentials in .env", file=sys.stderr)
        print("-" * 70, file=sys.stderr)
        print(f"Please configure the following keys in {ENV_FILE}:", file=sys.stderr)
        for k in missing_keys:
            print(f"  - {k}", file=sys.stderr)
        print("=" * 70 + "\n", file=sys.stderr)
        sys.exit(1)


def retain_thread(client: Hindsight, customer_id: str, brand: str, thread: dict) -> bool:
    """
    Retains a single conversation thread into Hindsight Cloud.
    Enforces metadata isolation per TRS §3.3.
    """
    # Format conversation text
    dialogue_lines = []
    for msg in thread.get("messages", []):
        speaker = "Customer" if msg.get("role") == "customer" else "AmazonHelp"
        dialogue_lines.append(f"[{msg.get('timestamp')}] {speaker}: {msg.get('text')}")
    thread_text = "\n".join(dialogue_lines)

    metadata = {
        "customer_id": str(customer_id),
        "brand": str(brand),
        "thread_id": str(thread.get("thread_id", "")),
        "timestamp_start": str(thread.get("timestamp_start", ""))
    }

    try:
        res = client.retain(
            bank_id=HINDSIGHT_BANK_ID,
            content=thread_text,
            metadata=metadata,
            tags=[customer_id, brand]
        )
        return getattr(res, "success", True)
    except Exception as e:
        print(f"    [!] Exception while contacting Hindsight: {e}")
        return False


def run_seed(input_path: Path):
    verify_prerequisites(input_path)

    if not Hindsight:
        print("[!] hindsight-client package is required. Run: pip install hindsight-client", file=sys.stderr)
        sys.exit(1)

    client = Hindsight(api_key=HINDSIGHT_API_KEY, base_url=HINDSIGHT_BASE_URL)

    with open(input_path, "r", encoding="utf-8") as f:
        customers = json.load(f)

    print(f"[*] Seeding {len(customers)} customers into Hindsight Bank: {HINDSIGHT_BANK_ID}")
    print(f"[*] Base URL: {HINDSIGHT_BASE_URL}\n")

    total_threads = 0
    successful_threads = 0

    for cust in customers:
        cust_id = cust["customer_id"]
        label = cust["display_label"]
        brand = cust.get("brand_handle", "AmazonHelp")
        threads = cust.get("threads", [])

        print(f"--> Seeding {cust_id} ({label}) — {len(threads)} historical threads...")
        for thread in threads:
            total_threads += 1
            ok = retain_thread(client, cust_id, brand, thread)
            if ok:
                successful_threads += 1
                print(f"    [OK] Retained {thread.get('thread_id')}")

    print(f"\n[+] Seeding complete! Successfully retained {successful_threads}/{total_threads} threads.")


def main():
    parser = argparse.ArgumentParser(description="Seed filtered Twitter support threads into Hindsight Cloud")
    parser.add_argument("--input", type=Path, default=INPUT_FILE, help="Path to filtered_customers.json")
    args = parser.parse_args()

    run_seed(args.input)


if __name__ == "__main__":
    main()
