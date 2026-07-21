# Vocal Spectrometer

A browser-based, real-time vocal spectrogram and pitch detector.

- Visualizes microphone input using a scrolling STFT spectrogram
  - Time runs horizontally and frequency vertically
  - Color shows the intensity of each frequency
- Detects and draws pitch in real time
- Labels the nearest musical note and cents offset
- Provides manual navigation and automatic pitch following

[Open the app](https://xloc.github.io/vocal-spectrometer/)

## Development

```sh
# install node and pnpm
pnpm install
pnpm dev
```

Run `pnpm build` for a production build. Pushes to `main` are automatically deployed to GitHub Pages.
