/**
 * Context pruning utilities for WebSeek's LLM calls.
 *
 * Problem: The system accumulates HTML snapshots for every page the user visits.
 * Without filtering, every LLM call receives all of them — causing context explosion,
 * high latency, and token waste (Section 8.5 of the CHI paper).
 *
 * Strategy:
 *  1. Page-level filtering  — only send snapshots referenced by current instances.
 *  2. Per-page size cap     — hard-truncate HTML that still exceeds the limit after
 *                             cleanHTML() has already stripped scripts/styles.
 *
 * Note: DOM-level summarisation (removing hidden elements, etc.) is deliberately
 * deferred to a future pass. cleanHTML() in utils.ts already handles the bulk of
 * script/style removal; this module focuses on the higher-impact page-selection step.
 */

import type { Instance, UserActionEvent } from './types';

// ~150 KB of raw HTML per page ≈ ~37 K tokens — enough for full table/listing pages
// while preventing runaway context from large SPAs.
const MAX_HTML_CHARS_PER_PAGE = 150_000;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the set of pageIds that are actually referenced by any instance
 * (including embedded instances inside tables and sketches).
 */
export function getReferencedPageIds(instances: Instance[]): Set<string> {
    const pageIds = new Set<string>();

    const visit = (inst: any): void => {
        if (inst?.source?.type === 'web' && inst.source.pageId) {
            pageIds.add(inst.source.pageId);
        }
        // Embedded instances inside table cells
        if (inst?.type === 'table' && Array.isArray(inst.cells)) {
            for (const row of inst.cells) {
                for (const cell of row) {
                    if (cell) visit(cell);
                }
            }
        }
        // Embedded instances inside sketch content items
        if (inst?.type === 'sketch' && Array.isArray(inst.content)) {
            for (const item of inst.content) {
                if (item?.type === 'instance' && item.instance) {
                    visit(item.instance);
                }
            }
        }
    };

    for (const inst of instances) visit(inst);
    return pageIds;
}

/**
 * Main entry point.
 *
 * Given the full map of loaded HTML snapshots and the instances currently in the
 * workspace, returns a pruned map containing only the pages that are actually
 * needed.  Each retained page is also size-capped to avoid sending enormous DOMs.
 *
 * @param htmlContexts  Full snapshot map keyed by pageId.
 * @param instances     Instances currently in the workspace (used to determine
 *                      which pageIds are referenced).
 * @returns Pruned snapshot map — always a subset of htmlContexts.
 */
export function pruneHtmlContext(
    htmlContexts: Record<string, { pageURL: string; htmlContent: string }>,
    instances: Instance[],
): Record<string, { pageURL: string; htmlContent: string }> {
    const totalBefore = Object.keys(htmlContexts).length;

    // Step 1 — keep only pages referenced by at least one instance
    const referencedIds = getReferencedPageIds(instances);

    const filtered: Record<string, { pageURL: string; htmlContent: string }> = {};
    for (const pageId of referencedIds) {
        if (htmlContexts[pageId]) {
            filtered[pageId] = htmlContexts[pageId];
        }
    }

    // Step 2 — apply per-page character cap
    const pruned: Record<string, { pageURL: string; htmlContent: string }> = {};
    for (const [pageId, data] of Object.entries(filtered)) {
        if (data.htmlContent.length > MAX_HTML_CHARS_PER_PAGE) {
            console.warn(
                `[ContextFilter] Page ${pageId} HTML truncated: ${data.htmlContent.length.toLocaleString()} → ${MAX_HTML_CHARS_PER_PAGE.toLocaleString()} chars`,
            );
            pruned[pageId] = {
                pageURL: data.pageURL,
                htmlContent:
                    data.htmlContent.slice(0, MAX_HTML_CHARS_PER_PAGE) +
                    '\n<!-- [truncated by WebSeek context filter] -->',
            };
        } else {
            pruned[pageId] = data;
        }
    }

    const totalAfter = Object.keys(pruned).length;
    if (totalBefore !== totalAfter) {
        console.log(
            `[ContextFilter] HTML context pruned: ${totalBefore} → ${totalAfter} page(s) (referenced by current instances)`,
        );
    }

    return pruned;
}

// ─────────────────────────────────────────────────────────────────────────────
// Instance context pruning for proactive suggestion calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filters the workspace instance list down to instances that are actually
 * relevant to the current proactive suggestion pass.
 *
 * Relevance is determined by two criteria (either is sufficient):
 *  1. The instance was recently interacted with (its ID appears in recent actions).
 *  2. The instance is on the same page as a recently-interacted instance
 *     (so the LLM has enough relational context to make join / viz suggestions).
 *
 * For chat and infer calls we always send the full instance list — this helper
 * is only called from the proactive-suggestion path where latency matters most.
 *
 * @param instances    Full workspace instance list.
 * @param recentActions Last N user actions from the action monitor.
 * @param maxInstances  Hard cap on the number of instances returned (default 20).
 */
export function pruneInstanceContext(
    instances: Instance[],
    recentActions: UserActionEvent[],
    maxInstances: number = 20,
): Instance[] {
    if (instances.length <= maxInstances) {
        return instances; // Nothing to prune
    }

    // Collect instanceIds that appear in recent actions
    const recentIds = new Set<string>();
    for (const action of recentActions) {
        if (action.instanceId) recentIds.add(action.instanceId);
        // Some actions record the ID inside context or metadata
        if (action.context?.tableId) recentIds.add(action.context.tableId);
        if (action.context?.instanceId) recentIds.add(action.context.instanceId);
        if (action.metadata?.instanceId) recentIds.add(action.metadata.instanceId);
    }

    // Partition into recently-active and background instances
    const active: Instance[] = [];
    const background: Instance[] = [];
    for (const inst of instances) {
        if (recentIds.has(inst.id)) {
            active.push(inst);
        } else {
            background.push(inst);
        }
    }

    // Always include all recently-active instances; fill remaining slots with
    // background instances (most recently added first, i.e. tail of the array).
    const slotsForBackground = Math.max(0, maxInstances - active.length);
    const selected = [
        ...active,
        ...background.slice(-slotsForBackground),
    ];

    if (selected.length < instances.length) {
        console.log(
            `[ContextFilter] Instance context pruned: ${instances.length} → ${selected.length} instances (${active.length} active + ${selected.length - active.length} background)`,
        );
    }

    return selected;
}
