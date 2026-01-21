#!/bin/bash
#
# Collects reaction data from AI reviewer comments and stores it in a GitHub issue.
# Uses gh CLI for GitHub API interactions.
#
# Usage:
#   ./collectReactions.sh --user=github-actions[bot] --repo=Expensify/App --days=30 [--dry-run]
#
# Environment variables:
#   GITHUB_TOKEN or GH_TOKEN - GitHub authentication token

set -euo pipefail

# Configuration
DATA_ISSUE_LABEL="AIReviewerReactionsData"
DATA_VERSION="1.0"

# Parse arguments
TARGET_USER=""
REPOSITORY=""
DAYS=30
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --user=*)
            TARGET_USER="${arg#*=}"
            ;;
        --repo=*)
            REPOSITORY="${arg#*=}"
            ;;
        --days=*)
            DAYS="${arg#*=}"
            ;;
        --dry-run)
            DRY_RUN=true
            ;;
        *)
            echo "Unknown argument: $arg"
            exit 1
            ;;
    esac
done

# Validate required arguments
if [[ -z "$TARGET_USER" ]]; then
    echo "Error: --user is required"
    exit 1
fi

if [[ -z "$REPOSITORY" ]]; then
    echo "Error: --repo is required"
    exit 1
fi

echo "Configuration:"
echo "  Target User: $TARGET_USER"
echo "  Repository: $REPOSITORY"
echo "  Days: $DAYS"
echo "  Dry Run: $DRY_RUN"
echo ""

# Calculate date range (macOS vs Linux compatible)
if date -v-1d &>/dev/null; then
    # macOS
    SINCE_DATE=$(date -v-${DAYS}d +%Y-%m-%d)
    CUTOFF_DATE=$(date -v-${DAYS}d +%Y-%m-%dT00:00:00Z)
else
    # Linux
    SINCE_DATE=$(date -d "-${DAYS} days" +%Y-%m-%d)
    CUTOFF_DATE=$(date -d "-${DAYS} days" +%Y-%m-%dT00:00:00Z)
fi
echo "Looking for comments since: $SINCE_DATE"

# Create temp file for records
RECORDS_FILE=$(mktemp)
trap "rm -f $RECORDS_FILE" EXIT

# Process repository
REPO="$REPOSITORY"
echo ""
echo "Processing repository: $REPO"

# Find PRs where target user commented
PRS_JSON=$(gh pr list --repo "$REPO" --search "commenter:$TARGET_USER updated:>$SINCE_DATE" --json number,title --limit 500 --state all 2>/dev/null || echo "[]")

    PR_COUNT=$(echo "$PRS_JSON" | jq 'length')
    echo "  Found $PR_COUNT PRs with comments from $TARGET_USER"

    # Process each PR
    for PR_NUMBER in $(echo "$PRS_JSON" | jq -r '.[].number'); do
        PR_TITLE=$(echo "$PRS_JSON" | jq -r ".[] | select(.number == $PR_NUMBER) | .title")
        echo "    Processing PR #$PR_NUMBER"

        # Fetch review comments
        COMMENTS_JSON=$(gh api "repos/$REPO/pulls/$PR_NUMBER/comments" --paginate 2>/dev/null || echo "[]")

        # Process each comment from target user
        COMMENT_IDS=$(echo "$COMMENTS_JSON" | jq -r ".[] | select(.user.login == \"$TARGET_USER\") | .id")

        for COMMENT_ID in $COMMENT_IDS; do
            # Get comment details
            COMMENT=$(echo "$COMMENTS_JSON" | jq ".[] | select(.id == $COMMENT_ID)")
            COMMENT_URL=$(echo "$COMMENT" | jq -r '.html_url')
            COMMENT_BODY=$(echo "$COMMENT" | jq -r '.body')
            COMMENT_CREATED=$(echo "$COMMENT" | jq -r '.created_at')

            # Extract prefix tags (### ❌ TAG-NUMBER or ### [TAG-NUMBER])
            # Matches formats like "### ❌ PERF-1" or "### [PERF-1]"
            TAGS_RAW=$(echo "$COMMENT_BODY" | grep -oE '###\s*(❌|✅)?\s*\[?[A-Z]+-[0-9]+\]?' | grep -oE '[A-Z]+-[0-9]+' || true)
            if [[ -n "$TAGS_RAW" ]]; then
                PREFIX_TAGS=$(echo "$TAGS_RAW" | jq -R -s -c 'split("\n") | map(select(length > 0))')
            else
                PREFIX_TAGS="[]"
            fi

            # Get body preview (first 100 chars, escape for JSON)
            BODY_PREVIEW=$(echo "$COMMENT_BODY" | head -c 100 | tr '\n' ' ' | jq -Rs '.')

            # Fetch reactions
            REACTIONS_JSON=$(gh api "repos/$REPO/pulls/comments/$COMMENT_ID/reactions" 2>/dev/null || echo "[]")
            THUMBS_UP=$(echo "$REACTIONS_JSON" | jq '[.[] | select(.content == "+1")] | length // 0')
            THUMBS_DOWN=$(echo "$REACTIONS_JSON" | jq '[.[] | select(.content == "-1")] | length // 0')

            # Ensure numeric values have defaults
            THUMBS_UP=${THUMBS_UP:-0}
            THUMBS_DOWN=${THUMBS_DOWN:-0}

            # Create record JSON and append to file
            jq -n \
                --argjson id "$COMMENT_ID" \
                --argjson prNumber "$PR_NUMBER" \
                --arg prTitle "$PR_TITLE" \
                --arg repo "$REPO" \
                --arg commentUrl "$COMMENT_URL" \
                --argjson commentBodyPreview "$BODY_PREVIEW" \
                --argjson prefixTags "$PREFIX_TAGS" \
                --argjson thumbsUp "$THUMBS_UP" \
                --argjson thumbsDown "$THUMBS_DOWN" \
                --arg collectedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
                --arg commentCreatedAt "$COMMENT_CREATED" \
                '{
                    id: $id,
                    prNumber: $prNumber,
                    prTitle: $prTitle,
                    repo: $repo,
                    commentUrl: $commentUrl,
                    commentBodyPreview: $commentBodyPreview,
                    prefixTags: $prefixTags,
                    reactions: {
                        thumbsUp: $thumbsUp,
                        thumbsDown: $thumbsDown
                    },
                    collectedAt: $collectedAt,
                    commentCreatedAt: $commentCreatedAt
                }' >> "$RECORDS_FILE"
        done
    done

# Collect all records from temp file
if [[ -s "$RECORDS_FILE" ]]; then
    RECORDS=$(jq -s '.' "$RECORDS_FILE")
else
    RECORDS="[]"
fi

# Filter records within the date window
RECORDS=$(echo "$RECORDS" | jq --arg cutoff "$CUTOFF_DATE" '[.[] | select(.commentCreatedAt > $cutoff)]')

# Calculate statistics
TOTAL_COMMENTS=$(echo "$RECORDS" | jq 'length')
TOTAL_THUMBS_UP=$(echo "$RECORDS" | jq '[.[].reactions.thumbsUp] | add // 0')
TOTAL_THUMBS_DOWN=$(echo "$RECORDS" | jq '[.[].reactions.thumbsDown] | add // 0')

if [[ $((TOTAL_THUMBS_UP + TOTAL_THUMBS_DOWN)) -gt 0 ]]; then
    APPROVAL_RATE=$(echo "scale=1; $TOTAL_THUMBS_UP * 100 / ($TOTAL_THUMBS_UP + $TOTAL_THUMBS_DOWN)" | bc)
else
    APPROVAL_RATE="0.0"
fi

# Calculate per-rule statistics
# This aggregates all comments by their rule ID (prefix tag)
RULE_STATS=$(echo "$RECORDS" | jq '
    # Flatten: each comment may have multiple tags, create one entry per tag
    [.[] | .prefixTags[] as $tag | {tag: $tag, thumbsUp: .reactions.thumbsUp, thumbsDown: .reactions.thumbsDown}]
    # Group by tag
    | group_by(.tag)
    # Calculate stats per rule
    | map({
        ruleId: .[0].tag,
        violations: length,
        thumbsUp: (map(.thumbsUp) | add),
        thumbsDown: (map(.thumbsDown) | add)
    })
    # Add calculated ratios
    | map(. + {
        # Violations with feedback = (thumbsUp + thumbsDown) / violations * 100
        violationsWithFeedback: (if .violations > 0 then ((.thumbsUp + .thumbsDown) / .violations * 100 | . * 10 | floor / 10) else 0 end),
        # Efficiency = thumbsUp / (thumbsUp + thumbsDown) * 100 (0-100% scale)
        efficiency: (if (.thumbsUp + .thumbsDown) > 0 then (.thumbsUp / (.thumbsUp + .thumbsDown) * 100 | . * 10 | floor / 10) else null end)
    })
    # Sort by efficiency descending (nulls last)
    | sort_by(-(if .efficiency then .efficiency else -1 end))
')

echo ""
echo "Collection complete:"
echo "  Total Violations: $TOTAL_COMMENTS"
echo "  Thumbs Up: $TOTAL_THUMBS_UP"
echo "  Thumbs Down: $TOTAL_THUMBS_DOWN"
echo "  Approval Rate: ${APPROVAL_RATE}%"
echo ""
echo "Per-rule statistics:"
echo "$RULE_STATS" | jq -r '.[] | "  \(.ruleId): \(.violations) violations, +\(.thumbsUp)/-\(.thumbsDown), efficiency: \(if .efficiency then "\(.efficiency)%" else "N/A" end)"'

# Build full data store JSON
DATA_STORE=$(jq -n \
    --arg version "$DATA_VERSION" \
    --arg lastUpdated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg targetUser "$TARGET_USER" \
    --arg repository "$REPOSITORY" \
    --argjson windowDays "$DAYS" \
    --argjson records "$RECORDS" \
    '{
        version: $version,
        lastUpdated: $lastUpdated,
        config: {
            targetUser: $targetUser,
            repository: $repository,
            windowDays: $windowDays
        },
        records: $records
    }')

if [[ "$DRY_RUN" == "true" ]]; then
    echo ""
    echo "Dry run mode - skipping issue update"
    echo ""
    echo "Data that would be saved:"
    echo "$DATA_STORE" | jq '.'
    exit 0
fi

# Get repository info for API calls
# GITHUB_REPOSITORY is set automatically in GitHub Actions (e.g., "Expensify/App")
# Fall back to the target repo if not running in GitHub Actions
ISSUE_REPO="${GITHUB_REPOSITORY:-$REPOSITORY}"
ISSUE_OWNER=$(echo "$ISSUE_REPO" | cut -d'/' -f1)
ISSUE_REPO_NAME=$(echo "$ISSUE_REPO" | cut -d'/' -f2)

# Include target repo in title to distinguish between repos
DATA_ISSUE_TITLE="AI Reviewer Reactions Data [$REPOSITORY]"

echo ""
echo "Updating data issue in $ISSUE_OWNER/$ISSUE_REPO_NAME..."

# Find existing issue by label AND title (to distinguish between repos)
EXISTING_ISSUE=$(gh api "repos/$ISSUE_OWNER/$ISSUE_REPO_NAME/issues?labels=$DATA_ISSUE_LABEL&state=open" --jq ".[] | select(.title == \"$DATA_ISSUE_TITLE\") | .number" 2>/dev/null | head -1 || echo "")

if [[ -z "$EXISTING_ISSUE" ]]; then
    echo "Creating new data issue for $REPOSITORY..."
    EXISTING_ISSUE=$(gh issue create \
        --repo "$ISSUE_OWNER/$ISSUE_REPO_NAME" \
        --title "$DATA_ISSUE_TITLE" \
        --label "$DATA_ISSUE_LABEL" \
        --body "Initializing..." \
        | grep -oE '[0-9]+$')
    echo "Created issue #$EXISTING_ISSUE"
else
    echo "Found existing issue #$EXISTING_ISSUE"
fi

# Generate rule statistics table for issue body
RULE_STATS_TABLE=""
if [[ "$TOTAL_COMMENTS" -gt 0 ]]; then
    RULE_STATS_TABLE=$(echo "$RULE_STATS" | jq -r '.[] | "| \(.ruleId) | \(.violations) | \(.thumbsUp) | \(.thumbsDown) | \(.violationsWithFeedback)% | \(if .efficiency then "\(.efficiency)%" else "N/A" end) |"')
fi
if [[ -z "$RULE_STATS_TABLE" ]]; then
    RULE_STATS_TABLE="| - | - | - | - | - | - |"
fi

# Generate issue body
ISSUE_BODY="# AI Reviewer Reactions Data

> This issue is automatically managed by the reactions collection workflow.
> Do not edit manually.

## Metadata
- **Last Updated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- **Data Window**: $DAYS days
- **Target User**: $TARGET_USER
- **Repository**: $REPOSITORY

## Summary Statistics
| Metric | Value |
|--------|-------|
| Total Violations | $TOTAL_COMMENTS |
| Thumbs Up | $TOTAL_THUMBS_UP |
| Thumbs Down | $TOTAL_THUMBS_DOWN |
| Approval Rate | ${APPROVAL_RATE}% |

## Statistics by Rule

| Rule ID | # of violations | 👍 | 👎 | Violations with feedback | Efficiency |
|---------|-----------------|----|----|--------------------------|------------|
$RULE_STATS_TABLE

> **Violations with feedback** = (👍 + 👎) / # of violations × 100%
> **Efficiency** = 👍 / (👍 + 👎) × 100% (0% = all negative, 100% = all positive)

---

<!-- DATA_START -->
\`\`\`json
$(echo "$DATA_STORE" | jq '.')
\`\`\`
<!-- DATA_END -->"

# Update issue body
echo "$ISSUE_BODY" | gh issue edit "$EXISTING_ISSUE" --repo "$ISSUE_OWNER/$ISSUE_REPO_NAME" --body-file -
echo "Updated issue #$EXISTING_ISSUE body"

# Generate run comment table rows
COMMENT_TABLE=""
if [[ "$TOTAL_COMMENTS" -gt 0 ]]; then
    COMMENT_TABLE=$(echo "$RECORDS" | jq -r '.[] | "| \(.prefixTags | if length > 0 then join(", ") else "N/A" end) | #\(.prNumber) | \(.reactions.thumbsUp) | \(.reactions.thumbsDown) | [View](\(.commentUrl | gsub("github.com"; "redirect.github.com"))) |"')
else
    COMMENT_TABLE="| - | - | - | - | - |"
fi

# Generate rule statistics table for run comment
RUN_RULE_STATS_TABLE=""
if [[ "$TOTAL_COMMENTS" -gt 0 ]]; then
    RUN_RULE_STATS_TABLE=$(echo "$RULE_STATS" | jq -r '.[] | "| \(.ruleId) | \(.violations) | \(.thumbsUp) | \(.thumbsDown) | \(.violationsWithFeedback)% | \(if .efficiency then "\(.efficiency)%" else "N/A" end) |"')
fi
if [[ -z "$RUN_RULE_STATS_TABLE" ]]; then
    RUN_RULE_STATS_TABLE="| - | - | - | - | - | - |"
fi

# Generate run comment
COMMENT_BODY="## Collection Run: $(date -u +%Y-%m-%dT%H:%M:%SZ)

**Summary:** $TOTAL_COMMENTS violations, ${APPROVAL_RATE}% approval rate

### Statistics by Rule

| Rule ID | # of violations | 👍 | 👎 | Violations with feedback | Efficiency |
|---------|-----------------|----|----|--------------------------|------------|
$RUN_RULE_STATS_TABLE

### All Comments

| Rule | PR | +1 | -1 | Link |
|------|----|----|----|------|
$COMMENT_TABLE"

# Post comment
gh issue comment "$EXISTING_ISSUE" --repo "$ISSUE_OWNER/$ISSUE_REPO_NAME" --body "$COMMENT_BODY"
echo "Posted run comment to issue #$EXISTING_ISSUE"

echo ""
echo "Done! View the data issue: https://github.com/$ISSUE_OWNER/$ISSUE_REPO_NAME/issues/$EXISTING_ISSUE"

# Set outputs for GitHub Actions
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "TOTAL_COMMENTS=$TOTAL_COMMENTS" >> "$GITHUB_OUTPUT"
    echo "APPROVAL_RATE=$APPROVAL_RATE" >> "$GITHUB_OUTPUT"
fi
