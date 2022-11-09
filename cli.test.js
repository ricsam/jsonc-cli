const cp = require("child_process");
const util = require("util");
const fs = require("fs");
const path = require("path");

describe("read", () => {
  it("should run read", async () => {
    const output = await invokeCli(JSON.stringify(["hello"]), "read", ["[0]"]);
    expect(output).toBe(JSON.stringify("hello") + "\n");
  });
  it("should write to file", async () => {
    let resolve;
    const writeFileSpy = jest
      .spyOn(fs, "writeFile")
      .mockImplementation((filename, data, callback) => {
        callback(null);
        if (resolve) {
          resolve();
        }
      });

    const writable = new (require("stream").Duplex)();
    writable._write = function (chunk, encoding, done) {
      done();
    };
    writable._read = function (chunk, encoding, done) {
      this.push(JSON.stringify(["hello"]));
      this.push(null);
      this.end();
    };
    const defineProcess = (ob) => {
      Object.entries(ob).forEach(([key, value]) => {
        Object.defineProperty(process, key, {
          value: value,
          configurable: true,
          writable: false,
        });
      });
    };
    defineProcess({
      stdin: writable,
      argv: ["node", "./cli.js", "read", "[0]", "-r", "-n", "-f", "output.txt"],
    });
    const origs = { stdin: process.stdin, argv: process.argv };
    await new Promise((_resolve) => {
      resolve = _resolve;
      require("./cli");
    });
    expect(writeFileSpy).toHaveBeenCalledWith(
      "output.txt",
      "hello",
      expect.any(Function)
    );
    defineProcess(origs);
  });
  describe("default positional argument", () => {
    it("should run read from the root", async () => {
      const output = await invokeCli(JSON.stringify(["hello"]), "read", ["[]"]);
      expect(output).toBe(JSON.stringify(["hello"]) + "\n");
    });
    it("should run read from the root", async () => {
      const output = await invokeCli(JSON.stringify(["hello"]), "read");
      expect(output).toBe(JSON.stringify(["hello"]) + "\n");
    });
  });
  describe("raw output", () => {
    it("should output string without quotes", async () => {
      const output = await invokeCli(JSON.stringify(["hello"]), "read", [
        "[0]",
        "-r",
      ]);
      expect(output).toBe("hello" + "\n");
    });
    it("should output string without quotes", async () => {
      const output = await invokeCli(JSON.stringify(["hello"]), "read", [
        "[0]",
        "--raw",
      ]);
      expect(output).toBe("hello" + "\n");
    });
  });
  it("should print without newline", async () => {
    const output = await invokeCli(JSON.stringify(["hello"]), "read", [
      "[0]",
      "-r",
      "-n",
    ]);
    expect(output).toBe("hello");
  });
  it("should print with formatting", async () => {
    const output = await invokeCli(JSON.stringify(["hello"]), "read", [
      "-n",
      "-m",
    ]);
    expect(output).toBe(JSON.stringify(["hello"], null, 2));
  });
});

describe("modify", () => {
  it("should modify", async () => {
    const output = await invokeCli(JSON.stringify(["hello"]), "modify", [
      "-p",
      "[0]",
      "-v",
      "123",
      "-n",
    ]);
    expect(output).toBe(JSON.stringify([123]));
  });
  it("should persist rest of the object", async () => {
    const output = await invokeCli(
      JSON.stringify({ a: ["hello"], b: ["please change me"] }),
      "modify",
      ["-p", `'["b", 0]'`, "-v", "123", "-n"]
    );
    expect(output).toBe(JSON.stringify({ a: ["hello"], b: [123] }));
  });
  describe("respect trailing new line", () => {
    it("should preserve new-line", async () => {
      const output = await invokeCli(
        JSON.stringify(["hello"], null, 2),
        "modify",
        ["-p", "[0]", "-v", "123", "-n"]
      );
      expect(output).toBe(JSON.stringify([123], null, 2));
    });
    it("should preserve an extra new-line", async () => {
      const output = await invokeCli(
        JSON.stringify(["hello"], null, 2) + "\n\n",
        "modify",
        ["-p", "[0]", "-v", "123", "-n"]
      );
      expect(output).toBe(JSON.stringify([123], null, 2) + "\n\n");
    });
  });
  it("should insert into an array", async () => {
    const output = await invokeCli(JSON.stringify(["hello"]), "modify", [
      "-p",
      "[0]",
      "-v",
      "123",
      "-n",
      "-i",
    ]);
    expect(output).toBe(JSON.stringify([123, "hello"]));
  });
  it("should delete item in array", async () => {
    const output = await invokeCli(JSON.stringify(["hello"]), "modify", [
      "-p",
      "[0]",
      "-n",
      "-d",
    ]);
    expect(output).toBe(JSON.stringify([]));
  });
  it("should delete item in ob", async () => {
    const output = await invokeCli(JSON.stringify({ a: 1 }), "modify", [
      "-p",
      `'["a"]'`,
      "-n",
      "-d",
    ]);
    expect(output).toBe(JSON.stringify({}));
  });
});

const formatFixture = async (fixtureName) => {
  return await invokeCli(
    (
      await fs.promises.readFile(
        path.join(__dirname, "__fixtures__", fixtureName + ".jsonc")
      )
    ).toString(),
    "format",
    []
  );
};

describe("format", () => {
  it("should format unformated1", async () => {
    const output = await formatFixture("unformated1");
    expect(output).toMatchInlineSnapshot(`
"//comment
{
  "key": "123"
}
"
`);
  });
  it("should format unformated2", async () => {
    const output = await formatFixture("unformated2");
    expect(output).toMatchInlineSnapshot(`
"{
  "animal": "cat"
}
"
`);
  });
});

async function invokeCli(stdin, command, args = []) {
  return new Promise((resolve, reject) => {
    const p = cp.exec(
      `node ./cli.js ${command} ${args.join(" ")}`,
      {},
      (err, stdout) => {
        if (err) {
          reject(err);
        } else {
          resolve(stdout);
        }
      }
    );
    p.stdin.write(stdin);
    p.stdin.end();
  });
}
