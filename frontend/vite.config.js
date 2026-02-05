import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    define: {
        "process.env.NODE_ENV": JSON.stringify("production")
    },
    build: {
        lib: {
            entry: "./excalidraw-app.jsx",
            name: "ExcalidrawApp",
            fileName: () => "excalidraw.bundle.js",
            formats: ["umd"]
        },
        outDir: "../static/js",
        emptyOutDir: false
    }
});