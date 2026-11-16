import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SharpApiApi implements ICredentialType {
	name = 'sharpApiApi';

	displayName = 'SharpAPI API';

	documentationUrl = 'https://sharpapi.com/documentation';

	icon: Icon = { light: 'file:sharpapi.svg', dark: 'file:sharpapi.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'API key generated in the SharpAPI dashboard',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://sharpapi.com/api/v1',
			description: 'Change this only when SharpAPI provided a dedicated endpoint',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
				Accept: 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/ping',
			method: 'GET',
		},
	};
}
