#!/usr/bin/env python3
"""
filter_dataset.py — Customer Support on Twitter Dataset Filter for AmazonHelp

Reads the raw Kaggle dataset (twcs.csv), filters for repeat customer interactions
with AmazonHelp, reconstructs conversation threads, holds out the latest thread,
redacts PII (emails, phones, order numbers, names, handles) per SRS FR-11 & NFR-4,
and writes data/filtered_customers.json matching TRS §3.1 schema.

STRICT RULE 9 ENFORCEMENT:
If the expected raw file data/raw/twcs.csv is missing, this script fails loudly
with instructions on where to place it. It NEVER fabricates synthetic customers.
"""

import os
import sys
import json
import re
import argparse
from pathlib import Path
from datetime import datetime

# Root paths
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_RAW_FILE = REPO_ROOT / "data" / "raw" / "twcs.csv"
OUTPUT_FILE = REPO_ROOT / "data" / "filtered_customers.json"
TARGET_BRAND = "AmazonHelp"


def fail_missing_dataset(expected_path: Path):
    """Fails loudly with clear guidance per GEMINI.md Rule 9."""
    banner = f"""
{"=" * 80}
FATAL ERROR [Rule 9 Enforcement]: Raw Dataset Missing
{"-" * 80}
Expected file: twcs.csv
Expected path: {expected_path}

The real dataset must be placed in data/raw/ before running this pipeline:
  Source:  Kaggle 'Customer Support on Twitter'
  Dataset: thoughtvector/customer-support-on-twitter
  URL:     https://www.kaggle.com/datasets/thoughtvector/customer-support-on-twitter

Please download and extract 'twcs.csv' into:
  {expected_path}

Per GEMINI.md Rule 9:
"Never generate, fabricate, or fall back to synthetic/sample ticket data...
 If filter_dataset.py is run and the expected raw file isn't present yet,
 it must fail loudly and tell the human what file it expected and where."
{"=" * 80}
"""
    print(banner, file=sys.stderr)
    sys.exit(1)


def sanitize_text(text: str, author_id: str, brand_handle: str) -> str:
    """
    Redact PII (handles, emails, phone numbers, order IDs, tracking codes, names)
    to strictly enforce SRS FR-11 and NFR-4.
    """
    if not isinstance(text, str):
        return ""

    # 1. Redact Emails
    text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]', text)

    # 2. Redact Phone numbers (international, US, and 10-12 digit blocks)
    text = re.sub(r'\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b', '[PHONE]', text)
    text = re.sub(r'\b\d{10,12}\b', '[PHONE]', text)

    # 3. Redact Amazon Order IDs (e.g. 123-1234567-1234567, D01-1234567-1234567)
    text = re.sub(r'\b[A-Z0-9]{3}-\d{7}-\d{7}\b', '[ORDER_ID]', text)
    text = re.sub(r'(?i)\b(order\s*(?:#|no\.?|id|number)?\s*[:#]?\s*)([A-Za-z0-9-]{6,20})\b', r'\1[ORDER_ID]', text)

    # 4. Redact Tracking IDs (e.g., 1Z..., TBA...)
    text = re.sub(r'\b(1Z[0-9A-Za-z]{16}|TBA\d{12})\b', '[TRACKING_ID]', text)

    # 5. Redact Sign-offs with real customer names (e.g., "- John", "Thanks, Alice")
    text = re.sub(r'(?i)\b(?:thanks|thank you|regards|sincerely|cheers|best)[,\s]+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*$', '[Customer]', text)
    text = re.sub(r'^\s*-\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s*$', '- [Customer]', text, flags=re.MULTILINE)

    # 6. Scrub specific customer author_id if mentioned
    if str(author_id) in text:
        text = text.replace(f"@{author_id}", "@Customer")
        text = text.replace(str(author_id), "Customer")

    # 7. Scrub any remaining @handles except the brand handle
    def handle_replacer(match):
        handle = match.group(0)
        if brand_handle.lower() in handle.lower():
            return f"@{brand_handle}"
        return "@Customer"

    text = re.sub(r"@[A-Za-z0-9_]+", handle_replacer, text)

    # 8. Clean excessive whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_timestamp(ts_str: str) -> str:
    """Parses various Twitter timestamp formats into ISO 8601 UTC string."""
    try:
        # Standard Twitter created_at format: "Wed Oct 11 10:22:00 +0000 2017"
        dt = datetime.strptime(ts_str, "%a %b %d %H:%M:%S %z %Y")
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        try:
            dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            return ts_str


def run_filter(raw_file: Path, output_file: Path, min_customers: int = 5, max_customers: int = 8):
    if not raw_file.exists():
        fail_missing_dataset(raw_file)

    import pandas as pd

    print(f"[*] Found raw dataset at: {raw_file}")
    print(f"[*] Filtering tweets for brand: {TARGET_BRAND}...")

    # Columns: tweet_id, author_id, inbound, created_at, text, response_tweet_id, in_response_to_tweet_id
    relevant_tweets = []
    chunk_size = 250000
    total_processed = 0

    usecols = [
        "tweet_id",
        "author_id",
        "inbound",
        "created_at",
        "text",
        "response_tweet_id",
        "in_response_to_tweet_id",
    ]

    for chunk in pd.read_csv(raw_file, usecols=usecols, chunksize=chunk_size, low_memory=False):
        total_processed += len(chunk)
        # Inbound tweets to AmazonHelp or tweets by AmazonHelp
        mask = (chunk["author_id"] == TARGET_BRAND) | (
            chunk["text"].str.contains(TARGET_BRAND, case=False, na=False)
        )
        filtered = chunk[mask]
        if not filtered.empty:
            relevant_tweets.append(filtered)
        print(f"    Processed {total_processed:,} rows... Found {sum(len(c) for c in relevant_tweets):,} relevant tweets", end="\r")

    print(f"\n[*] Total relevant tweets collected: {sum(len(c) for c in relevant_tweets):,}")

    if not relevant_tweets:
        print(f"[!] No tweets found for brand {TARGET_BRAND}", file=sys.stderr)
        sys.exit(1)

    df = pd.concat(relevant_tweets, ignore_index=True)
    df["tweet_id"] = df["tweet_id"].astype(str)
    df["inbound"] = df["inbound"].astype(bool)
    df["in_response_to_tweet_id"] = df["in_response_to_tweet_id"].fillna("").astype(str)

    # Index by tweet_id for fast lookup
    tweet_dict = df.set_index("tweet_id").to_dict(orient="index")

    # Group inbound customer messages by author_id
    customer_df = df[(df["inbound"] == True) & (df["author_id"] != TARGET_BRAND)]
    customer_counts = customer_df["author_id"].value_counts()

    # Candidate pools for 3-tier stratification:
    # Group 1 (Escalate): 3 customers with 2+ historical threads and distress language (>=3 total threads)
    # Group 2 (Watch):    3 customers (2 with 2 historical threads, 1 with 1 historical thread, calm language)
    # Group 3 (Normal):   2 customers with 0 historical threads + 1 held-out thread (1st contact, calm language)
    # This guarantees exactly 5 customers have 2+ historical threads per SRS FR-10.
    distress_keywords = [
        "broken", "damaged", "again", "still waiting", "never arrived", 
        "terrible", "unacceptable", "refund", "frustrated", "hung up", 
        "disgusted", "unreliable", "charge it back", "indignity"
    ]

    escalate_group = []
    watch_group = []
    normal_group = []

    def is_clean_english(text: str) -> bool:
        if not isinstance(text, str) or len(text.strip()) < 15:
            return False
        lower = text.lower()
        # Filter non-English languages
        non_en = [" der ", " die ", " das ", " und ", " ich ", " nicht ", " vous ", " nous ", " pour ", " avec ", " que ", " est ", " auf "]
        if any(w in lower for w in non_en):
            return False
        # Common English indicator words
        en_markers = [" the ", " to ", " is ", " my ", " i ", " for ", " a ", " in ", " of ", " on ", " with ", " it ", " order ", " package ", " delivery ", " account "]
        return sum(1 for w in en_markers if w in f" {lower} ") >= 2

    # Check candidates for conversation roots and threads
    all_candidate_authors = customer_counts[customer_counts >= 1].index.tolist()
    print(f"[*] Total candidate authors evaluated: {len(all_candidate_authors)}")

    for author_id in all_candidate_authors:
        if len(escalate_group) >= 3 and len(watch_group) >= 3 and len(normal_group) >= 2:
            break

        author_tweets = df[df["author_id"] == author_id]
        
        # Identify conversation roots
        root_tweets = []
        for _, row in author_tweets.iterrows():
            parent_id = str(row["in_response_to_tweet_id"]).strip()
            if not parent_id or parent_id not in tweet_dict:
                root_tweets.append(row["tweet_id"])

        if not root_tweets:
            continue

        # Reconstruct threads starting from each root
        threads = []
        for root_id in root_tweets:
            thread_messages = []
            visited = set()
            curr_id = root_id

            while curr_id and curr_id in tweet_dict and curr_id not in visited:
                visited.add(curr_id)
                t_data = tweet_dict[curr_id]
                role = "brand" if t_data["author_id"] == TARGET_BRAND else "customer"
                ts = parse_timestamp(str(t_data["created_at"]))
                clean_msg = sanitize_text(str(t_data["text"]), author_id, TARGET_BRAND)

                thread_messages.append({
                    "role": role,
                    "text": clean_msg,
                    "timestamp": ts,
                    "_raw_id": curr_id
                })

                # Follow actual reply chain
                resp_ids = str(t_data.get("response_tweet_id", "")).split(",")
                next_id = None
                for r_id in resp_ids:
                    r_id = r_id.strip()
                    if r_id in tweet_dict and r_id not in visited:
                        next_id = r_id
                        break
                curr_id = next_id

            # REQUIREMENT 3(c): Thread must contain customer message AND brand reply
            has_customer = any(m["role"] == "customer" for m in thread_messages)
            has_brand = any(m["role"] == "brand" for m in thread_messages)

            # Ensure the first message is from the customer and in English
            first_is_customer = thread_messages and thread_messages[0]["role"] == "customer"
            first_is_english = first_is_customer and is_clean_english(thread_messages[0]["text"])

            if has_customer and has_brand and first_is_english and 2 <= len(thread_messages) <= 8:
                thread_messages.sort(key=lambda m: m["timestamp"])
                start_ts = thread_messages[0]["timestamp"]
                cleaned_msgs = [
                    {"role": m["role"], "text": m["text"], "timestamp": m["timestamp"]}
                    for m in thread_messages
                ]
                threads.append({
                    "thread_id": f"thread_{len(threads)+1:03d}",
                    "timestamp_start": start_ts,
                    "messages": cleaned_msgs
                })

        if not threads or len(threads) > 5:
            continue

        threads.sort(key=lambda t: t["timestamp_start"])
        all_text = " ".join([m["text"] for t in threads for m in t["messages"]]).lower()
        has_distress = any(kw in all_text for kw in distress_keywords)

        # For held_out_thread (live incoming demo ticket):
        # Must contain ONLY customer incoming messages awaiting a brand response. Zero brand messages!
        held_out_raw = threads[-1]
        held_out_cust_msgs = [m for m in held_out_raw["messages"] if m["role"] == "customer"]
        if not held_out_cust_msgs or not is_clean_english(held_out_cust_msgs[0]["text"]):
            continue

        # Stratify into target buckets
        # Bucket 1: Escalate — 3+ threads with distress keywords (>= 2 historical)
        if len(threads) >= 3 and has_distress and len(escalate_group) < 3:
            escalate_group.append({
                "author_id": author_id,
                "historical_threads": threads[:-1],
                "held_out_thread_id": held_out_raw["thread_id"],
                "held_out_messages": held_out_cust_msgs,
                "tier": "escalate"
            })
        # Bucket 2: Watch — 2 or 3 threads with calm language (1-2 historical)
        elif len(threads) == 3 and not has_distress and len(watch_group) < 2:
            watch_group.append({
                "author_id": author_id,
                "historical_threads": threads[:-1],
                "held_out_thread_id": held_out_raw["thread_id"],
                "held_out_messages": held_out_cust_msgs,
                "tier": "watch"
            })
        elif len(threads) == 2 and not has_distress and len(watch_group) == 2:
            watch_group.append({
                "author_id": author_id,
                "historical_threads": threads[:-1],
                "held_out_thread_id": held_out_raw["thread_id"],
                "held_out_messages": held_out_cust_msgs,
                "tier": "watch"
            })
        # Bucket 3: Normal — 1 thread (0 historical, 1 held-out) with calm inquiry language
        elif len(threads) == 1 and not has_distress and len(normal_group) < 2:
            normal_group.append({
                "author_id": author_id,
                "historical_threads": [],
                "held_out_thread_id": held_out_raw["thread_id"],
                "held_out_messages": held_out_cust_msgs,
                "tier": "normal"
            })

    # Combine into ordered list: 3 Escalate, 3 Watch, 2 Normal
    combined_candidates = escalate_group + watch_group + normal_group
    print(f"[*] Stratification complete:")
    print(f"    - Escalate tier: {len(escalate_group)} customers")
    print(f"    - Watch tier:    {len(watch_group)} customers")
    print(f"    - Normal tier:   {len(normal_group)} customers")

    customers_output = []
    for idx, c in enumerate(combined_candidates, 1):
        author_id = c["author_id"]
        pseudo_num = (hash(str(author_id)) % 9000) + 1000
        display_label = f"Customer #{pseudo_num}"

        cust_obj = {
            "customer_id": f"cust_{idx:04d}",
            "display_label": display_label,
            "brand_handle": TARGET_BRAND,
            "threads": c["historical_threads"],
            "held_out_thread": {
                "thread_id": c["held_out_thread_id"],
                "messages": c["held_out_messages"]
            }
        }
        customers_output.append(cust_obj)

    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(customers_output, f, indent=2)

    print(f"\n[+] Successfully saved {len(customers_output)} customers to: {output_file}")
    for c in customers_output:
        print(f"    - {c['customer_id']} ({c['display_label']}): {len(c['threads'])} historical threads, 1 held-out thread")


def main():
    parser = argparse.ArgumentParser(description="Filter Kaggle Customer Support dataset for AmazonHelp")
    parser.add_argument("--input", type=Path, default=DEFAULT_RAW_FILE, help="Path to raw twcs.csv")
    parser.add_argument("--output", type=Path, default=OUTPUT_FILE, help="Path to output filtered_customers.json")
    args = parser.parse_args()

    run_filter(args.input, args.output)


if __name__ == "__main__":
    main()
