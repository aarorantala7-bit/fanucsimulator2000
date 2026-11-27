# Vendored third-party files

Used only by **File ▸ Import from photo…**. They are loaded lazily, the first time OCR runs, and never on normal page load. The app has no CDN dependencies, so these files are vendored rather than fetched from a CDN.

| Path | Package | License |
|---|---|---|
| `tesseract/tesseract.min.js`, `tesseract/worker.min.js` | [tesseract.js](https://github.com/naptha/tesseract.js) 7.0.0 (`dist/`) | Apache-2.0 (`tesseract/LICENSE-tesseract.js.md`) |
| `tesseract/tesseract-core-simd-lstm.wasm.js`, `tesseract/tesseract-core-lstm.wasm.js` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) 7.0.0 (WASM inlined). The SIMD build is used, with the non-SIMD build as a fallback; `src/ui/import-dialog.js` picks one by feature detection. The relaxed-SIMD build is not vendored. | Apache-2.0 (`tesseract/LICENSE-tesseract.js-core`) |
| `tessdata/eng.traineddata.gz` | English LSTM model `4.0.0_best_int` from [@tesseract.js-data/eng](https://www.npmjs.com/package/@tesseract.js-data/eng) 1.0.0, which repackages [tesseract-ocr/tessdata](https://github.com/tesseract-ocr/tessdata) | Apache-2.0 (tessdata), MIT (npm packaging) |

To update: `npm pack tesseract.js tesseract.js-core @tesseract.js-data/eng`, then copy the same files.
