import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path, { resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname);
    const apiUrl = env.VITE_API_URL;

    return {
        root: "client",
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                "@": resolve(__dirname, "client/src"),
            },
        },
        server: {
            proxy: {
                "/api": {
                    target: apiUrl,
                    changeOrigin: true,
                },
            },
        },
        build: {
            outDir: "../dist/client",
        },
    };
});
