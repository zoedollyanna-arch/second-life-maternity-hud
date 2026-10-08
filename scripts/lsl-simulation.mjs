// Limited adapter for executing selected LSL functions against mocked APIs.
// Casts and vector arithmetic are not general LSL emulation.
const types = "integer|float|string|key|vector|rotation|list";
export function adaptLsl(source) {
  const literals = [];
  let code = source.replace(/"(?:\\.|[^"\\])*"/g, (value) => {
    literals.push(value);
    return `__LSL_LITERAL_${literals.length - 1}__`;
  });
  code = code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  code = code.replace(/\ndefault\s*\n\{/, "\n").replace(/\}\s*$/, "");
  code = code.replace(new RegExp(`\\b(?:${types})\\s+(\\w+)\\s*\\(`, "g"), "function $1(");
  code = code.replace(/^(\s*)(\w+)\(([^;\n{}]*)\)\s*\{/gm, "$1function $2($3) {");
  code = code.replace(
    /function (\w+)\(([^)]*)\)/g,
    (_, name, args) =>
      `function ${name}(${args.replace(new RegExp(`\\b(?:${types})\\s+`, "g"), "")})`,
  );
  code = code.replace(new RegExp(`\\b(?:${types})\\s+(\\w+)`, "g"), "let $1");
  code = code.replace(new RegExp(`\\((?:${types})\\)`, "g"), "");
  code = code.replace(
    /<\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*>/g,
    "({x:$1,y:$2,z:$3})",
  );
  // LSL appends list elements with +=; JavaScript needs push(...).
  code = code.replace(/(\w+)\s*\+=\s*(\[[^;]*\]);/g, "$1.push(...$2);");
  code = code.replace(/__LSL_LITERAL_(\d+)__/g, (_, index) => literals[Number(index)]);

  return code;
}
