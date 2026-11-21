#!/usr/bin/env python3
"""Explicit native-helper + JS harness: smoke or full. Never changes game files."""
from pathlib import Path
import argparse,subprocess,sys,shutil,time
R=Path(__file__).resolve().parents[1]
P=argparse.ArgumentParser();P.add_argument('--smoke',action='store_true');P.add_argument('--full',action='store_true');opts=P.parse_args()
if opts.smoke==opts.full:P.error('Choose exactly one of --smoke or --full')
if not shutil.which('node'):
 raise SystemExit('Node.js is required; install from https://nodejs.org/')
smoke=[
 ('tests/test_player.js',),
 ('tests/test_randomize.js',),
 ('tests/test_native_alien_body_tail_v90.js',),
 ('tests/test_native_alien_body_mask_v98.js',),
 ('tests/test_native_armed_body_v99.js',),
 ('tests/test_native_keyed_underlay_v106.js',),
 ('tests/test_native_pipeline_order.js',),
 ('tests/test_native_cape_back.js',),
 ('tests/test_native_hand_fallback.js',),
 ('tests/test_native_small_backpack.js',),
 ('prototype/test_native_v89_uploads.js',),
 ('prototype/test_native_v89_items.js',),
]
full=smoke+[
 ('prototype/test_native_v87_inherited.js',),
 ('prototype/test_native_v87_swatches.js',),
 ('prototype/test_native_v89_layers.js',),
 ('prototype/test_native_v89_swatches.js',),
 ('prototype/test_native_v89_inherited_from_85.js',),
 ('prototype/test_native_v89_inherited_from_86.js',),
 ('prototype/test_native_v89_inherited_from_87.js',),
 ('tests/test_v88_layer_snapshot.js',),
 ('tests/test_v88_arm_source_evidence.js',),
]
for i,entry in enumerate(full if opts.full else smoke,1):
 cmd=['node',*entry]
 print(f'\nRUN {i}: {" ".join(cmd)}',flush=True)
 t=time.monotonic()
 p=subprocess.run(cmd,cwd=R)
 if p.returncode:
  raise SystemExit(f'FAIL {entry[0]} exit {p.returncode}')
 print('PASS',entry[0],f'{time.monotonic()-t:.2f}s',flush=True)
print('\nPASS all requested', 'full' if opts.full else 'smoke','tests (not a live Unity test)')
