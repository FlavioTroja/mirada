export function createObjectWithoutThrow(value: any, obj: object | []) {
    return value ? obj : {};
}

export function createFullTextQuery(fullTextOperator: FullTextOperator, queryString?: string, isWordSearchPartial?: boolean) {
    const trimmedQueryString = queryString?.trim();
    if (!trimmedQueryString) {
        return "";
    }

    const operator = operatorByFullTextOperatorToString.find((e) => e.fullTextOperator === fullTextOperator)?.value ?? "";

    return trimmedQueryString.replace(/\s+/g, isWordSearchPartial ? `:*${operator}` : operator) + (isWordSearchPartial ? `:*` : '');
}

export enum FullTextOperator {
    AND = "AND",
    OR = "OR",
}

const operatorByFullTextOperatorToString = [
    { fullTextOperator: FullTextOperator.OR, value: "|" },
    { fullTextOperator: FullTextOperator.AND, value: "&" },
];

export function filterByAgentId(agentId: number | undefined) {
    return agentId ? { agentId } : {};
}
