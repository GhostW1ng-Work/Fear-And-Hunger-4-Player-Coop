"""Runs the co-op scenario tests (tests.js). Usage: python tests/run.py
Needs: pip install mini-racer, and the game installed (see TERMINA_GAME in load.py).
Exit code 1 if any scenario fails."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from load import load_ctx, read, GAME  # noqa: E402

ctx = load_ctx()
ctx.eval('var __map = ' + read(GAME + '/data/Map019.json') + ';')
ctx.eval('Graphics._width = 816; Graphics._height = 624; Graphics._boxWidth = 816; Graphics._boxHeight = 624;')
try:
    out = ctx.eval(read(os.path.join(HERE, 'tests.js')), timeout=120000)
except Exception as e:
    print('EXC', str(e)[:1500])
    out = ctx.eval('__results.join(String.fromCharCode(10))')
print(out)
results = [line for line in out.splitlines() if line.startswith(('PASS', 'FAIL'))]
failed = [line for line in results if line.startswith('FAIL')]
print('\n%d passed, %d failed' % (len(results) - len(failed), len(failed)))
sys.exit(1 if failed or not results else 0)
