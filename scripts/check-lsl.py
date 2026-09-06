import re, io, sys

STR_RE = re.compile(r'"(?:\\.|[^"\\])*"')
COMMENT_RE = re.compile(r'//[^\n]*')
FDEF_RE = re.compile(r'^(?:[A-Za-z_]\w*\s+)?([a-zA-Z_]\w*)\s*\([^;{)]*\)\s*$', re.M)
KEYWORDS = {'if', 'for', 'while', 'else', 'state', 'return', 'default', 'do'}
GLOBALS_TO_CHECK = ['gMoapRetry', 'gCurrentAnim', 'gDialogKeys', 'gDialogLabels', 'gDialogId']

ok = True


def check(path):
    global ok
    src = io.open(path, encoding='utf-8').read()
    # Strings FIRST. Stripping comments first eats "https://..." at the slashes,
    # leaving an unterminated quote that desyncs every count after it.
    nos = STR_RE.sub('""', src)
    nos = COMMENT_RE.sub('', nos)

    print("=== %s ===" % path)

    for pair in ['{}', '()', '[]']:
        a, b = nos.count(pair[0]), nos.count(pair[1])
        status = "OK" if a == b else "MISMATCH"
        if a != b:
            ok = False
        print("  %s  %4d open / %4d close   %s" % (pair, a, b, status))

    defs = {}
    for m in FDEF_RE.finditer(nos):
        name = m.group(1)
        if name in KEYWORDS:
            continue
        defs.setdefault(name, m.start())

    # LSL is single pass: a user function must appear before it is called.
    problems = []
    for name, pos in sorted(defs.items()):
        call = re.compile(r'\b' + re.escape(name) + r'\s*\(')
        for m in call.finditer(nos):
            if m.start() < pos:
                problems.append("%s called at %d, defined at %d" % (name, m.start(), pos))
                break
    print("  user functions: %d" % len(defs))
    if problems:
        ok = False
        for p in problems:
            print("    DEFINE-BEFORE-USE: " + p)
    else:
        print("  define-before-use: OK")

    for g in GLOBALS_TO_CHECK:
        if g not in nos:
            continue
        decl = re.search(r'^\s*(?:integer|string|list|float|key|vector|rotation)\s+' + g + r'\b',
                         nos, re.M)
        if not decl:
            ok = False
        print("  %-14s declared: %s" % (g, "yes" if decl else "NO - MISSING"))

    # every state/event block should sit inside default { }
    if nos.count('default') != 1:
        print("  NOTE: 'default' appears %d times" % nos.count('default'))
    print()


for p in ['lsl/nestoria_main_hud.lsl', 'lsl/nestoria_partner_hud.lsl']:
    check(p)

print("RESULT:", "all checks passed" if ok else "PROBLEMS FOUND")
sys.exit(0 if ok else 1)
