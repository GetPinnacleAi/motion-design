# Pinnacle Ai Webinar Video

A 3-minute, Apple-style animated segment for the Pinnacle Ai evergreen webinar.

- `pinnacle-webinar.mp4`: the rendered video (1920x1080, 30 fps, H.264, silent).
- `index.html`: the animation source. Open it in a browser to preview. Space pauses, arrow keys skip 5 seconds, and `?t=60` starts at 1:00.
- `render.cjs`: renders `index.html` to MP4 frame by frame with Playwright and ffmpeg.
- `SCRIPT.md`: scene timecodes, draft voiceover, brand notes, and the sources for each claim.
- `assets/`: the official Pinnacle Ai logo marks and the Inter Tight and Inter fonts from getpinnacle.ai.

## Edit

Each scene is one `addScene({...})` block in `index.html`. Change `dur` to retime a scene; later scenes shift automatically. Copy lives in the scene's `html`. Animation timing lives in its `update(t)` function, where `t` is seconds into the scene.

## Render

```bash
NODE_PATH=$(npm root -g) node render.cjs --out pinnacle-webinar.mp4      # full video
NODE_PATH=$(npm root -g) node render.cjs --stills 5,40,90                # PNG stills at those seconds
```

Requires Node, the `playwright` package with Chromium, and ffmpeg. Fonts load from `assets/fonts/`.
