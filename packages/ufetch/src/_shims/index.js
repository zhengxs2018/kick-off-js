import {
  kind,
  setShims,
  TextDecoder,
  TextEncoder,
  ReadableStream,
  TransformStream,
  TextDecoderStream,
  TextEncoderStream,
} from './registry.js';

if (!kind) {
  setShims(globalThis, { auto: true });
}

export {
  TextDecoder,
  TextEncoder,
  ReadableStream,
  TransformStream,
  TextDecoderStream,
  TextEncoderStream,
};
