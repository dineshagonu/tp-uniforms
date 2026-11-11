export default function manifest() {
  return {
    name: 'T&P Uniforms',
    short_name: 'T&P Uniforms',
    description: 'School, college, industrial & hospital uniforms from T&P',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#15284a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
