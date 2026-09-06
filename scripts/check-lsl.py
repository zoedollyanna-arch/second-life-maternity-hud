"""Static checks for the Nestoria LSL scripts.

The Second Life script editor is the only real compiler, and it only tells you
about the first error it hits. These checks catch the mistakes that are easy to
make here and slow to find in world.

    python scripts/check-lsl.py

Note for anyone extending this: strip string literals BEFORE comments. Doing it
the other way round reads the "//" inside "https://..." as a comment, eats the
rest of the line including the closing quote, and every count after it is wrong.
"""

import re
import io
import sys
import os
import glob

STR_RE = re.compile(r'"(?:\\.|[^"\\])*"')
COMMENT_RE = re.compile(r'//[^\n]*')
FDEF_RE = re.compile(r'^(?:[A-Za-z_]\w*\s+)?([a-zA-Z_]\w*)\s*\([^;{)]*\)\s*$', re.M)

TYPES = ["integer", "float", "string", "key", "vector", "rotation", "quaternion", "list"]

# Reserved words that cannot be used as an identifier. `key` is the one that
# actually bit us: "string key = ..." looks perfectly reasonable and is a
# syntax error, because key is a type name.
RESERVED = set(TYPES) | {
    "default", "state", "event", "jump", "return", "if", "else", "for", "do",
    "while", "print", "TRUE", "FALSE", "NULL_KEY", "PI", "TWO_PI", "PI_BY_TWO",
    "DEG_TO_RAD", "RAD_TO_DEG", "SQRT2", "ZERO_VECTOR", "ZERO_ROTATION",
    "EOF", "JSON_INVALID",
}

DECL_RE = re.compile(r'\b(' + "|".join(TYPES) + r')\s+([A-Za-z_]\w*)')
KEYWORDS_NOT_FUNCS = {"if", "for", "while", "else", "state", "return", "default", "do"}

ok = True


def fail(msg):
    global ok
    ok = False
    print("    " + msg)


def check(path):
    src = io.open(path, encoding="utf-8").read()
    nos = STR_RE.sub('""', src)
    nos = COMMENT_RE.sub("", nos)

    print("=== %s ===" % os.path.relpath(path))

    # --- balance ----------------------------------------------------------
    for pair in ["{}", "()", "[]"]:
        a, b = nos.count(pair[0]), nos.count(pair[1])
        if a != b:
            fail("UNBALANCED %s : %d open / %d close" % (pair, a, b))
        else:
            print("  %s balanced (%d)" % (pair, a))

    # --- reserved words used as identifiers -------------------------------
    bad = []
    for m in DECL_RE.finditer(nos):
        name = m.group(2)
        if name in RESERVED:
            line = nos[: m.start()].count("\n") + 1
            bad.append("line %d: '%s %s' - '%s' is a reserved LSL word"
                       % (line, m.group(1), name, name))
    if bad:
        for b in bad:
            fail("RESERVED NAME: " + b)
    else:
        print("  no reserved words used as identifiers")

    # --- LSL is single pass: define before use ----------------------------
    defs = {}
    for m in FDEF_RE.finditer(nos):
        name = m.group(1)
        if name in KEYWORDS_NOT_FUNCS:
            continue
        defs.setdefault(name, m.start())

    problems = []
    for name, pos in sorted(defs.items()):
        for m in re.finditer(r"\b" + re.escape(name) + r"\s*\(", nos):
            if m.start() < pos:
                problems.append("%s called before it is defined" % name)
                break
    if problems:
        for p in problems:
            fail("DEFINE-BEFORE-USE: " + p)
    else:
        print("  %d user functions, all defined before use" % len(defs))

    # --- globals referenced but never declared ----------------------------
    used = set(re.findall(r"\bg[A-Z]\w*", nos))
    declared = {m.group(2) for m in DECL_RE.finditer(nos)}
    missing = sorted(u for u in used if u not in declared)
    if missing:
        for m in missing:
            fail("UNDECLARED GLOBAL: %s" % m)
    else:
        print("  %d globals, all declared" % len(used))

    # --- one default state ------------------------------------------------
    n = len(re.findall(r"^default\s*$", nos, re.M))
    if n != 1:
        fail("expected exactly one 'default' state, found %d" % n)

    print()


targets = sys.argv[1:] or sorted(glob.glob(os.path.join("lsl", "*.lsl")))
for t in targets:
    check(t)

print("RESULT:", "all checks passed" if ok else "PROBLEMS FOUND")
sys.exit(0 if ok else 1)
