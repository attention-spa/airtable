import { defineConfig } from "tsup";

export default defineConfig({
    entry: {
        bundle: "src/index.ts", // change this to your repo's actual entry file
    },

    outDir: "dist",
    format: ["esm"],
    bundle: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: false,

    // For Node-targeted output:
    platform: "node",
    target: "node18",

    // Force .mjs instead of .js
    outExtension ()
    {
        return {
            js: ".mjs",
        };
    },
});