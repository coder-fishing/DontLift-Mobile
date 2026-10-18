'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const requireFromApp = Module.createRequire(path.resolve(__dirname, '../../../package.json'));
function loadAppTypeScript(relativePath) {
  const filename = path.resolve(__dirname, '../../..', relativePath);
  const ts = requireFromApp('typescript');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(output, filename);
  return compiled.exports;
}
module.exports = { loadAppTypeScript, requireFromApp };
