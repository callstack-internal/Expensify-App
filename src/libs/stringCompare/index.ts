/**
 * Compare two strings in a case-insensitive manner. It is a performance fallback for Hermes engine. For other engines, it is a wrapper around the built-in localeCompare method.
 * @param a - The first string to compare
 * @param b - The second string to compare
 * @returns - `1` if first string takes precedence, `-1` if second string takes precedence, `0` if they are equal
 */
function stringCompare(a: string, b: string): number {
    return a.localeCompare(b);
}

export default stringCompare;
