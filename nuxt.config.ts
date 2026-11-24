import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      script: [
        {
          // 在畫面渲染前套用深淺模式，避免重新整理時閃一下白
          // 與 app/composables/useTheme.ts 使用同一個 localStorage key
          innerHTML: `(function(){try{var s=localStorage.getItem('pos-theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light'}catch(_){}})()`,
          tagPosition: 'head',
        },
      ],
    },
  },
  css: ['~/assets/css/input.css'], // you'll have to create this file
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
});
