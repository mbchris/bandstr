#!/usr/bin/env python3
"""
validate-env.py
Validates environment files against .env.template.
Checks which keys are set/empty/missing and prints the length & last 8 bytes of every value.
"""

import sys
import os

# ANSI Colors
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
CYAN = "\033[36m"
GRAY = "\033[90m"

def parse_env_file(filepath):
    """
    Parses a .env file supporting multiline values and comments.
    Returns: dict of {key: value_str}, and list of ordered keys.
    """
    entries = {}
    ordered_keys = []
    if not os.path.exists(filepath):
        return entries, ordered_keys

    with open(filepath, "rb") as f:
        content = f.read().decode("utf-8", errors="replace")

    current_key = None
    current_val = []
    in_quotes = None

    for line in content.splitlines():
        stripped = line.strip()
        if not current_key:
            if not stripped or stripped.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip()
            if (v.startswith('"') and not v.endswith('"')) or (v.startswith("'") and not v.endswith("'")):
                in_quotes = v[0]
                current_key = k
                current_val = [v[1:]]
            elif (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                val = v[1:-1]
                entries[k] = val
                ordered_keys.append(k)
            else:
                entries[k] = v
                ordered_keys.append(k)
        else:
            if in_quotes and line.endswith(in_quotes):
                current_val.append(line[:-1])
                entries[current_key] = "\n".join(current_val)
                ordered_keys.append(current_key)
                current_key = None
                in_quotes = None
            else:
                current_val.append(line)

    return entries, ordered_keys


def get_template_sections(template_path):
    """
    Reads .env.template and extracts sections and ordered keys with comments.
    """
    sections = []
    current_section = "General"
    current_keys = []

    if not os.path.exists(template_path):
        return [("All Keys", [])]

    with open(template_path, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped.startswith("# ---") or stripped.startswith("# ==="):
                continue
            if stripped.startswith("# ") and any(c.isdigit() for c in stripped[:5]):
                # New section detected
                if current_keys:
                    sections.append((current_section, current_keys))
                    current_keys = []
                current_section = stripped[2:].strip()
                continue
            if stripped and not stripped.startswith("#") and "=" in stripped:
                k = stripped.split("=", 1)[0].strip()
                current_keys.append(k)

    if current_keys:
        sections.append((current_section, current_keys))

    return sections


def format_last_8_bytes(val):
    if not val:
        return f"{GRAY}(empty){RESET}"
    b = val.encode("utf-8")
    b_len = len(b)
    if b_len <= 8:
        # If <= 8 bytes, show full value safely
        safe_repr = b.decode("utf-8", errors="replace").replace("\n", "\\n")
        return f"{GREEN}{safe_repr}{RESET}"
    else:
        last_8 = b[-8:].decode("utf-8", errors="replace").replace("\n", "\\n")
        return f"{GREEN}...{last_8}{RESET}"


def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    env_file = sys.argv[1] if len(sys.argv) > 1 else os.path.join(repo_root, ".env")
    template_file = os.path.join(repo_root, ".env.template")

    if not os.path.exists(env_file):
        print(f"{RED}Error: Target file not found: {env_file}{RESET}")
        sys.exit(1)

    env_map, env_keys = parse_env_file(env_file)
    template_sections = get_template_sections(template_file)
    all_template_keys = [k for _, keys in template_sections for k in keys]
    template_key_set = set(all_template_keys)

    print(f"\n{BOLD}{CYAN}========================================================================================{RESET}")
    print(f"{BOLD}{CYAN}                     Environment Validation & Tail-Byte Inspector                       {RESET}")
    print(f"{BOLD}{CYAN}========================================================================================{RESET}")
    print(f"Target File:   {BOLD}{os.path.relpath(env_file, repo_root)}{RESET}")
    print(f"Template File: {BOLD}{os.path.relpath(template_file, repo_root)}{RESET}\n")

    total_set = 0
    total_empty = 0
    total_missing = 0

    col_key_w = 40
    col_status_w = 10
    col_len_w = 10
    col_tail_w = 20

    header = f"{'KEY NAME':<{col_key_w}} | {'STATUS':<{col_status_w}} | {'BYTES':<{col_len_w}} | {'LAST 8 BYTES':<{col_tail_w}}"
    print(f"{BOLD}{header}{RESET}")
    print("-" * (col_key_w + col_status_w + col_len_w + col_tail_w + 9))

    for section_name, keys in template_sections:
        print(f"\n{BOLD}{YELLOW}# {section_name}{RESET}")
        for key in keys:
            if key not in env_map and key not in env_keys:
                status_str = f"{RED}MISSING{RESET}"
                len_str = "-"
                tail_str = f"{RED}(not in file){RESET}"
                total_missing += 1
            else:
                val = env_map.get(key, "")
                if val:
                    status_str = f"{GREEN}SET{RESET}"
                    b_len = len(val.encode("utf-8"))
                    len_str = f"{b_len} B"
                    tail_str = format_last_8_bytes(val)
                    total_set += 1
                else:
                    status_str = f"{YELLOW}EMPTY{RESET}"
                    len_str = "0 B"
                    tail_str = f"{GRAY}(empty){RESET}"
                    total_empty += 1

            print(f"{key:<{col_key_w}} | {status_str:<{col_status_w + 9}} | {len_str:<{col_len_w}} | {tail_str}")

    # Check for extra keys in .env that were not in .env.template
    extra_keys = [k for k in env_keys if k not in template_key_set]
    if extra_keys:
        print(f"\n{BOLD}{YELLOW}# Extra Keys Found (Not in .env.template){RESET}")
        for key in extra_keys:
            val = env_map.get(key, "")
            if val:
                status_str = f"{GREEN}SET{RESET}"
                b_len = len(val.encode("utf-8"))
                len_str = f"{b_len} B"
                tail_str = format_last_8_bytes(val)
                total_set += 1
            else:
                status_str = f"{YELLOW}EMPTY{RESET}"
                len_str = "0 B"
                tail_str = f"{GRAY}(empty){RESET}"
                total_empty += 1
            print(f"{key:<{col_key_w}} | {status_str:<{col_status_w + 9}} | {len_str:<{col_len_w}} | {tail_str}")

    print("\n" + "=" * (col_key_w + col_status_w + col_len_w + col_tail_w + 9))
    print(f"{BOLD}VALIDATION SUMMARY:{RESET}")
    print(f"  Total Expected Keys: {BOLD}{len(all_template_keys)}{RESET}")
    print(f"  Keys SET (non-empty): {GREEN}{BOLD}{total_set}{RESET}")
    print(f"  Keys EMPTY:           {YELLOW}{BOLD}{total_empty}{RESET}")
    print(f"  Keys MISSING:         {RED}{BOLD}{total_missing}{RESET}")
    if extra_keys:
        print(f"  Extra Keys:           {CYAN}{BOLD}{len(extra_keys)}{RESET}")
    print("=" * (col_key_w + col_status_w + col_len_w + col_tail_w + 9) + "\n")


if __name__ == "__main__":
    main()
