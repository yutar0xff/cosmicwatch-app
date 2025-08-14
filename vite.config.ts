import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 本番環境では /app/cosmicwatch-app/ を使用、開発環境ではデフォルト（/）を使用
  const base = mode === "development" ? "/" : "/app/cosmicwatch-app/";

  return {
    base: base,
    plugins: [tailwindcss(), react()],
    build: {
      target: "esnext",
    },
    define: {
      'process.env.VITE_FILE_MODE': JSON.stringify(process.env.VITE_FILE_MODE || 'web'),
    },
    publicDir: false, // Skip copying public files to avoid permissions issue
  };
});
