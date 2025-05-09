export let TextDecoder
export let TextEncoder
export let ReadableStream
export let TransformStream
export let TextDecoderStream
export let TextEncoderStream

export let auto = false
export let kind = 'auto'

export function setShims(shims, options) {
  if (auto) {
    throw new Error('Shims have already been set.')
  }

  kind = options.kind || 'auto'
  auto = options.auto || false

  TextDecoder = shims.TextDecoder
  TextEncoder = shims.TextEncoder
  ReadableStream = shims.ReadableStream
  TransformStream = shims.TransformStream
  TextDecoderStream = shims.TextDecoderStream
  TextEncoderStream = shims.TextEncoderStream
}
