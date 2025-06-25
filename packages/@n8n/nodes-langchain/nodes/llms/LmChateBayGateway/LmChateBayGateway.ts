/* eslint-disable n8n-nodes-base/node-dirname-against-convention */

import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import { getHttpProxyAgent } from '@utils/httpProxyAgent';
import { getConnectionHintNoticeField } from '@utils/sharedFields';
import { N8nLlmTracing } from '../N8nLlmTracing';
import { makeN8nLlmFailedAttemptHandler } from '../n8nLlmFailedAttemptHandler';
import { openAiFailedAttemptHandler } from '../../vendors/OpenAi/helpers/error-handling';

export class LMChateBayGateway implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'eBay LLM Gateway',
		name: 'lmChateBayGateway',
		icon: 'file:ebay.svg',
		group: ['transform'],
		version: 1,
		description: 'Internal eBay LLM gateway using OpenAI-compatible API',
		defaults: {
			name: 'eBay LLM Gateway',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionTypes.AiChain, NodeConnectionTypes.AiAgent]),
			{
				displayName: 'Model',
				name: 'model',
				type: 'resourceLocator',
				default: { mode: 'id', value: 'hubgpt-chat-completions-4.0' },
				required: true,
				modes: [
					{
						displayName: 'Model ID',
						name: 'id',
						type: 'string',
						placeholder: 'Enter model ID (e.g. hubgpt-chat-completions-4.0)',
					},
				],
				description: 'Enter the model ID provided by your internal gateway',
			},
			{
				displayName: 'Auth Token',
				name: 'authToken',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
				description: 'Bearer token for authorization with the internal LLM gateway',
			},
			{
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: 'https://hubgptgatewaysvc.vip.qa.ebay.com/gateway/v1',
				required: true,
				description:
					'Base URL of the internal LLM API (e.g., https://hubgptgatewaysvc.vip.qa.ebay.com/gateway/v1)',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
					},
					{
						displayName: 'Top P',
						name: 'topP',
						type: 'number',
						default: 1,
						typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 1 },
					},
					{
						displayName: 'Maximum Tokens',
						name: 'maxTokens',
						type: 'number',
						default: 2048,
						typeOptions: { maxValue: 32768 },
					},
					{
						displayName: 'Presence Penalty',
						name: 'presencePenalty',
						type: 'number',
						default: 0,
						typeOptions: { minValue: -2, maxValue: 2, numberPrecision: 1 },
					},
					{
						displayName: 'Frequency Penalty',
						name: 'frequencyPenalty',
						type: 'number',
						default: 0,
						typeOptions: { minValue: -2, maxValue: 2, numberPrecision: 1 },
					},
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						default: 60000,
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						type: 'number',
						default: 2,
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						type: 'options',
						default: 'text',
						options: [
							{ name: 'Text', value: 'text' },
							{ name: 'JSON Object', value: 'json_object' },
						],
					},
					{
						displayName: 'Reasoning Effort',
						name: 'reasoningEffort',
						type: 'options',
						default: 'medium',
						options: [
							{ name: 'Low', value: 'low' },
							{ name: 'Medium', value: 'medium' },
							{ name: 'High', value: 'high' },
						],
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const model = this.getNodeParameter('model.value', itemIndex) as string;
		const baseURL = this.getNodeParameter('baseUrl', itemIndex) as string;
		const authToken = this.getNodeParameter('authToken', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as Record<string, unknown>;

		const modelKwargs: Record<string, unknown> = {};
		if (options.responseFormat) modelKwargs.response_format = { type: options.responseFormat };
		if (options.reasoningEffort) modelKwargs.reasoning_effort = options.reasoningEffort;

		const configuration: ClientOptions = {
			httpAgent: getHttpProxyAgent(),
			baseURL,
		};

		const chatModel = new ChatOpenAI({
			openAIApiKey: authToken,
			modelName: model,
			...options,
			timeout: options.timeout ?? 60000,
			maxRetries: options.maxRetries ?? 2,
			configuration,
			modelKwargs,
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this, openAiFailedAttemptHandler),
		});

		return {
			response: chatModel,
		};
	}
}
