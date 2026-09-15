import { build } from "tsup";

const [entry = "utils/index.ts", format = "esm", name = "bundle"] = process.argv.slice(2);

await build({
    entry: {
        [name]: entry,
    },
    outDir: "dist",
    format: [format],
    bundle: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: false,
    platform: "neutral",
    target: "esnext",
    globalName: format === "iife" ? name : undefined,
    outExtension({ format: outputFormat }) {
        return {
            js: outputFormat === "esm" ? ".mjs" : ".js",
        };
    },
});
