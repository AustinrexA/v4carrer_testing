"""Run each portal with a configured Apify Actor, continuing after failures."""
import argparse
import os
import subprocess
import sys
from contextlib import contextmanager
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))
from collectors.source_catalog import JOB_PORTALS, DEFAULT_APIFY_ACTORS


@contextmanager
def collection_lock():
    """Prevent overlapping collection batches across scheduler/manual runs."""
    lock_path = ROOT / ".collection.lock"
    handle = open(lock_path, "a+b")
    try:
        handle.seek(0, os.SEEK_END)
        if handle.tell() == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (OSError, BlockingIOError) as exc:
            raise SystemExit("Another V4Career collection batch is already running.") from exc
        yield
    finally:
        try:
            handle.seek(0)
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        except OSError:
            pass
        handle.close()


def run_batch(args):
    runner = ROOT / "scripts" / "run_source_apify.py"
    configured, skipped, failed = 0, [], []
    for portal in JOB_PORTALS:
        key = portal["key"]
        actor_id = os.getenv(f"APIFY_ACTOR_{key}", "").strip()
        if key == "NAUKRI" and not actor_id:
            actor_id = os.getenv("APIFY_NAUKRI_ACTOR_ID", "").strip()
        if not actor_id:
            actor_id = DEFAULT_APIFY_ACTORS.get(key, "")
        approved = os.getenv(f"APIFY_ACCESS_APPROVED_{key}", "false").lower() == "true"
        if not actor_id or not approved:
            skipped.append(portal["name"].strip())
            continue
        configured += 1
        command = [sys.executable, str(runner), "--source", portal["key"],
                   "--keyword", args.keyword, "--location", args.location,
                   "--max-results", str(args.max_results)]
        print(f"\n=== Collecting {portal['name'].strip()} ===", flush=True)
        result = subprocess.run(command, cwd=ROOT, check=False)
        if result.returncode:
            failed.append(portal["name"].strip())
            print(f"Collection failed for {portal['name'].strip()} (exit {result.returncode}); continuing.", flush=True)
    print("\n=== Collection summary ===")
    print(f"Configured portals attempted: {configured}")
    print(f"Skipped (Actor missing or approval not enabled): {len(skipped)}")
    if skipped: print("Skipped: " + ", ".join(skipped))
    print(f"Failed: {len(failed)}")
    if failed: print("Failed: " + ", ".join(failed))
    if failed: raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(description="Run all approved/configured V4Career Apify sources")
    parser.add_argument("--keyword", default="Software Engineer")
    parser.add_argument("--location", default="India")
    parser.add_argument("--max-results", type=int, default=20)
    args = parser.parse_args()
    if args.location.strip().lower() not in {"india"} and not args.location.strip().lower().endswith(", india"):
        parser.error("V4Career is configured for India-only collection. Use --location India or an Indian city/state ending in ', India'.")
    if not 1 <= args.max_results <= 500:
        parser.error("--max-results must be between 1 and 500")
    if not os.getenv("APIFY_API_TOKEN", "").strip():
        raise SystemExit("APIFY_API_TOKEN is missing from your local .env file.")
    with collection_lock():
        run_batch(args)


if __name__ == "__main__":
    main()
