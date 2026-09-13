from pathlib import Path

path = Path('scripts/apply-final-hardening.py')
text = path.read_text(encoding='utf-8')
old = "    ].join('\\n');"
new = "    ].join(String.fromCharCode(10));"
count = text.count(old)
if count != 1:
    raise RuntimeError(f'expected one join newline occurrence, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Fixed generated TypeScript newline join escaping')
