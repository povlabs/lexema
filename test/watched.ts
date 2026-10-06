// A parsed record that notes which of its fields a reader asks for, so a test
// can hold a list of read fields to what the readers really read
// (test/readFields.test.ts, test/projection.test.ts).

/**
 * `value`, answering every read as itself while adding the path of each field
 * asked for to `seen`: `senses[].form_of[].word`. A reader that lists an
 * object's keys reads all of them, which is `<path>.*`.
 */
export function watched<T>(value: T, seen: Set<string>, path = ""): T {
  if (typeof value !== "object" || value === null) return value;
  const fieldAt = (key: string) => (path === "" ? key : `${path}.${key}`);
  return new Proxy(value, {
    get(target, key, receiver) {
      const member: unknown = Reflect.get(target, key, receiver);
      if (typeof key !== "string") return member;
      if (Array.isArray(target)) return /^\d+$/.test(key) ? watched(member, seen, `${path}[]`) : member;
      seen.add(fieldAt(key));
      return watched(member, seen, fieldAt(key));
    },
    has(target, key) {
      if (typeof key === "string" && !Array.isArray(target)) seen.add(fieldAt(key));
      return Reflect.has(target, key);
    },
    ownKeys(target) {
      if (!Array.isArray(target)) seen.add(fieldAt("*"));
      return Reflect.ownKeys(target);
    },
  });
}
