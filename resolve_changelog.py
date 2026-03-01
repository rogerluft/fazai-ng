import sys

content = ""
with open('CHANGELOG.md', 'r') as f:
    content = f.read()

conflict_marker_start = "<<<<<<< HEAD"
conflict_separator = "======="
conflict_marker_end = ">>>>>>> origin/master"

parts = content.split(conflict_marker_start)
if len(parts) > 1:
    pre_conflict = parts[0]
    rest = parts[1]

    conflict_parts = rest.split(conflict_separator)
    head_content = conflict_parts[0]
    rest2 = conflict_parts[1]

    conflict_end_parts = rest2.split(conflict_marker_end)
    origin_content = conflict_end_parts[0]
    post_conflict = conflict_end_parts[1]

    # Clean up origin content to remove any mention of OpenClaw
    origin_content_clean = origin_content.replace("openclaw", "sqlite").replace("OpenClaw", "SQLite")

    resolved_content = pre_conflict + head_content.strip() + "\n\n" + origin_content_clean.strip() + "\n" + post_conflict

    with open('CHANGELOG.md', 'w') as f:
        f.write(resolved_content)

    print("Resolved CHANGELOG.md")
else:
    print("No conflict found")
