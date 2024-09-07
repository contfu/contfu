export function authenticate(key: string) {
  return keys.get(key);
}

const keys = new Map<string, object>();
keys.set("5B1060C74333C08D5721554550AAE735D7B8928274C0218877B01BBC53D53B9C", {
  name: "js2brain",
});
