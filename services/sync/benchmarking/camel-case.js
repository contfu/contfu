const methods = {
  regexSingle: (str) => {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
  },

  regexMultiple: (str) => {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
      .replace(/^(.)/, (_, c) => c.toLowerCase());
  },

  split: (str) => {
    return str
      .split(/[-_\s]+/)
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join("");
  },

  charArray: (str) => {
    let result = "";
    let capitalizeNext = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (/[-_\s]/.test(char)) {
        capitalizeNext = true;
      } else {
        if (capitalizeNext) {
          result += char.toUpperCase();
          capitalizeNext = false;
        } else if (i === 0) {
          result += char.toLowerCase();
        } else {
          result += char;
        }
      }
    }
    return result;
  },
};

function runCamelCaseTest() {
  const testStrings = [
    "hello world",
    "HELLO WORLD",
    "hello-world",
    "Hello_World_Example",
    "already-camelCase",
    "multiple   spaces   here",
    "mixed-CASE_string",
  ];
  const iterations = 100000;

  // Warm up
  testStrings.forEach((str) => {
    Object.values(methods).forEach((fn) => fn(str));
  });

  // Test each method
  for (const [name, fn] of Object.entries(methods)) {
    console.time(name);
    for (let i = 0; i < iterations; i++) {
      testStrings.forEach((str) => fn(str));
    }
    console.timeEnd(name);
  }
}

// Run the test and show example outputs
const testCase = "hello-world_EXAMPLE string";
console.log("\nExample conversions of:", testCase);
for (const [name, fn] of Object.entries(methods)) {
  console.log(`${name}:`, fn(testCase));
}

runCamelCaseTest();
