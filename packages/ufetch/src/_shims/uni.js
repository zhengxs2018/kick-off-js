import { setShims } from './registry.js'

// #ifdef MP-WEIXIN
import { ReadableStream, TransformStream } from 'web-streams-polyfill'
import { TextDecoder, TextEncoder } from 'text-decoding'

import {
  TextDecoderStream,
  TextEncoderStream,
} from '../_polyfills/text-encode-transform.js'

setShims(
  {
    TextDecoder: globalThis.TextDecoder || TextDecoder,
    TextEncoder: globalThis.TextEncoder || TextEncoder,
    ReadableStream: globalThis.ReadableStream || ReadableStream,
    TransformStream: globalThis.TransformStream || TransformStream,
    TextDecoderStream: globalThis.TextDecoderStream || TextDecoderStream,
    TextEncoderStream: globalThis.TextEncoderStream || TextEncoderStream,
  },
  {
    kind: 'weixin',
  }
)
// #endif
