export default {
	moduleFileExtensions: ['js', 'json', 'ts'],
	rootDir: 'src',
	testRegex: '.*\\.spec\\.ts$',
	transform: {
		'^.+\\.(t|j)s$': [
			'ts-jest',
			{
				tsconfig: 'tsconfig.spec.json',
				useESM: true,
			},
		],
	},
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	transformIgnorePatterns: ['node_modules/(?!(@ai-sdk|ai|@qdrant|@workflow)/)'],
	collectCoverageFrom: ['**/*.(t|j)s'],
	coverageDirectory: '../coverage',
	testEnvironment: 'node',
};
