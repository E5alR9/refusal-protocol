"""用本機 ComfyUI 的 BiRefNet 替 images/sprites_raw 的立繪產生去背遮罩，存到 images/sprites_mask。

前提：ComfyUI 已在 127.0.0.1:8610 執行（C:\\ComfyUI\\run_api_8610.bat），
且 models/background_removal/birefnet.safetensors 已就位。
用法：python tools/make_masks.py [--force]
"""
import json
import os
import shutil
import sys
import time
import urllib.request

SERVER = 'http://127.0.0.1:8610'
COMFY_INPUT = r'C:\ComfyUI\ComfyUI\input'
COMFY_OUTPUT = r'C:\ComfyUI\ComfyUI\output'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'images', 'sprites_raw')
MASKS = os.path.join(ROOT, 'images', 'sprites_mask')


def run(graph):
    req = urllib.request.Request(SERVER + '/prompt', data=json.dumps({'prompt': graph}).encode(),
                                 headers={'Content-Type': 'application/json'})
    pid = json.loads(urllib.request.urlopen(req).read())['prompt_id']
    t0 = time.time()
    while time.time() - t0 < 300:
        time.sleep(1)
        hist = json.loads(urllib.request.urlopen(f'{SERVER}/history/{pid}').read())
        if pid not in hist:
            continue
        status = hist[pid].get('status', {})
        if status.get('status_str') == 'error':
            raise RuntimeError(json.dumps(status.get('messages', [])[-1:], ensure_ascii=False)[:800])
        for out in hist[pid].get('outputs', {}).values():
            if 'images' in out:
                return out['images'][0]['filename']
    raise TimeoutError(pid)


def main():
    force = '--force' in sys.argv
    os.makedirs(MASKS, exist_ok=True)
    names = sorted(f[:-4] for f in os.listdir(RAW) if f.endswith('.png') and not f.startswith('_'))
    for name in names:
        dst = os.path.join(MASKS, name + '.png')
        if os.path.exists(dst) and not force:
            print(name, '已有遮罩，略過')
            continue
        shutil.copy(os.path.join(RAW, name + '.png'), os.path.join(COMFY_INPUT, 'rp_sp_' + name + '.png'))
        graph = {
            'model': {'class_type': 'LoadBackgroundRemovalModel', 'inputs': {'bg_removal_name': 'birefnet.safetensors'}},
            'img': {'class_type': 'LoadImage', 'inputs': {'image': 'rp_sp_' + name + '.png'}},
            'rm': {'class_type': 'RemoveBackground', 'inputs': {'bg_removal_model': ['model', 0], 'image': ['img', 0]}},
            'toimg': {'class_type': 'MaskToImage', 'inputs': {'mask': ['rm', 0]}},
            'save': {'class_type': 'SaveImage', 'inputs': {'filename_prefix': 'rp_mask_' + name, 'images': ['toimg', 0]}},
        }
        fn = run(graph)
        shutil.copy(os.path.join(COMFY_OUTPUT, fn), dst)
        print(name, '→', dst)


if __name__ == '__main__':
    main()
