// OpenAI API compatible types
export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OpenAIRequest {
    model: string;
    messages: OpenAIMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stream?: boolean;
    stop?: string | string[];
}

export interface OpenAIChoice {
    index: number;
    message: OpenAIMessage;
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface OpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface OpenAIResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: OpenAIChoice[];
    usage: OpenAIUsage;
}

// Streaming response types
export interface OpenAIStreamChoice {
    index: number;
    delta: {
        role?: 'assistant';
        content?: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
}

export interface OpenAIStreamResponse {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: OpenAIStreamChoice[];
}

// Internal types
export interface QwenConfig {
    port: number;
    qwenUrl: string;
    autoStart: boolean;
    headless: boolean;
}

export interface ServerStatus {
    server: 'running' | 'stopped';
    qwenClient: 'connected' | 'disconnected';
    port: number;
    uptime: number;
}

export interface HealthCheck {
    status: 'ok' | 'error';
    timestamp: string;
    qwenConnected: boolean;
}