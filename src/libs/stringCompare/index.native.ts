/**
 * Compare two strings in a case-insensitive manner. It is a performance fallback for the built-in String.localeCompare method in Hermes.
 * @param a - The first string to compare
 * @param b - The second string to compare
 * @returns - `1` if first string takes precedence, `-1` if second string takes precedence, `0` if they are equal
 */
function stringCompare(a: string, b: string): number {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

// eslint-disable-next-line import/prefer-default-export
export default stringCompare;
