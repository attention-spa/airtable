const args = process.argv.slice(2);
const positional = args.filter(arg => !arg.startsWith('-'));
const entry = positional[0] ?? 'utils/index.ts';

const formatIndex = args.indexOf('--format');
const format = formatIndex >= 0
    ? args[formatIndex + 1]
    : 'esm';

export default {
    entry: {
        bundle: entry,
    },
    outDir: 'dist',
    format: [format],
    bundle: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    dts: false,
    platform: 'neutral',
    target: 'esnext',
    outExtension({ format: outputFormat }) {
        return {
            js: outputFormat === 'esm' ? '.mjs' : '.js',
        };
    },
};
