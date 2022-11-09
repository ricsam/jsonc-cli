# jsonc-cli

Read and modify JSONC documents (JSON with comments). A CLI front-end for the [jsonc-parser](https://www.npmjs.com/package/jsonc-parser) npm package.

## Installation
```bash
npm install -g jsonc-cli
```

## Usage
```txt
jsonc <cmd> [args]

Commands:
  jsonc modify           Modify a JSONC document from stdin. Formatting options
                         are only applied to the injected JSON
  jsonc format           Format a JSONC document from stdin
  jsonc read [JSONPath]  Prints the JSON value at the given path in a JSONC
                         document from stdin

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
```

## Examples
### Print a value
```bash
echo '{"animal":"dog"}' | jsonc read '["animal"]' -r
```
will print `dog`

To print without newline add `-n`

### Format document
```bash
echo '{"animal":"dog" // with some comments\n}' | jsonc format
```
will print
```jsonc
{
  "animal": "dog" // with some comments
}
```
### Modify document
```bash
echo '{"animal":"dog"}' | jsonc modify -p '["animal"]' -v '"cat"'
```
will print
```json
{"animal":"cat"}
```

### Write to file
```bash
echo '{"animal":"dog"}' | jsonc read '["animal"]' -r -f output.txt
cat output.txt # dog
```
### Modify a file
It is important to add the `-n` when you modify to prevent additional trailing new lines to be added
```bash
cat .vscode/settings.json | jsonc modify -n -p '["typescript.tsdk"]' -v '"app/node_modules/typescript/lib"' -f .vscode/settings.json
```
