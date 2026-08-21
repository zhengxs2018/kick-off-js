export declare const auto: boolean;

export declare const TextDecoder: typeof globalThis.TextDecoder;
export declare const TextEncoder: typeof globalThis.TextEncoder;
export declare const ReadableStream: typeof globalThis.ReadableStream;
export declare const TransformStream: typeof globalThis.TransformStream;
export declare const TextDecoderStream: typeof globalThis.TextDecoderStream;
export declare const TextEncoderStream: typeof globalThis.TextEncoderStream;

export interface Shims {
  TextDecoder: typeof globalThis.TextDecoder;
  TextEncoder: typeof globalThis.TextEncoder;
  ReadableStream: typeof globalThis.ReadableStream;
  TransformStream: typeof globalThis.TransformStream;
  TextDecoderStream: typeof globalThis.TextDecoderStream;
  TextEncoderStream: typeof globalThis.TextEncoderStream;
}

export declare function setShims(shims: Shims, options: { auto?: boolean; kind?: string }): void;
