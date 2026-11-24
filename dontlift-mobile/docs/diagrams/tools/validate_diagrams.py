"""Validate the authored diagram package without changing application dependencies."""
from pathlib import Path
import collections
import json
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
catalog = json.loads((ROOT / 'catalog.json').read_text(encoding='utf-8'))
errors = []
seen = set()
counts = collections.Counter()

for item in catalog:
    path = ROOT / item['path']
    if path in seen:
        errors.append(f'Duplicate catalog path: {path}')
    seen.add(path)
    counts[item['kind']] += 1
    if not path.is_file():
        errors.append(f'Missing diagram: {path}')
        continue
    content = path.read_text(encoding='utf-8')
    if item['kind'] == 'use-case':
        puml = path.with_suffix('.puml')
        svg = path.with_suffix('.svg')
        if not puml.is_file() or not svg.is_file():
            errors.append(f'Missing Use Case artifact: {path}')
            continue
        source = puml.read_text(encoding='utf-8')
        if not source.startswith('@startuml') or not source.rstrip().endswith('@enduml'):
            errors.append(f'Invalid PlantUML envelope: {puml}')
        ids = set(re.findall(r'\bas (\w+)\s*$', source, re.M))
        for a, b in re.findall(r'^(\w+) (?:--|\.\.>) (\w+)', source, re.M):
            if a not in ids or b not in ids:
                errors.append(f'Unknown Use Case endpoint {a}/{b}: {puml}')
        try:
            xml = ET.parse(svg)
            ellipses = xml.findall('.//{http://www.w3.org/2000/svg}ellipse')
            if len(ellipses) != len(re.findall(r'^\s*usecase ', source, re.M)):
                errors.append(f'Use Case source/SVG count mismatch: {puml}')
            if path.stem == 'uc-07-toan-bo-31-use-case':
                expected = {f'UC{number:02d}' for number in range(1, 32)}
                actual = [element.attrib.get('data-uc') for element in ellipses]
                if len(actual) != 31 or set(actual) != expected:
                    errors.append('Full diagram must contain each UC01–UC31 exactly once')
                if set(re.findall(r'\bas (UC\d+)\s*$', source, re.M)) != expected:
                    errors.append('Full diagram PlantUML IDs do not match UC01–UC31')
        except ET.ParseError as exc:
            errors.append(f'Invalid SVG {svg}: {exc}')
    else:
        blocks = re.findall(r'```mermaid\n([\s\S]*?)\n```', content)
        if len(blocks) != 1:
            errors.append(f'Expected exactly one Mermaid block: {path}')
        elif not blocks[0].startswith(('flowchart ', 'sequenceDiagram', 'stateDiagram-v2', 'classDiagram', 'erDiagram')):
            errors.append(f'Unknown Mermaid diagram type: {path}')
    if re.search(r'\b(?:TODO|TBD|FIXME)\b', content):
        errors.append(f'Placeholder: {path}')

for path in ROOT.rglob('*.md'):
    content = path.read_text(encoding='utf-8')
    if content.count('```') % 2:
        errors.append(f'Unbalanced Markdown fences: {path}')
    for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', content):
        if re.match(r'^[a-z]+:', target) or target.startswith('#'):
            continue
        resolved = (path.parent / target.split('#')[0]).resolve()
        if not resolved.exists():
            errors.append(f'Broken link in {path.relative_to(ROOT)}: {target}')

if errors:
    print('\n'.join(errors))
    sys.exit(1)
print(f'PASS: {len(catalog)} diagrams; links, catalog, Markdown envelopes, PlantUML endpoints and SVG XML.')
for kind, count in sorted(counts.items()):
    print(f'  {kind}: {count}')
print('Mermaid syntax/rendering must additionally be checked with a real Mermaid renderer.')
