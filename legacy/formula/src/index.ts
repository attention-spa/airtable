/// <reference lib="WebWorker"/>
/// <reference lib="ESNext"/>

/**
 * Optional injection point:
 *
 * globalThis.FormulatorLib = alreadyImportedFormulator;
 *
 * If no compatible library is present, this module imports airtable-formulator
 * from esm.sh.
 */
const Formulator =
	globalThis.FormulatorLib ??
	globalThis.Formulator ??
	(await import(
		`https://esm.sh/gh/Qualifyze/airtable-formulator/src/index.ts?dev`
	));

/**
 * Converts an object-literal formula schema into airtable-formulator's native
 * array/object formula syntax.
 *
 * Supported schema forms:
 *
 * Field:
 *   { field: "Name" }
 *
 * Function:
 *   { fn: "LEN", args: [{ field: "Name" }] }
 *
 * Operator:
 *   { op: "=", args: [{ field: "Name" }, "Robert"] }
 *
 * Shorthand:
 *   { LEN: { field: "Name" } }
 *   { AND: [{ op: "=", args: [...] }, ...] }
 *
 * Definitions:
 *   {
 *     definitions: {
 *       nameLen: { fn: "LEN", args: [{ field: "name" }] }
 *     },
 *     formula: { ref: "nameLen" }
 *   }
 */
function toFormulatorFormula(input, scope = {}) {
	if (
		input == null ||
		typeof input === "string" ||
		typeof input === "number" ||
		typeof input === "boolean"
	) {
		return input;
	}

	if (Array.isArray(input)) {
		return input.map((part) => toFormulatorFormula(part, scope));
	}

	if (typeof input !== "object") {
		throw new TypeError(`Unsupported formula node: ${String(input)}`);
	}

	if ("definitions" in input || "formula" in input) {
		const definitions = input.definitions ?? {};
		const nextScope = { ...scope };

		for (const [name, value] of Object.entries(definitions)) {
			nextScope[name] = value;
		}

		if (!("formula" in input)) {
			throw new Error(`Object with definitions must also include formula`);
		}

		return toFormulatorFormula(input.formula, nextScope);
	}

	if ("ref" in input) {
		if (!(input.ref in scope)) {
			throw new Error(`Unknown formula definition: ${input.ref}`);
		}

		return toFormulatorFormula(scope[input.ref], scope);
	}

	if ("field" in input) {
		const keys = Object.keys(input);

		if (keys.length !== 1) {
			throw new Error(
				`{ field: ... } cannot contain extra keys: ${keys.join(", ")}`,
			);
		}

		return { field: input.field };
	}

	if ("fn" in input) {
		const args = Array.isArray(input.args) ? input.args : [input.args];

		return [input.fn, ...args.map((arg) => toFormulatorFormula(arg, scope))];
	}

	if ("op" in input) {
		const args = Array.isArray(input.args) ? input.args : [input.args];

		return [input.op, ...args.map((arg) => toFormulatorFormula(arg, scope))];
	}

	const entries = Object.entries(input);

	if (entries.length === 1) {
		const [name, value] = entries[0];
		const args = Array.isArray(value) ? value : [value];

		return [name, ...args.map((arg) => toFormulatorFormula(arg, scope))];
	}

	throw new Error(
		`Ambiguous formula object. Use { fn, args }, { op, args }, or a single shorthand key.`,
	);
}

/**
 * Compiles an object-literal formula schema to an Airtable formula string.
 *
 * @param {unknown} input
 * @param {{ compile: Function }} [formulatorLib]
 * @returns {string}
 */
function compileObjectFormula(input, formulatorLib = Formulator) {
	if (!formulatorLib?.compile) {
		throw new TypeError(
			`compileSchema expected a Formulator-compatible library with a compile() method.`,
		);
	}

	return formulatorLib.compile(toFormulatorFormula(input));
}

export { Formulator, toFormulatorFormula, compileObjectFormula };

export default {
	Formulator,
	compileSchema: compileObjectFormula,
};
