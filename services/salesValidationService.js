'use strict';

const catalog = require('../prompts/sales/catalogMaster');
const { validateResponse } = require('./validationService');

const CONFIDENCE = new Set(['high', 'medium', 'low']);
const SORT_HINTS = new Set(['relevance', 'price_low_to_high', 'price_high_to_low', 'newest', 'fastest_delivery', 'premium_first']);
const RESULT_STRATEGIES = new Set(['narrow_exact', 'balanced_curated', 'broad_preview']);

const asShortText = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';

const validPriceRange = (value) => {
    const match = String(value).match(/^(\d+)-(\d+)$/);
    if (!match) return false;
    const min = Number(match[1]);
    const max = Number(match[2]);
    return Number.isSafeInteger(min) && Number.isSafeInteger(max) && min >= 0 && max >= min;
};

const normalizeFilters = (rawFilters = [], activeFacetNames = null, errors = []) => {
    const merged = new Map();
    const active = Array.isArray(activeFacetNames) ? new Set(activeFacetNames) : null;

    (Array.isArray(rawFilters) ? rawFilters : []).forEach((item) => {
        const facetName = typeof item?.facet_name === 'string' ? item.facet_name : '';
        const facet = catalog[facetName];
        if (!facet) {
            errors.push('unknown_facet_removed');
            return;
        }
        if (active && !active.has(facetName)) {
            errors.push('inactive_facet_removed');
            return;
        }
        if (!Array.isArray(item?.values)) {
            errors.push('invalid_filter_values_removed');
            return;
        }

        const values = item.values
            .map((value) => String(value))
            .filter((value) => facet.dynamic_numeric_range ? validPriceRange(value) : facet.values.includes(value));
        if (values.length !== item.values.length) errors.push('unknown_filter_value_removed');
        if (!values.length) return;

        if (item?.filter_name !== facet.filter_name) errors.push('filter_name_corrected');
        if (!merged.has(facetName)) merged.set(facetName, new Set());
        values.forEach((value) => merged.get(facetName).add(value));
    });

    return [...merged.entries()].map(([facetName, values]) => {
        let normalizedValues = [...values];
        if (facetName === 'audience_uFilter' && normalizedValues.length > 1) {
            normalizedValues = normalizedValues.slice(0, 1);
            errors.push('multiple_gender_values_reduced');
        }
        return {
            filter_name: catalog[facetName].filter_name,
            facet_name: facetName,
            values: normalizedValues
        };
    });
};

const normalizeFollowup = (followup = {}, errors = []) => {
    if (followup?.ask !== true) return { ask: false, question: '', options: [] };

    const question = asShortText(followup?.question, 180);
    const options = [...new Set((Array.isArray(followup?.options) ? followup.options : [])
        .map((option) => asShortText(option, 60))
        .filter(Boolean))].slice(0, 5);

    if (!question) {
        errors.push('invalid_followup_removed');
        return { ask: false, question: '', options: [] };
    }
    if (options.length < 2) errors.push('followup_options_too_few');
    if ((followup?.options || []).length > 5) errors.push('followup_options_truncated');
    return { ask: true, question, options };
};

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const removeDuplicatedQuestion = (reply = '', question = '', errors = []) => {
    if (!reply || !question) return reply;
    const normalizedReply = reply.trim();
    const exactAtEnd = new RegExp(`(?:\\s|^)*${escapeRegExp(question)}\\s*$`, 'i');
    if (!exactAtEnd.test(normalizedReply)) return normalizedReply;
    errors.push('duplicate_followup_removed_from_reply');
    return normalizedReply.replace(exactAtEnd, '').trim();
};

const validateSalesPayload = (payload = {}, runtime = {}) => {
    const errors = [];
    const fatalErrors = [];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { isValid: false, errors: ['not_object'], corrections: [], payload: null };
    }

    const decision = payload?.filter_decision && typeof payload.filter_decision === 'object'
        ? payload.filter_decision
        : {};
    if (!payload?.filter_decision) errors.push('missing_filter_decision_rebuilt');

    const combinedRawFilters = [
        ...(Array.isArray(decision?.filters_to_apply) ? decision.filters_to_apply : []),
        ...(Array.isArray(decision?.filters_to_hold_for_later) ? decision.filters_to_hold_for_later : [])
    ];
    if ((decision?.filters_to_hold_for_later || []).length) errors.push('held_filters_moved_to_apply');
    const filters = normalizeFilters(combinedRawFilters, runtime?.activeFacetNames, errors);

    const followup = normalizeFollowup(payload?.followup_question, errors);
    let reply = asShortText(payload?.customer_reply ?? payload?.reply_text ?? payload?.reply, 800);
    reply = removeDuplicatedQuestion(reply, followup.question, errors);
    const replyCheck = validateResponse({ reply_text: reply }, 'sales');
    if (!replyCheck.isValid) {
        fatalErrors.push(...replyCheck.errors);
        reply = '';
    } else {
        reply = replyCheck.safeReply;
    }

    const searchTerm = asShortText(decision?.search_term, 100);
    const inferredSearchReady = filters.length > 0 || !!searchTerm;
    const searchReady = typeof decision?.search_ready === 'boolean' ? decision.search_ready : inferredSearchReady;
    if (typeof decision?.search_ready !== 'boolean') errors.push('search_ready_normalized');

    if (!reply) {
        errors.push('missing_reply_replaced');
        reply = searchReady
            ? 'I’m curating the closest matching options for you.'
            : 'I can help you find the right style.';
    }

    const confidence = CONFIDENCE.has(decision?.confidence) ? decision.confidence : 'medium';
    const sortHint = SORT_HINTS.has(decision?.sort_hint) ? decision.sort_hint : 'relevance';
    const resultStrategy = RESULT_STRATEGIES.has(decision?.result_strategy)
        ? decision.result_strategy
        : (searchReady ? 'balanced_curated' : 'broad_preview');
    if (!CONFIDENCE.has(decision?.confidence)) errors.push('confidence_normalized');
    if (!SORT_HINTS.has(decision?.sort_hint)) errors.push('sort_hint_normalized');
    if (!RESULT_STRATEGIES.has(decision?.result_strategy)) errors.push('result_strategy_normalized');

    const normalized = {
        chat_id: runtime?.chatId || '',
        filter_decision: {
            search_ready: searchReady,
            primary_intent: asShortText(decision?.primary_intent, 160),
            confidence,
            search_term: searchTerm,
            filters_to_apply: filters,
            filters_to_hold_for_later: [],
            sort_hint: sortHint,
            result_strategy: resultStrategy,
            needs_followup: followup.ask,
            followup_reason: followup.ask ? asShortText(decision?.followup_reason, 100) : ''
        },
        customer_reply: reply,
        followup_question: followup
    };

    return {
        isValid: fatalErrors.length === 0,
        errors: [...new Set([...fatalErrors, ...errors])],
        corrections: [...new Set(errors)],
        payload: normalized
    };
};

module.exports = {
    validateSalesPayload,
    normalizeFilters,
    validPriceRange,
    removeDuplicatedQuestion
};
