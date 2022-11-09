#!/usr/bin/env node
const fs = require("fs");
const jsonc = require("jsonc-parser");
const yargs = require("yargs");

/** @type function(yargs.Argv<{}>, boolean): void */
function addFormattingOptions(yargs, hasJsonOutput) {
  yargs
    .options("tab-size", {
      alias: "t",
      type: "number",
      describe:
        "If indentation is based on spaces (`--insert-spaces/-s` = true), then what is the number of spaces that make an indent?",
    })
    .options("insert-spaces", {
      alias: "s",
      type: "boolean",
      describe: `Is indentation based on spaces?`,
    })
    .options("eol", {
      type: "string",
      choices: ["lf", "crlf"],
      describe: `The default 'end of line' character`,
    });
}

/** @type function(yargs.ArgumentsCamelCase<{}>): boolean */
function hasFormattingOptions(argv) {
  return !!(argv.tabSize || argv.insertSpaces || argv.eol || argv.format);
}

/** @type function(yargs.ArgumentsCamelCase<{}>): jsonc.FormattingOptions */
function createFormattingOptions(argv) {
  let eol = "\n";
  if (argv.eol === "crlf") {
    eol = "\r\n";
  }
  return {
    tabSize: argv.tabSize || 2,
    insertSpaces: argv.insertSpaces || true,
    eol,
  };
}

/** @type function(yargs.Argv<{}>, boolean): void */
function addOptions(yargs, hasJsonOutput) {
  yargs = yargs
    .options("no-newline", {
      alias: "n",
      type: "boolean",
      describe: "Print without trailing new-line",
    })
    .options("format", {
      alias: "m",
      type: "boolean",
      describe: "Will format the output",
    })
    .options("file", {
      alias: "f",
      type: "string",
      describe: "If provided will write file to location instead of stdout",
    });

  if (hasJsonOutput) {
    yargs.options("raw", {
      alias: "r",
      type: "boolean",
      describe: "Output strings without quotes",
    });
  }
}

/** @type function(yargs.Argv<{}>): void */
function checkJSONPath(yargs) {
  yargs.check((argv) => {
    if (!argv.JSONPath) {
      return true;
    }
    let p;
    try {
      p = JSON.parse(argv.JSONPath);
    } catch (err) {
      throw new Error(
        "Invalid JSONPath, could not parse JSON: " + argv.JSONPath
      );
    }
    if (
      !Array.isArray(p) ||
      !p.every(
        (value) => typeof value === "string" || typeof value === "number"
      )
    ) {
      throw new Error("Invalid JSONPath");
    }
    return true;
  });
}

/** @type function(): Promise<string> */
function stdin() {
  return new Promise((resolve) => {
    let buffer = "";
    process.stdin.on("data", (data) => {
      buffer += String(data);
    });
    process.stdin.on("close", () => {
      resolve(buffer);
    });
    return buffer;
  });
}

/** @type function(yargs.ArgumentsCamelCase<{}>): function(...any): Promise<void> */
function createLogger(argv) {
  return (...args) => {
    return new Promise((resolve, reject) => {
      const result = args.join(" ") + (argv.noNewline ? "" : "\n");

      const cb = (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      if (argv.file && argv.file !== "-") {
        fs.writeFile(argv.file, result, cb);
      } else {
        process.stdout.write(result, cb);
      }
    });
  };
}

yargs
  .scriptName("jsonc")
  .usage("$0 <cmd> [args]")
  .command(
    "modify",
    "Modify a JSONC document from stdin. Formatting options are only applied to the injected JSON",
    (yargs) => {
      yargs
        .options("JSONPath", {
          alias: "p",
          type: "string",
          describe: `Pass like -p '[1, "someKey"]'. Corresponds to the typescript type (string | number)[]`,
          demandOption: true,
        })
        .options("delete", {
          alias: "d",
          type: "boolean",
          describe: `Delete value at path`,
        })
        .options("value", {
          alias: "v",
          type: "string",
          describe: `What to replace the found node with. To remove node pass -v "null" `,
        })
        .options("is-array-insertion", {
          alias: "i",
          type: "boolean",
          describe:
            "If JSONPath refers to an index of an array and --is-array-insertion is provided, then modify will insert a new item at that location instead of overwriting its contents.",
        })
        .check((argv) => {
          if (!argv.delete && argv.value == undefined) {
            throw new Error("You must provide either delete or value");
          }
          if (argv.delete && argv.value != undefined) {
            throw new Error(
              "You can't provide --delete/-d AND --value/-v at the same time, pick on of the options"
            );
          }
          return true;
        });
      addOptions(yargs, false);
      checkJSONPath(yargs);
      addFormattingOptions(yargs);
    },
    async function (argv) {
      /** @type jsonc.JSONPath */
      const path = !argv.JSONPath ? [] : JSON.parse(argv.JSONPath);
      const value = argv.delete ? undefined : JSON.parse(argv.value);
      const buffer = await stdin();
      const formattingOptions = hasFormattingOptions(argv)
        ? createFormattingOptions(argv)
        : undefined;
      const edits = jsonc.modify(buffer, path, value, {
        formattingOptions,
        isArrayInsertion: argv.isArrayInsertion,
      });
      let result = jsonc.applyEdits(buffer, edits);
      if (argv.format && formattingOptions) {
        const fmtResult = jsonc.format(result, undefined, formattingOptions);
        result = jsonc.applyEdits(result, fmtResult);
      }
      const logger = createLogger(argv);
      await logger(result);
    }
  )
  .command(
    "format",
    "Format a JSONC document from stdin",
    (yargs) => {
      addFormattingOptions(yargs);
      addOptions(yargs, false);
    },
    async function (argv) {
      const buffer = await stdin();
      const formattingOptions = createFormattingOptions(argv);
      const editResult = jsonc.format(buffer, undefined, formattingOptions);
      const result = jsonc.applyEdits(buffer, editResult);
      const logger = createLogger(argv);
      await logger(result);
    }
  )
  .command(
    "read [JSONPath]",
    "Prints the JSON value at the given path in a JSONC document from stdin",
    (yargs) => {
      yargs.positional("JSONPath", {
        type: "string",
        describe: `Pass like '[1, "someKey"]'. Corresponds to the type (string | number)[]`,
        demandOption: false,
      });
      addOptions(yargs, true);
      checkJSONPath(yargs);
    },
    async function (argv) {
      /** @type jsonc.JSONPath */
      const path = !argv.JSONPath ? [] : JSON.parse(argv.JSONPath);
      const buffer = await stdin();
      const tree = jsonc.parseTree(buffer);
      if (!tree) {
        throw new Error("Invalid JSONC on stdin");
      }
      const leaf = jsonc.findNodeAtLocation(tree, path);
      if (!leaf) {
        throw new Error(
          "Invalid JSONPath, could not find the value in the JSONC document"
        );
      }
      const nodeValue = jsonc.getNodeValue(leaf);
      const logger = createLogger(argv);
      if (argv.raw) {
        if (typeof nodeValue === "string") {
          await logger(nodeValue);
          return;
        }
      }
      if (argv.format) {
        await logger(JSON.stringify(nodeValue, null, 2));
      } else {
        await logger(JSON.stringify(nodeValue));
      }
    }
  )
  .help()
  .demandCommand().argv;
