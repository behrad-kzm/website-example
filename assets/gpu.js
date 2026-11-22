// Does this device draw WebGL on a real graphics chip? Without one (software WebGL: SwiftShader, llvmpipe,
// …) every frame of a full-screen shader runs on the CPU and holds the main thread for hundreds of
// milliseconds, so the page shows stills instead of the live scenes. Asked once, with a throwaway 1x1
// context that is released straight away.
export const hasGPU = (() => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    // The browser itself refuses this context when it would be drawn in software
    const gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch (error) {
    return false;
  }
})();
