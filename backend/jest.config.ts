import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    testTimeout: 15_000,
    // Tests share ONE Postgres instance and a globalThis bridge (see .claude/rules/testing.md).
    // Force serial execution here so the suite is safe from ANY launcher (yarn, WebStorm, IDE),
    // not just when `-i`/`--runInBand` is passed on the CLI. Parallel workers race on truncate+seed
    // (P2002) and lose globalThis.__TEST_APP__ (undefined `.inject`).
    maxWorkers: 1,
    roots: ["<rootDir>/test"],
    testMatch: ["**/*.test.ts"],
    globalSetup: "<rootDir>/test/setup.ts",
    setupFilesAfterEnv: ["<rootDir>/test/setup-after-env.ts"],
    globalTeardown: "<rootDir>/test/teardown.ts",
    moduleNameMapper: {
        "^@utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@repositories/(.*)$": "<rootDir>/src/stack/repositories/$1",
        "^@models/(.*)$": "<rootDir>/src/models/$1",
        "^@services/(.*)$": "<rootDir>/src/stack/services/$1",
        "^@controllers/(.*)$": "<rootDir>/src/stack/controllers/$1",
        "^@routes/(.*)$": "<rootDir>/src/routes/$1",
        "^@middleware/(.*)$": "<rootDir>/src/middleware/$1",
        "^@DTOs/(.*)$": "<rootDir>/src/stack/DTOs/$1",
        "^@transformers/(.*)$": "<rootDir>/src/stack/transformers/$1",
        "^@enums/(.*)$": "<rootDir>/src/stack/enums/$1",
        "^@interfaces/(.*)$": "<rootDir>/src/stack/interfaces/$1",
        "^@websocket/(.*)$": "<rootDir>/src/websocket/$1",
        "^@mail/(.*)$": "<rootDir>/src/mail/$1",
        "^@prisma-gen/(.*)$": "<rootDir>/prisma/generated/$1",
    },
    collectCoverage: true,
    coverageDirectory: "coverage",
    collectCoverageFrom: [
        "src/stack/services/**/*.ts",
        "src/stack/controllers/**/*.ts",
        "src/stack/repositories/**/*.ts",
        "src/utils/**/*.ts",
        "src/stack/transformers/**/*.ts",
    ],
};

export default config;
