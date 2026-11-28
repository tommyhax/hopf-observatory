"""Verify and summarize the browser precision experiment's recorded evidence."""
from collections import Counter
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'research'))
from analyze import match


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(name):
    return json.loads((HERE / name).read_text())


def verify(report):
    for field in ['hashes', 'sourceHashes']:
        for p, expected in report.get(field, {}).items():
            assert digest(ROOT / p) == expected, p


def summarize(rows, method, tolerance):
    results = [match(row['expected'], row[method], tolerance) for row in rows]
    errors = [x for r in results for x in r['errors']]
    return {
        'queries': len(rows),
        'failedQueries': sum(r['failed'] for r in results),
        'failedIds': [row['id'] for row, r in zip(rows, results) if r['failed']],
        'expectedRoots': sum(r['expected'] for r in results),
        'matchedRoots': sum(r['found'] for r in results),
        'missingRoots': sum(r['missed'] for r in results),
        'unmatchedOutputs': sum(r['false'] for r in results),
        'nonfiniteOutputs': sum(r['nonfiniteOutputs'] for r in results),
        'maxMatchedRelativeError': max(errors, default=None),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--roots-only', action='store_true')
    args = parser.parse_args()
    roots = load('results/roots-all.json')
    verify(roots)
    assert len(roots['primitives']) == 8 and all(p['pass'] for p in roots['primitives'])
    root_summary, all_rows = {}, {}
    for corpus, captured in roots['results'].items():
        name = 'stress-reference.json' if corpus == 'stress' else 'reference.json'
        cases = json.loads((ROOT / 'research/results' / name).read_text())['cases']
        references = {c['id']: c for c in cases}
        assert len(captured) == len(references) == (2400 if corpus == 'stress' else 867)
        assert len({r['id'] for r in captured}) == len(references)
        assert {r['id'] for r in captured} == set(references)
        rows = [{**r, 'family': references[r['id']]['family'],
                 'expected': [float(v['s']) for v in references[r['id']]['reference']['roots']]}
                for r in captured]
        groups = {'all': rows}
        groups.update({family: [r for r in rows if r['family'] == family]
                       for family in sorted({r['family'] for r in rows})})
        root_summary[corpus] = {
            group: {str(t): {method: summarize(selected, method, t)
                            for method in ['production', 'pairedRaw', 'paired']}
                    for t in [1e-4, 1e-6, 1e-7]}
            for group, selected in groups.items()
        }
        all_rows[corpus] = rows
        assert root_summary[corpus]['all']['0.0001']['paired']['failedQueries'] == 0
    assert root_summary['original']['all']['0.0001']['paired']['expectedRoots'] == 1470
    assert root_summary['stress']['all']['0.0001']['paired']['expectedRoots'] == 3314
    data = {'rootSummary': root_summary, 'hardware': roots['hardware']}
    sources = [HERE / 'results/roots-all.json', Path(__file__).resolve(), ROOT / 'research/analyze.py']
    if not args.roots_only:
        benchmark = load('results/benchmark.json')
        renders = load('results/renders.json')
        verify(benchmark)
        assert roots['rendererHashes'] == benchmark['shaderHashes'] == renders['shaderHashes']
        assert roots['hardware'] == benchmark['hardware'] == renders['hardware']
        transport = {}
        for name in ['production', 'paired']:
            report = load(f'results/transport-{name}.json')
            verify(report)
            assert report['passed']
            assert report['shaderHashes']['fragment'] == benchmark['shaderHashes'][name]
            assert report['hardware'] == benchmark['hardware']
            transport[name] = {k: {'passed': v['passed'], 'total': v['total']}
                               for k, v in report['results'].items()}
            sources.append(HERE / f'results/transport-{name}.json')
        contact = load('results/close-contact.json')
        verify(contact)
        assert contact['passed']
        timings = []
        scenes = list(dict.fromkeys(r['scene'] for r in benchmark['measurements']))
        accepted = json.loads((ROOT / 'research/diagnostics/algorithm1010/final/results/webgl-benchmark.json').read_text())
        assert len(scenes) == 4 and len(benchmark['measurements']) == 24
        for index, scene in enumerate(scenes):
            row = {'scene': scene}
            uniforms = next(r['uniforms'] for r in accepted['measurements'] if r['scene'] == scene)
            for name in ['production', 'paired']:
                blocks = [r for r in benchmark['measurements'] if r['scene'] == scene and r['variant'] == name]
                assert [b['round'] for b in blocks] == [0, 1, 2]
                for b in blocks:
                    assert b['uniforms'] == uniforms
                    assert b['width'] == 1280 and b['height'] == 720
                    assert b['frames'] == 10 and b['warmup'] == 5 and not b['disjoint']
                    assert len(b['gpuMilliseconds']) == len(b['completionMilliseconds']) == 10
                    expected_order = ['paired', 'production'] if (b['round'] + index) % 2 else ['production', 'paired']
                    assert b['order'] == expected_order
                values = np.array([v for b in blocks for v in b['gpuMilliseconds']])
                assert np.isfinite(values).all() and (values > 0).all()
                row[name] = {
                    'gpuMedianMs': float(np.median(values)),
                    'gpuQuartilesMs': [float(v) for v in np.percentile(values, [25, 75])],
                    'gpuBlockMediansMs': [float(np.median(b['gpuMilliseconds'])) for b in blocks],
                    'completionMedianMs': float(np.median([v for b in blocks for v in b['completionMilliseconds']])),
                }
            row['gpuTimeRatio'] = row['paired']['gpuMedianMs'] / row['production']['gpuMedianMs']
            row['extraGpuPercent'] = 100 * (row['gpuTimeRatio'] - 1)
            row['blockTimeRatios'] = [b/a for a,b in zip(row['production']['gpuBlockMediansMs'], row['paired']['gpuBlockMediansMs'])]
            timings.append(row)
        images, comparisons = {}, []
        for item in renders['renders']:
            p = ROOT / item['path']
            assert digest(p) == item['sha256']
            raw = gzip.decompress(p.read_bytes())
            assert len(raw) == item['width'] * item['height'] * 4
            image = np.frombuffer(raw, dtype=np.uint8).reshape(item['height'], item['width'], 4)[::-1]
            images[item['scene'], item['mode'], item['variant']] = image
            sources.append(p)
        assert len(images) == 24
        sheet = Image.new('RGB', (1440, 4 * 300), '#111921')
        draw = ImageDraw.Draw(sheet)
        for index, scene in enumerate(scenes):
            for mode in [0, 1, 2]:
                a, b = [images[scene, mode, name] for name in ['production', 'paired']]
                delta = np.abs(a[:, :, :3].astype(int) - b[:, :, :3].astype(int))
                comparisons.append({'scene': scene, 'mode': mode,
                    'maxChannelCodes': int(delta.max()), 'meanChannelCodes': float(delta.mean()),
                    'differentPixels': int(np.any(delta > 0, axis=2).sum()),
                    'pixelsOver3Codes': int(np.any(delta > 3, axis=2).sum())})
                if mode == 0:
                    for col, img in enumerate([a[:, :, :3], b[:, :, :3], np.minimum(delta*8, 255).astype(np.uint8)]):
                        sheet.paste(Image.fromarray(img), (col*480, index*300+30))
                    for col, label in enumerate(['Production', 'Paired precision', 'Absolute difference x8']):
                        draw.text((col*480+8, index*300+8), f'{scene}: {label}', fill='white')
        (HERE / 'figures').mkdir(exist_ok=True)
        sheet.save(HERE / 'figures/comparison.png')
        data.update(transport=transport, timings=timings, imageComparisons=comparisons,
                    closeContact={'passed': True, 'pairSeparation': contact['pairSeparation'],
                                  'float32SpacingAtContact': contact['float32SpacingAtContact']})
        sources += [HERE / f'results/{n}.json' for n in ['benchmark', 'renders', 'close-contact']]
    data['hashes'] = {p.relative_to(ROOT).as_posix(): digest(p) for p in sources}
    (HERE / ('results/root-analysis.json' if args.roots_only else 'results/analysis.json')).write_text(json.dumps(data, indent=2, allow_nan=False)+'\n')
    for corpus in root_summary:
        print(corpus, json.dumps(root_summary[corpus]['all']['0.0001']))
    if not args.roots_only:
        print(json.dumps({'timings': data['timings'], 'transport': data['transport']}, indent=2))


if __name__ == '__main__':
    main()
