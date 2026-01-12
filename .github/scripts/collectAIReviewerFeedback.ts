import * as core from '@actions/core';
import CONST from '@github/libs/CONST';
import GithubUtils from '@github/libs/GithubUtils';

type Reaction = {
    content: string;
    user: {
        login: string;
    };
};

type CommentNode = {
    id: string;
    body: string;
    url: string;
    reactions: {
        nodes: Reaction[];
    };
    pullRequest: {
        number: number;
        url: string;
    };
};

type ProcessedComment = {
    id: string;
    rule: string;
    prNumber: number;
    commentUrl: string;
    reactions: {
        positive: number;
        negative: number;
    };
    negativeReactions: Array<{
        user: string;
        timestamp: string;
    }>;
};

type ProcessedCommentsData = {
    processedComments: Record<string, ProcessedComment>;
    lastUpdated: string;
};

type RuleStats = {
    rule: string;
    positive: number;
    negative: number;
    total: number;
};

/**
 * Extract rule ID from comment body using the pattern [A-Z]+-[0-9]+
 */
function extractRuleId(body: string): string | null {
    const match = body.match(CONST.AI_REVIEWER_FEEDBACK.RULE_ID_PATTERN);
    return match ? match[0] : null;
}

/**
 * Check if comment is from AI reviewer (has rule ID and feedback footer)
 */
function isAIReviewerComment(body: string): boolean {
    const hasRuleId = CONST.AI_REVIEWER_FEEDBACK.RULE_ID_PATTERN.test(body);
    const hasFeedbackFooter = body.includes('Was this suggestion helpful?');
    return hasRuleId && hasFeedbackFooter;
}

/**
 * Fetch PR review comments with reactions using GraphQL
 */
async function fetchPRReviewComments(): Promise<CommentNode[]> {
    const query = `
        query($owner: String!, $repo: String!, $cursor: String) {
            repository(owner: $owner, name: $repo) {
                pullRequests(first: 50, states: [OPEN, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) {
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                    nodes {
                        number
                        url
                        reviewThreads(first: 100) {
                            nodes {
                                comments(first: 100) {
                                    nodes {
                                        id
                                        body
                                        url
                                        reactions(first: 100) {
                                            nodes {
                                                content
                                                user {
                                                    login
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    `;

    const allComments: CommentNode[] = [];
    let hasNextPage = true;
    let cursor: string | undefined;

    while (hasNextPage) {
        const response = await GithubUtils.graphql<{
            repository: {
                pullRequests: {
                    pageInfo: {
                        hasNextPage: boolean;
                        endCursor: string;
                    };
                    nodes: Array<{
                        number: number;
                        url: string;
                        reviewThreads: {
                            nodes: Array<{
                                comments: {
                                    nodes: Array<{
                                        id: string;
                                        body: string;
                                        url: string;
                                        reactions: {
                                            nodes: Array<{
                                                content: string;
                                                user: {
                                                    login: string;
                                                };
                                            }>;
                                        };
                                    }>;
                                };
                            }>;
                        };
                    }>;
                };
            };
        }>(query, {
            owner: CONST.GITHUB_OWNER,
            repo: CONST.APP_REPO,
            cursor: cursor ?? null,
        });

        const pullRequests = response.repository.pullRequests;
        hasNextPage = pullRequests.pageInfo.hasNextPage;
        cursor = pullRequests.pageInfo.endCursor;

        for (const pr of pullRequests.nodes) {
            for (const thread of pr.reviewThreads.nodes) {
                for (const comment of thread.comments.nodes) {
                    if (isAIReviewerComment(comment.body)) {
                        allComments.push({
                            ...comment,
                            pullRequest: {
                                number: pr.number,
                                url: pr.url,
                            },
                        });
                    }
                }
            }
        }

        // Limit to prevent excessive API calls
        if (allComments.length > 1000) {
            core.warning('Reached comment limit (1000), stopping pagination');
            break;
        }

        // Small delay to respect rate limits
        if (hasNextPage) {
            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });
        }
    }

    return allComments;
}

/**
 * Parse processed comments from issue body
 */
function parseProcessedComments(issueBody: string): ProcessedCommentsData {
    const jsonMatch = issueBody.match(/<!--\s*JSON_START\s*-->([\s\S]*?)<!--\s*JSON_END\s*-->/);
    if (!jsonMatch) {
        core.info('No existing processed comments data found in issue body');
        return {
            processedComments: {},
            lastUpdated: new Date().toISOString(),
        };
    }

    try {
        const parsed = JSON.parse(jsonMatch[1].trim()) as ProcessedCommentsData;
        core.info(`Loaded ${Object.keys(parsed.processedComments).length} previously processed comments`);
        return parsed;
    } catch (error) {
        core.warning(`Failed to parse processed comments JSON: ${error instanceof Error ? error.message : String(error)}`);
        return {
            processedComments: {},
            lastUpdated: new Date().toISOString(),
        };
    }
}

/**
 * Process comments and extract new reactions
 */
function processComments(
    comments: CommentNode[],
    existingData: ProcessedCommentsData,
): {
    newProcessedComments: Record<string, ProcessedComment>;
    newNegativeReactions: Array<{
        commentId: string;
        rule: string;
        prNumber: number;
        commentUrl: string;
        user: string;
    }>;
} {
    const newProcessedComments: Record<string, ProcessedComment> = {};
    const newNegativeReactions: Array<{
        commentId: string;
        rule: string;
        prNumber: number;
        commentUrl: string;
        user: string;
    }> = [];

    for (const comment of comments) {
        const rule = extractRuleId(comment.body);
        if (!rule) {
            continue;
        }

        const existing = existingData.processedComments[comment.id];
        const positiveCount = comment.reactions.nodes.filter((r) => r.content === CONST.AI_REVIEWER_FEEDBACK.POSITIVE_REACTION).length;
        const negativeReactions = comment.reactions.nodes.filter((r) => r.content === CONST.AI_REVIEWER_FEEDBACK.NEGATIVE_REACTION);

        // Check for new negative reactions
        if (existing) {
            const existingNegativeUsers = new Set(existing.negativeReactions.map((nr) => nr.user));
            for (const reaction of negativeReactions) {
                if (!existingNegativeUsers.has(reaction.user.login)) {
                    newNegativeReactions.push({
                        commentId: comment.id,
                        rule,
                        prNumber: comment.pullRequest.number,
                        commentUrl: comment.url,
                        user: reaction.user.login,
                    });
                }
            }
        } else if (negativeReactions.length > 0) {
            // First time processing this comment, all negative reactions are new
            for (const reaction of negativeReactions) {
                newNegativeReactions.push({
                    commentId: comment.id,
                    rule,
                    prNumber: comment.pullRequest.number,
                    commentUrl: comment.url,
                    user: reaction.user.login,
                });
            }
        }

        newProcessedComments[comment.id] = {
            id: comment.id,
            rule,
            prNumber: comment.pullRequest.number,
            commentUrl: comment.url,
            reactions: {
                positive: positiveCount,
                negative: negativeReactions.length,
            },
            negativeReactions: negativeReactions.map((r) => ({
                user: r.user.login,
                timestamp: new Date().toISOString(),
            })),
        };
    }

    return {
        newProcessedComments: {...existingData.processedComments, ...newProcessedComments},
        newNegativeReactions,
    };
}

/**
 * Aggregate stats by rule
 */
function aggregateRuleStats(processedComments: Record<string, ProcessedComment>): RuleStats[] {
    const ruleMap = new Map<string, {positive: number; negative: number}>();

    for (const comment of Object.values(processedComments)) {
        const existing = ruleMap.get(comment.rule) ?? {positive: 0, negative: 0};
        ruleMap.set(comment.rule, {
            positive: existing.positive + comment.reactions.positive,
            negative: existing.negative + comment.reactions.negative,
        });
    }

    return Array.from(ruleMap.entries())
        .map(([rule, counts]) => ({
            rule,
            positive: counts.positive,
            negative: counts.negative,
            total: counts.positive + counts.negative,
        }))
        .sort((a, b) => b.total - a.total);
}

/**
 * Generate issue body with stats table
 */
function generateIssueBody(stats: RuleStats[], processedComments: Record<string, ProcessedComment>): string {
    let body = '# AI Reviewer Feedback Tracking\n\n';
    body += `Last updated: ${new Date().toISOString()}\n\n`;

    body += '## Reaction Stats by Rule\n\n';
    body += '| Rule   | 👍  | 👎  | Total |\n';
    body += '| ------ | --- | --- | ----- |\n';

    if (stats.length === 0) {
        body += '| _No feedback yet_ | - | - | - |\n';
    } else {
        for (const stat of stats) {
            body += `| ${stat.rule} | ${stat.positive}  | ${stat.negative}   | ${stat.total}    |\n`;
        }
    }

    body += '\n## Processed Comments\n\n';
    body += '<!-- JSON_START -->\n';
    body += JSON.stringify(
        {
            processedComments,
            lastUpdated: new Date().toISOString(),
        },
        null,
        2,
    );
    body += '\n<!-- JSON_END -->\n';

    return body;
}

/**
 * Find tracking issue by label
 */
async function findTrackingIssue(): Promise<number | null> {
    const issues = await GithubUtils.octokit.issues.listForRepo({
        owner: CONST.GITHUB_OWNER,
        repo: CONST.APP_REPO,
        labels: CONST.AI_REVIEWER_FEEDBACK.LABEL,
        state: 'open',
    });

    if (issues.data.length === 0) {
        return null;
    }

    if (issues.data.length > 1) {
        core.warning(`Found ${issues.data.length} tracking issues with label ${CONST.AI_REVIEWER_FEEDBACK.LABEL}. Using the first one.`);
    }

    return issues.data.at(0)?.number ?? null;
}

/**
 * Main function
 */
async function run() {
    try {
        GithubUtils.initOctokit();

        // Find tracking issue
        const issueNumber = await findTrackingIssue();
        if (!issueNumber) {
            const errorMessage = `No tracking issue found with label "${CONST.AI_REVIEWER_FEEDBACK.LABEL}". 
Please create a GitHub issue with the label "${CONST.AI_REVIEWER_FEEDBACK.LABEL}" to track AI reviewer feedback.`;
            core.error(errorMessage);
            process.exit(1);
        }

        core.info(`Found tracking issue #${issueNumber}`);

        // Get current issue body
        const issue = await GithubUtils.octokit.issues.get({
            owner: CONST.GITHUB_OWNER,
            repo: CONST.APP_REPO,
            issue_number: issueNumber, // eslint-disable-line @typescript-eslint/naming-convention
        });

        const existingData = parseProcessedComments(issue.data.body ?? '');

        // Fetch comments
        core.info('Fetching PR review comments...');
        const comments = await fetchPRReviewComments();
        core.info(`Found ${comments.length} AI reviewer comments`);

        // Process comments
        const {newProcessedComments, newNegativeReactions} = processComments(comments, existingData);

        // Aggregate stats
        const stats = aggregateRuleStats(newProcessedComments);

        // Update issue body
        const newBody = generateIssueBody(stats, newProcessedComments);
        await GithubUtils.octokit.issues.update({
            owner: CONST.GITHUB_OWNER,
            repo: CONST.APP_REPO,
            issue_number: issueNumber, // eslint-disable-line @typescript-eslint/naming-convention
            body: newBody,
        });

        core.info(`Updated tracking issue #${issueNumber}`);

        // Post notifications for new negative reactions
        if (newNegativeReactions.length > 0) {
            core.info(`Found ${newNegativeReactions.length} new negative reaction(s)`);

            for (const reaction of newNegativeReactions) {
                const notificationBody = `@${CONST.AI_REVIEWER_FEEDBACK.MAINTAINERS_TEAM}

New negative feedback received:

- **Rule**: ${reaction.rule}
- **PR**: #${reaction.prNumber}
- **Comment**: [Link](${reaction.commentUrl})
- **Reactor**: @${reaction.user}`;

                try {
                    await GithubUtils.createComment(CONST.APP_REPO, issueNumber, notificationBody);
                    core.info(`Posted notification for rule ${reaction.rule} from @${reaction.user}`);
                } catch (error) {
                    core.error(`Failed to post notification for rule ${reaction.rule}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        } else {
            core.info('No new negative reactions found');
        }
    } catch (error) {
        core.setFailed(`Error collecting AI reviewer feedback: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

run();
