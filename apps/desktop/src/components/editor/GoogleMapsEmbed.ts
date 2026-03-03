import { mergeAttributes, Node } from '@tiptap/core'

const GOOGLE_MAPS_EMBED_SRC_PATTERN = /^https:\/\/www\.google\.com\/maps\/embed\?/i

function normalizeMapsSrc(src: string) {
  const trimmed = src.trim()
  if (!GOOGLE_MAPS_EMBED_SRC_PATTERN.test(trimmed)) return null
  return trimmed
}

export function extractGoogleMapsEmbedSrc(raw: string) {
  const iframeMatch = raw.match(
    /<iframe[^>]*\bsrc=(["'])(https:\/\/www\.google\.com\/maps\/embed\?[^"']+)\1[^>]*>/i
  )
  if (iframeMatch?.[2]) return normalizeMapsSrc(iframeMatch[2])

  const urlMatch = raw.match(/https:\/\/www\.google\.com\/maps\/embed\?[^\s"'<>]+/i)
  if (urlMatch?.[0]) return normalizeMapsSrc(urlMatch[0])

  return null
}

export const GoogleMapsEmbed = Node.create({
  name: 'googleMapsEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      width: { default: '100%' },
      height: { default: '450' },
      loading: { default: 'lazy' },
      referrerpolicy: { default: 'no-referrer-when-downgrade' },
      allowfullscreen: { default: '' },
      style: { default: 'border:0;' },
    }
  },

  parseHTML() {
    return [{ tag: 'iframe[src^="https://www.google.com/maps/embed?"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const src = normalizeMapsSrc(String(HTMLAttributes.src ?? ''))
    if (!src) {
      return ['div', { class: 'google-maps-embed-invalid' }, 'Invalid maps embed']
    }
    return ['iframe', mergeAttributes(HTMLAttributes, { src })]
  },
})
