import type {FootprintCapture, Finding} from './types';

const SEVERITY_LABEL: Record<Finding['severity'], string> = {flag: 'FLAG', warn: 'WARN'};

function pad(value: string, width: number): string {
    return value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width);
}

/** Human-readable summary of one capture, for `footprint diagnose` and for the tail of `footprint capture`. */
function printCapture(capture: FootprintCapture, topN = 20): string {
    const lines: string[] = [];

    lines.push(`\n${capture.flow} · ${capture.platform} · ${capture.runs} run(s) · ${capture.commit}`);

    const onyxRows = Object.entries(capture.onyx)
        .sort(([, a], [, b]) => b.notifies - a.notifies)
        .slice(0, topN);

    if (onyxRows.length === 0) {
        lines.push('\n  No Onyx subscription activity recorded. The in-app probe may not have started.');
    } else {
        // Headers are spelled out because the counts differ in kind: "subscribers" is cumulative
        // over the run, "live peak" is simultaneous.
        const keyWidth = Math.min(38, Math.max(12, ...onyxRows.map(([key]) => key.length)));
        lines.push(`\n  ${pad('onyx key', keyWidth)}  updates  live peak  subscribers  whole-collection`);
        lines.push(`  ${'-'.repeat(keyWidth)}  -------  ---------  -----------  ----------------`);
        for (const [key, stat] of onyxRows) {
            const wholeCollection = stat.rootSubscribes > 0 ? String(stat.rootSubscribes) : '·';
            lines.push(
                [
                    `  ${pad(key, keyWidth)}`,
                    String(stat.notifies).padStart(7),
                    String(stat.peakConcurrent).padStart(9),
                    String(stat.subscribes).padStart(11),
                    wholeCollection.padStart(16),
                ].join('  '),
            );
        }
    }

    const renders = capture.renders.slice(0, topN);

    if (renders.length === 0) {
        lines.push('\n  No component render data recorded. The profiler may have attached to the wrong target.');
    } else {
        const nameWidth = Math.min(42, Math.max(12, ...renders.map((render) => render.name.length)));
        lines.push(`\n  ${pad('component', nameWidth)}  commits  total ms  changed keys`);
        lines.push(`  ${'-'.repeat(nameWidth)}  -------  --------  ------------`);
        for (const render of renders) {
            lines.push(
                `  ${pad(render.name, nameWidth)}  ${String(render.renderCount).padStart(7)}  ${render.totalDurationMs.toFixed(1).padStart(8)}  ${render.changedKeys.slice(0, 4).join(', ')}`,
            );
        }
    }

    return `${lines.join('\n')}\n`;
}

function printFindings(findings: Finding[]): string {
    if (findings.length === 0) {
        return '\nNo footprint regressions against the baseline.\n';
    }

    const lines = [''];
    for (const finding of findings) {
        lines.push(`${SEVERITY_LABEL[finding.severity]}  ${finding.rule}  ${finding.subject}`);
        lines.push(`      ${finding.detail}`);
    }

    const flags = findings.filter((finding) => finding.severity === 'flag').length;
    lines.push(`\n${findings.length} finding(s), ${flags} flag(s).`);

    return `${lines.join('\n')}\n`;
}

/** Markdown for `gh pr comment`. Kept short; the numbers only mean anything as ratios. */
function findingsAsMarkdown(baseline: FootprintCapture, candidate: FootprintCapture, findings: Finding[]): string {
    const header = `**Runtime footprint** · \`${candidate.flow}\` · ${candidate.platform} · ${candidate.runs} runs vs baseline \`${baseline.commit}\``;

    if (findings.length === 0) {
        return `${header}\n\nNo regressions.`;
    }

    const rows = findings.map(
        (finding) => `| ${SEVERITY_LABEL[finding.severity]} | \`${finding.rule}\` | \`${finding.subject}\` | ${finding.baseline} | ${finding.candidate} | ${finding.detail} |`,
    );

    return [
        header,
        '',
        '| | rule | subject | baseline | candidate | detail |',
        '| --- | --- | --- | --- | --- | --- |',
        ...rows,
        '',
        '_Debug-build counts. Comparable within one build mode only, never absolute._',
    ].join('\n');
}

export {findingsAsMarkdown, printCapture, printFindings};
