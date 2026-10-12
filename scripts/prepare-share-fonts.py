#!/usr/bin/env python3
"""Derive a static image font and exact title metrics from licensed local fonts.

Run: python3 scripts/prepare-share-fonts.py
Requires fonttools. Original fonts and their OFL licenses stay in public/fonts.
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

fonts = Path(__file__).resolve().parents[1] / 'public' / 'fonts'
body = TTFont(fonts / 'DMSans-Variable.ttf')
body = instantiateVariableFont(body, {'wght': 400, 'opsz': 14}, inplace=False)
body.recalcTimestamp = False
body.save(fonts / 'DMSans-Regular.ttf')
hand = TTFont(fonts / 'PatrickHand-Regular.ttf')
for name, font in [('PatrickHand', hand), ('DMSans', body)]:
    metrics = {
        'unitsPerEm': font['head'].unitsPerEm,
        'advances': {str(code): font['hmtx'].metrics[glyph][0] for code, glyph in font.getBestCmap().items()},
    }
    (fonts / f'{name}-metrics.json').write_text(json.dumps(metrics, separators=(',', ':')))
print('Prepared static DM Sans and Patrick Hand glyph metrics.')
