// @ts-check
// copyright (c) 2016 Google Inc.
// fork from https://github.com/GoogleChromeLabs/text-encode-transform-polyfill

import { TransformStream } from 'web-streams-polyfill'

// @ts-expect-error
import { TextDecoder, TextEncoder } from 'text-decoding'

const shims = {
  TextDecoder: globalThis.TextDecoder || TextDecoder,
  TextEncoder: globalThis.TextEncoder || TextEncoder,
  TransformStream: globalThis.TransformStream || TransformStream,
}

/**
 * @param {string} [label]
 * @param {TextDecoderOptions} [options]
 * @returns {globalThis.TextDecoderStream}
 */
export function TextDecoderStream(label = undefined, options = undefined) {
  const decoder = new shims.TextDecoder(label, options)
  const transform = new shims.TransformStream(TextDecodeTransformer(decoder))

  return {
    get readable() {
      return transform.readable
    },

    get writable() {
      return transform.writable
    },
    get encoding() {
      return decoder.encoding
    },
    get fatal() {
      return decoder.fatal
    },

    get ignoreBOM() {
      return decoder.ignoreBOM
    },
  }
}

/**
 * @param {globalThis.TextDecoder} decoder
 */
function TextDecodeTransformer(decoder) {
  return {
    /**
     * @param {AllowSharedBufferSource} chunk
     * @param {TransformStreamDefaultController} controller
     */
    transform(chunk, controller) {
      const decoded = decoder.decode(chunk, { stream: true })
      if (decoded != '') {
        controller.enqueue(decoded)
      }
    },

    /**
     *
     * @param {TransformStreamDefaultController} controller
     */
    flush(controller) {
      const output = decoder.decode()
      if (output) controller.enqueue(output)
    },
  }
}

/**
 * @returns {globalThis.TextEncoderStream}
 */
export function TextEncoderStream() {
  const encoder = new shims.TextEncoder()
  const transform = new shims.TransformStream(TextEncodeTransformer(encoder))

  return {
    get encoding() {
      return encoder.encoding
    },
    get readable() {
      return transform.readable
    },

    get writable() {
      return transform.writable
    },
  }
}

/**
 *
 * @param {globalThis.TextEncoder} encoder
 */
function TextEncodeTransformer(encoder) {
  /**
   * @type {string | undefined}
   */
  let carry = undefined

  return {
    /**
     *
     * @param {string} chunk
     * @param {TransformStreamDefaultController} controller
     */
    transform(chunk, controller) {
      chunk = String(chunk)

      if (carry !== undefined) {
        chunk = carry + chunk
        carry = undefined
      }

      const terminalCodeUnit = chunk.charCodeAt(chunk.length - 1)
      if (terminalCodeUnit >= 0xd800 && terminalCodeUnit < 0xdc00) {
        carry = chunk.substring(chunk.length - 1)
        chunk = chunk.substring(0, chunk.length - 1)
      }

      const encoded = encoder.encode(chunk)
      if (encoded.length) {
        controller.enqueue(encoded)
      }
    },
    /**
     * @param {TransformStreamDefaultController} controller
     */
    flush(controller) {
      if (carry !== undefined) {
        controller.enqueue(encoder.encode(carry))
        carry = undefined
      }
    },
  }
}
