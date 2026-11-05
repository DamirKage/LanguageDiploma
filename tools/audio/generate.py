"""
Generates the audio recordings for the curriculum with offline neural voices (Piper models
run by sherpa-onnx) and optionally checks each recording by transcribing it back with Whisper.

Usage (from the repository root):
    python -m venv .venv-audio && .venv-audio/bin/pip install -r tools/audio/requirements.txt
    npm run audio:phrases
    .venv-audio/bin/python tools/audio/generate.py            # synthesize missing recordings
    .venv-audio/bin/python tools/audio/generate.py --check    # also verify with Whisper

Recordings go to client/public/audio/<language>/<hash>.mp3 with a manifest.json that maps the
phrase (see shared/src/audio.ts) to the file. Existing files are kept, so reruns are cheap.
"""
import argparse
import hashlib
import json
import os
import sys
import tarfile
import unicodedata
import urllib.request
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import lameenc
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'tools' / 'audio' / '.work'
MODELS = WORK / 'models'
OUT = ROOT / 'client' / 'public' / 'audio'
RELEASE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download'

# Voice A narrates; voice B is the other speaker in dialogues. (model, speaker id)
# All voices are under free licenses (public domain, CC0, CC BY); see docs/audio.md.
VOICES = {
    'kk': {'A': ('kk_KZ-issai-high', 2), 'B': ('kk_KZ-issai-high', 0)},
    'en': {'A': ('en_US-ljspeech-high', 0), 'B': ('en_US-libritts_r-medium', 736)},
    'tr': {'A': ('tr_TR-fettah-medium', 0), 'B': ('tr_TR-fahrettin-medium', 0)},
    'de': {'A': ('de_DE-thorsten-high', 0), 'B': ('de_DE-kerstin-low', 0)},
    'es': {'A': ('es_ES-sharvard-medium', 1), 'B': ('es_ES-sharvard-medium', 0)},
}
WHISPER = 'sherpa-onnx-whisper-turbo'
BITRATE_KBPS = 32


def download(name: str, kind: str) -> Path:
    target = MODELS / (name if kind == 'asr-models' else f'vits-piper-{name}')
    if target.exists():
        return target
    MODELS.mkdir(parents=True, exist_ok=True)
    archive = MODELS / f'{target.name}.tar.bz2'
    print(f'Downloading {target.name}…', flush=True)
    urllib.request.urlretrieve(f'{RELEASE}/{kind}/{target.name}.tar.bz2', archive)
    with tarfile.open(archive) as tar:
        tar.extractall(MODELS, filter='data')
    archive.unlink()
    return target


def file_name(model: str, sid: int, text: str) -> str:
    return hashlib.sha1(f'{model}|{sid}|{text}'.encode()).hexdigest()[:16] + '.mp3'


def manifest_key(text: str, voice: str) -> str:
    return f'B|{text}' if voice == 'B' else text


def encode_mp3(samples: np.ndarray, rate: int) -> bytes:
    lead, tail = np.zeros(int(rate * 0.12), np.float32), np.zeros(int(rate * 0.25), np.float32)
    audio = np.concatenate([lead, samples.astype(np.float32), tail])
    peak = float(np.max(np.abs(audio))) or 1.0
    pcm = (audio / peak * 0.89 * 32767).astype(np.int16)
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE_KBPS)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm.tobytes()) + enc.flush()


def synthesize(job):
    import sherpa_onnx

    language, voice, items = job
    model, sid = VOICES[language][voice]
    d = MODELS / f'vits-piper-{model}'
    tts = sherpa_onnx.OfflineTts(
        sherpa_onnx.OfflineTtsConfig(
            model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=str(d / f'{model}.onnx'), tokens=str(d / 'tokens.txt'), data_dir=str(d / 'espeak-ng-data')),
                num_threads=2,
            )
        )
    )
    made = 0
    for text in items:
        path = OUT / language / file_name(model, sid, text)
        if path.exists():
            continue
        result = tts.generate(text, sid=sid, speed=1.0)
        path.write_bytes(encode_mp3(np.array(result.samples), result.sample_rate))
        made += 1
    return language, voice, made


def levenshtein(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def comparable(text: str) -> str:
    text = unicodedata.normalize('NFKC', text).lower()
    return ' '.join(''.join(ch if ch.isalnum() else ' ' for ch in text).split())


def collapse_repeats(text: str) -> str:
    """Whisper sometimes loops on very short clips ("city city city"); keep one copy of a repeated tail."""
    words = text.split()
    for size in range(1, len(words) // 2 + 1):
        unit = words[:size]
        if all(words[i] == unit[i % size] for i in range(len(words))):
            return ' '.join(unit)
    return text


def check(phrases, every: int = 1):
    """Transcribes recordings with Whisper (every n-th one) and reports the character error rate per language."""
    import sherpa_onnx
    import subprocess

    d = download(WHISPER, 'asr-models')
    report = {}
    for language, items in phrases.items():
        rec = sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=str(d / 'turbo-encoder.int8.onnx'),
            decoder=str(d / 'turbo-decoder.int8.onnx'),
            tokens=str(d / 'turbo-tokens.txt'),
            language=language,
            num_threads=os.cpu_count() or 4,
        )
        rows = []
        manifest = json.loads((OUT / language / 'manifest.json').read_text())
        for item in [i for i in items if i['voice'] == 'A'][::every]:
            f = OUT / language / manifest[manifest_key(item['text'], 'A')]
            pcm = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', str(f), '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
            audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
            audio = np.concatenate([np.zeros(9600, np.float32), audio, np.zeros(9600, np.float32)])
            stream = rec.create_stream()
            stream.accept_waveform(16000, audio)
            rec.decode_stream(stream)
            heard = stream.result.text.strip()
            ref, hyp = comparable(item['text']), collapse_repeats(comparable(heard))
            cer = levenshtein(ref, hyp) / max(1, len(ref))
            rows.append({'text': item['text'], 'heard': heard, 'cer': round(cer, 3), 'phrase': len(ref.split()) >= 3})

        def stats(sample):
            cers = sorted(r['cer'] for r in sample)
            if not cers:
                return None
            return {'n': len(cers), 'medianCer': cers[len(cers) // 2], 'within10pct': round(sum(c <= 0.1 for c in cers) / len(cers), 3)}

        report[language] = {
            'all': stats(rows),
            'phrases': stats([r for r in rows if r['phrase']]),
            'words': stats([r for r in rows if not r['phrase']]),
            'rows': sorted(rows, key=lambda r: -r['cer']),
        }
        print(language, {k: v for k, v in report[language].items() if k != 'rows'}, flush=True)
    (WORK / 'quality-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--phrases', default=str(WORK / 'phrases.json'))
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--every', type=int, default=1, help='check every n-th recording')
    args = parser.parse_args()
    phrases = json.loads(Path(args.phrases).read_text())

    for language, voices in VOICES.items():
        for model, _ in voices.values():
            download(model, 'tts-models')
        (OUT / language).mkdir(parents=True, exist_ok=True)

    jobs = []
    for language, items in phrases.items():
        for voice in ('A', 'B'):
            texts = [i['text'] for i in items if i['voice'] == voice]
            jobs += [(language, voice, texts[k::2]) for k in range(2)]
    with ProcessPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
        for language, voice, made in pool.map(synthesize, jobs):
            print(f'{language} {voice}: {made} new', flush=True)

    total = 0
    for language, items in phrases.items():
        manifest, keep = {}, set()
        for item in items:
            model, sid = VOICES[language][item['voice']]
            name = file_name(model, sid, item['text'])
            manifest[manifest_key(item['text'], item['voice'])] = name
            keep.add(name)
        for f in (OUT / language).glob('*.mp3'):
            if f.name not in keep:
                f.unlink()
        (OUT / language / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
        size = sum(f.stat().st_size for f in (OUT / language).glob('*.mp3'))
        total += size
        print(f'{language}: {len(manifest)} recordings, {size / 1e6:.1f} MB')
    print(f'Total {total / 1e6:.1f} MB')
    if args.check:
        check(phrases, args.every)


if __name__ == '__main__':
    sys.exit(main())
