import createOpenCv from 'beanmap-opencv-factory';

// Official modularized OpenCV factory. Only its documented Emscripten locateFile
// hook is configured; no source patch, global eval override, or CSP bypass.
// import.meta.url becomes the same-origin deployed worker's URL after bundling.
const cv = createOpenCv({
  locateFile(filename) {
    if (filename !== 'opencv_js.wasm') throw new Error(`Unexpected OpenCV asset: ${filename}`);
    return new URL(`opencv/${filename}`, import.meta.url).href;
  },
});
export default cv;
