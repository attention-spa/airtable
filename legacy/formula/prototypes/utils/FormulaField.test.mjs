import { FormulaField } from "./FormulaField.mjs";

const ff = new FormulaField("test-token", {
    fetchLib: async () => ({
        ok: true,
        text: async () => "{}",
    }),
});

console.info(ff);
