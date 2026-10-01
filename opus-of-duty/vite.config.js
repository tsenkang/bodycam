import { defineConfig } from 'vite';

export default defineConfig({
  // Bind IPv4 explicitly: the default `localhost` binds ::1 only on macOS,
  // which the capture harness (127.0.0.1) cannot reach.
  // `hmr: false` when the capture harness owns the server (OW_NO_HMR=1): a file
  // saved by a concurrently-working agent otherwise reloads the page mid-capture
  // and playwright fails with "Execution context was destroyed".
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    hmr: process.env.OW_NO_HMR ? false : undefined,
  },
  preview: { host: '127.0.0.1' },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 4096,
    // The soldier model is inlined so tools/pack.mjs can ship one file that
    // opens from disk; everything else keeps the default limit.
    assetsInlineLimit: (file) => (file.endsWith('.glb') ? true : undefined),
  },
  // Large binary game assets served verbatim.
  assetsInclude: ['**/*.ktx2', '**/*.hdr', '**/*.exr', '**/*.bin', '**/*.glb'],
});
