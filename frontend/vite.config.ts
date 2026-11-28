import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: true } },
  },
  // O app e as bibliotecas 3D da raiz precisam compartilhar a mesma instância de React.
  resolve: { dedupe: ["react", "react-dom", "three", "@react-three/fiber"] },
});
