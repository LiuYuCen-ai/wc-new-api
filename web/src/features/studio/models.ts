/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export type StudioSizeOption = {
  value: string
  label: string
  hint: string
}

export type StudioModelKind = 'image' | 'video'

export type StudioModel = {
  /** Route slug used in /studio/$model. URL-safe. */
  slug: string
  /** Upstream model id sent to the API (kept verbatim). */
  id: string
  /** Display name, includes the specific version. */
  label: string
  /** Brand/vendor name, not translated. */
  vendor: string
  /** Whether this is an image or a video model. */
  kind: StudioModelKind
  /** Capability tag rendered as a badge on the gallery card. */
  tag: string
  /** Short description shown on the card and the generation page. */
  description: string
  /** Default template prompt for the generation page. */
  defaultPrompt: string
  /** Cover image shown on the gallery card. Replace later with your own. */
  cover: string
  /** Render a NEW badge on the card cover. */
  isNew?: boolean
}

// Local cover images bundled under web/public/landing/experience.
// Referenced via absolute public paths; the browser encodes spaces/CJK.
const EXPERIENCE_COVERS: string[] = [
  '/landing/experience/下载.png',
  '/landing/experience/下载 (1).png',
  '/landing/experience/下载 (2).png',
  '/landing/experience/下载 (3).png',
  '/landing/experience/下载 (4).png',
  '/landing/experience/下载 (5).png',
  '/landing/experience/下载 (6).png',
  '/landing/experience/下载 (7).png',
  '/landing/experience/下载 (8).png',
  '/landing/experience/下载 (9).png',
  '/landing/experience/下载 (10).png',
  '/landing/experience/下载 (11).png',
  '/landing/experience/下载 (12).png',
  '/landing/experience/下载 (13).png',
  '/landing/experience/下载 (14).png',
  '/landing/experience/下载 (15).png',
  '/landing/experience/下载 (16).png',
  '/landing/experience/下载 (17).png',
  '/landing/experience/下载 (18).png',
  '/landing/experience/下载 (19).png',
  '/landing/experience/下载 (20).png',
  '/landing/experience/下载 (21).png',
  '/landing/experience/下载 (22).png',
]

// Assigns local cover images in declaration order, cycling through the
// available files. The `prompt`/`size` args are ignored and kept only so the
// per-model call sites below stay unchanged.
let coverCursor = 0
function coverImage(_prompt: string, _size = 'landscape_4_3'): string {
  const src = EXPERIENCE_COVERS[coverCursor % EXPERIENCE_COVERS.length]
  coverCursor += 1
  return src
}

// Model IDs use official/standard upstream names. Adjust the `id` fields here
// if your channels are configured with different model names.
export const STUDIO_MODELS: StudioModel[] = [
  // ---------------------------------------------------------------- Image
  {
    slug: 'gpt-image-2',
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    vendor: 'OpenAI',
    kind: 'image',
    tag: 'Text to Image',
    description:
      "OpenAI's flagship image model. Best-in-class prompt understanding, photorealism and text rendering.",
    defaultPrompt:
      'A cinematic photo of a golden retriever puppy sitting on a beach at sunset, warm lighting, ultra detailed, 8k',
    cover: coverImage(
      'A cinematic photo of a golden retriever puppy sitting on a beach at sunset, warm cinematic lighting, ultra detailed, 8k'
    ),
    isNew: true,
  },
  {
    slug: 'gpt-image-1',
    id: 'gpt-image-1',
    label: 'GPT Image 1',
    vendor: 'OpenAI',
    kind: 'image',
    tag: 'Text to Image',
    description:
      "OpenAI's first dedicated image model. Solid all-round generation and editing.",
    defaultPrompt:
      'A cozy reading nook by a large window on a rainy day, warm lamp light, books and a cup of tea, soft focus, ultra detailed',
    cover: coverImage(
      'A cozy reading nook by a large window on a rainy day, warm lamp light, books and a cup of tea, soft focus, ultra detailed'
    ),
  },
  {
    slug: 'nano-banana-pro',
    id: 'gemini-3-pro-image',
    label: 'Nano Banana Pro',
    vendor: 'Google',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Gemini 3 Pro Image. Reasoning-based prompting, native 2K/4K output, multilingual text.',
    defaultPrompt:
      'A luxurious modern living room interior, floor to ceiling windows, natural sunlight, soft shadows, architectural photography, ultra detailed, 8k',
    cover: coverImage(
      'A luxurious modern living room interior, floor to ceiling windows, natural sunlight, architectural photography, ultra detailed, 8k'
    ),
  },
  {
    slug: 'nano-banana-2',
    id: 'gemini-3.1-flash-image',
    label: 'Nano Banana 2',
    vendor: 'Google',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Gemini 3.1 Flash Image. Fast and cost efficient with near-Pro quality and multi-image blending.',
    defaultPrompt:
      'A cute cartoon banana character wearing sunglasses, vibrant colors, flat illustration style, clean background',
    cover: coverImage(
      'A cute cartoon banana character wearing sunglasses, vibrant colors, flat illustration style, clean background'
    ),
    isNew: true,
  },
  {
    slug: 'nano-banana',
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    vendor: 'Google',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Gemini 2.5 Flash Image. The original viral hit for fast, consistent image editing.',
    defaultPrompt:
      'A flat lay of a stylish travel essentials kit on a beige background, passport, sunglasses, camera, soft daylight, minimal aesthetic',
    cover: coverImage(
      'A flat lay of a stylish travel essentials kit on a beige background, passport, sunglasses, camera, soft daylight, minimal aesthetic'
    ),
  },
  {
    slug: 'imagen-4',
    id: 'imagen-4',
    label: 'Imagen 4',
    vendor: 'Google',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Google Imagen 4. Photorealistic detail, fast output and a generous free tier.',
    defaultPrompt:
      'Macro photo of a dewdrop on a green leaf reflecting a forest, morning light, extreme detail, shallow depth of field',
    cover: coverImage(
      'Macro photo of a dewdrop on a green leaf reflecting a forest, morning light, extreme detail, shallow depth of field'
    ),
  },
  {
    slug: 'midjourney-v8-1',
    id: 'midjourney',
    label: 'Midjourney V8.1',
    vendor: 'Midjourney',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Highly artistic, stylized visuals with a distinctive aesthetic. The gold standard for art.',
    defaultPrompt:
      'Cyberpunk megacity at night, heavy rain, neon lights reflecting on wet streets, dense futuristic skyscrapers, cinematic composition, volumetric lighting, cyberpunk aesthetic',
    cover: coverImage(
      'Cyberpunk megacity at night, heavy rain, neon lights reflecting on wet streets, dense futuristic skyscrapers, cinematic composition, volumetric lighting'
    ),
  },
  {
    slug: 'flux-2-pro',
    id: 'flux.2-pro',
    label: 'FLUX.2 Pro',
    vendor: 'Black Forest Labs',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Top open-weights model. Excellent photorealism and product shots at low cost.',
    defaultPrompt:
      'Studio product photo of a premium wireless headphone on a marble surface, soft gradient background, softbox lighting, commercial photography, ultra detailed, 8k',
    cover: coverImage(
      'Studio product photo of a premium wireless headphone on a marble surface, soft gradient background, softbox lighting, commercial photography, ultra detailed, 8k'
    ),
    isNew: true,
  },
  {
    slug: 'flux-1-1-pro',
    id: 'flux-1.1-pro',
    label: 'FLUX 1.1 Pro',
    vendor: 'Black Forest Labs',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Fast, high quality generation. A proven workhorse for realistic imagery.',
    defaultPrompt:
      'A portrait of a fisherman mending nets at dawn on a misty harbor, documentary photography, natural light, ultra detailed',
    cover: coverImage(
      'A portrait of a fisherman mending nets at dawn on a misty harbor, documentary photography, natural light, ultra detailed'
    ),
  },
  {
    slug: 'ideogram-3',
    id: 'ideogram-v3',
    label: 'Ideogram 3.0',
    vendor: 'Ideogram',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'The most accurate text, typography and logo rendering inside images.',
    defaultPrompt:
      'A modern coffee shop poster with the bold text "MORNING BREW", warm color palette, clean typography, minimal flat design, high quality',
    cover: coverImage(
      'A modern coffee shop poster with bold typography, warm color palette, clean minimal flat design, high quality'
    ),
  },
  {
    slug: 'recraft-v4',
    id: 'recraft-v4',
    label: 'Recraft V4',
    vendor: 'Recraft',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Design-focused model. True editable SVG output for vector art and brand design.',
    defaultPrompt:
      'A clean flat vector illustration of a mountain landscape at sunrise, simple geometric shapes, brand style, minimal color palette',
    cover: coverImage(
      'A clean flat vector illustration of a mountain landscape at sunrise, simple geometric shapes, minimal color palette'
    ),
  },
  {
    slug: 'sd-3-5-large',
    id: 'sd3.5-large',
    label: 'SD 3.5 Large',
    vendor: 'Stability AI',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Open source flagship. Run locally with full control and a rich ecosystem.',
    defaultPrompt:
      'A whimsical treehouse village in an ancient forest, rope bridges, lanterns glowing at dusk, fantasy illustration, ultra detailed',
    cover: coverImage(
      'A whimsical treehouse village in an ancient forest, rope bridges, lanterns glowing at dusk, fantasy illustration, ultra detailed'
    ),
  },
  {
    slug: 'qwen-image-3',
    id: 'qwen-image-3.0',
    label: 'Qwen-Image 3.0',
    vendor: 'Alibaba',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Top-tier complex Chinese and English text rendering, unified generation and editing.',
    defaultPrompt:
      'A traditional Chinese ink painting of misty mountains and a river, elegant calligraphy in the corner, poetic atmosphere, ultra detailed, high quality',
    cover: coverImage(
      'A traditional Chinese ink painting of misty mountains and a river, poetic atmosphere, ultra detailed, high quality'
    ),
    isNew: true,
  },
  {
    slug: 'seedream-5-pro',
    id: 'doubao-seedream-5-0-pro-260628',
    label: 'Seedream 5.0 Pro',
    vendor: 'ByteDance',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Native 4K, layer-level editing and 99% text accuracy for commercial design.',
    defaultPrompt:
      'A futuristic city poster with cyberpunk vibe, neon lights, 4K ultra high resolution, cinematic lighting, dynamic composition',
    cover: coverImage(
      'A futuristic city poster with cyberpunk vibe, neon lights, 4K ultra high resolution, cinematic lighting, dynamic composition'
    ),
    isNew: true,
  },
  {
    slug: 'seedream-4',
    id: 'doubao-seedream-4-0-250828',
    label: 'Seedream 4.0',
    vendor: 'ByteDance',
    kind: 'image',
    tag: 'Text to Image',
    description:
      'Native 4K output, strong subject consistency and multi-image fusion in seconds.',
    defaultPrompt:
      'A Q-version 3D figurine of a ginger cat in a transparent display case on a desk, professional studio lighting, product photography',
    cover: coverImage(
      'A Q-version 3D figurine of a ginger cat in a transparent display case on a desk, professional studio lighting, product photography'
    ),
  },
  {
    slug: 'hunyuan-image-3',
    id: 'hunyuan-image-3.0',
    label: 'Hunyuan Image 3.0',
    vendor: 'Tencent',
    kind: 'image',
    tag: 'Text to Image',
    description:
      "Tencent's open source image model. Strong Chinese aesthetics and prompt alignment.",
    defaultPrompt:
      'A majestic Chinese palace in the clouds at sunrise, golden rooftops, cranes flying, guofeng illustration style, ultra detailed',
    cover: coverImage(
      'A majestic Chinese palace in the clouds at sunrise, golden rooftops, cranes flying, guofeng illustration style, ultra detailed'
    ),
  },

  // ---------------------------------------------------------------- Video
  {
    slug: 'sora-2',
    id: 'sora-2',
    label: 'Sora 2',
    vendor: 'OpenAI',
    kind: 'video',
    tag: 'Text to Video',
    description:
      "OpenAI's flagship video model. Cinematic realism with synced audio and strong physics.",
    defaultPrompt:
      'A hot air balloon festival at sunrise over a valley, dozens of colorful balloons rising, cinematic drone shot, soft morning light',
    cover: coverImage(
      'A hot air balloon festival at sunrise over a valley, dozens of colorful balloons rising, cinematic drone shot, soft morning light',
      'landscape_16_9'
    ),
  },
  {
    slug: 'sora-2-pro',
    id: 'sora-2-pro',
    label: 'Sora 2 Pro',
    vendor: 'OpenAI',
    kind: 'video',
    tag: 'Text to Video',
    description:
      "Longer, higher fidelity clips with precise camera control. OpenAI's pro tier.",
    defaultPrompt:
      'A lone astronaut walking through a glowing alien jungle at night, bioluminescent plants, cinematic slow dolly shot, volumetric fog',
    cover: coverImage(
      'A lone astronaut walking through a glowing alien jungle at night, bioluminescent plants, cinematic slow dolly shot, volumetric fog',
      'landscape_16_9'
    ),
    isNew: true,
  },
  {
    slug: 'veo-3-1',
    id: 'veo-3.1',
    label: 'Veo 3.1',
    vendor: 'Google',
    kind: 'video',
    tag: 'Text to Video',
    description:
      "Google DeepMind's latest. Native audio, 1080p output and strong prompt adherence.",
    defaultPrompt:
      'A chef flambeing a dessert in a dark restaurant kitchen, flames rising in slow motion, cinematic close-up, shallow depth of field',
    cover: coverImage(
      'A chef flambeing a dessert in a dark restaurant kitchen, flames rising in slow motion, cinematic close-up, shallow depth of field',
      'landscape_16_9'
    ),
    isNew: true,
  },
  {
    slug: 'veo-3-1-fast',
    id: 'veo-3.1-fast',
    label: 'Veo 3.1 Fast',
    vendor: 'Google',
    kind: 'video',
    tag: 'Text to Video',
    description:
      'Lower latency and cost. Great for rapid iteration with audio support.',
    defaultPrompt:
      'A surfer riding a turquoise wave at golden hour, water spray sparkling, dynamic tracking shot, cinematic',
    cover: coverImage(
      'A surfer riding a turquoise wave at golden hour, water spray sparkling, dynamic tracking shot, cinematic',
      'landscape_16_9'
    ),
  },
  {
    slug: 'seedance-2-5-pro',
    id: 'doubao-seedance-2-5-pro',
    label: 'Seedance 2.5 Pro',
    vendor: 'ByteDance',
    kind: 'video',
    tag: 'Text to Video',
    description:
      "ByteDance's newest video model. Reference-to-video, native audio and editing.",
    defaultPrompt:
      'A medieval knight walking out of a castle gate at dawn, banners waving, epic wide shot, cinematic atmosphere',
    cover: coverImage(
      'A medieval knight walking out of a castle gate at dawn, banners waving, epic wide shot, cinematic atmosphere',
      'landscape_16_9'
    ),
    isNew: true,
  },
  {
    slug: 'seedance-1-pro',
    id: 'doubao-seedance-1-0-pro-250528',
    label: 'Seedance 1.0 Pro',
    vendor: 'ByteDance',
    kind: 'video',
    tag: 'Text to Video',
    description:
      'Multi-shot storytelling with smooth motion and strong consistency.',
    defaultPrompt:
      'A paper boat floating down a rain-soaked city street at night, neon reflections, gentle camera follow, cinematic mood',
    cover: coverImage(
      'A paper boat floating down a rain-soaked city street at night, neon reflections, gentle camera follow, cinematic mood',
      'landscape_16_9'
    ),
  },
  {
    slug: 'kling-2-5-turbo',
    id: 'kling-v2-5-turbo',
    label: 'Kling 2.5 Turbo',
    vendor: 'Kuaishou',
    kind: 'video',
    tag: 'Text to Video',
    description:
      'Fast, high quality clips with excellent motion and prompt adherence.',
    defaultPrompt:
      'A cheetah sprinting across the savanna at sunset, dust kicking up, high speed tracking shot, cinematic wildlife footage',
    cover: coverImage(
      'A cheetah sprinting across the savanna at sunset, dust kicking up, high speed tracking shot, cinematic wildlife footage',
      'landscape_16_9'
    ),
  },
  {
    slug: 'kling-2-1-master',
    id: 'kling-v2-1-master',
    label: 'Kling 2.1 Master',
    vendor: 'Kuaishou',
    kind: 'video',
    tag: 'Text to Video',
    description: 'Premium tier with cinematic camera work and fine detail.',
    defaultPrompt:
      'A ballerina performing a slow pirouette on a rooftop at dusk, city lights bokeh, cinematic slow motion',
    cover: coverImage(
      'A ballerina performing a slow pirouette on a rooftop at dusk, city lights bokeh, cinematic slow motion',
      'landscape_16_9'
    ),
  },
  {
    slug: 'hailuo-2-3',
    id: 'minimax-hailuo-2.3',
    label: 'Hailuo 2.3',
    vendor: 'MiniMax',
    kind: 'video',
    tag: 'Text to Video',
    description:
      'Strong subject reference and stylized looks at a friendly price.',
    defaultPrompt:
      'A fluffy cat astronaut floating inside a space station, paws reaching for floating fish treats, playful cinematic shot',
    cover: coverImage(
      'A fluffy cat astronaut floating inside a space station, paws reaching for floating fish treats, playful cinematic shot',
      'landscape_16_9'
    ),
    isNew: true,
  },
  {
    slug: 'wan-2-5',
    id: 'wan2.5-t2v-preview',
    label: 'Wan 2.5',
    vendor: 'Alibaba',
    kind: 'video',
    tag: 'Text to Video',
    description:
      "Alibaba's latest. Audio-visual sync and multilingual prompt support.",
    defaultPrompt:
      'A dragon boat racing through misty river waters at dawn, paddles splashing in rhythm, cinematic aerial shot',
    cover: coverImage(
      'A dragon boat racing through misty river waters at dawn, paddles splashing in rhythm, cinematic aerial shot',
      'landscape_16_9'
    ),
    isNew: true,
  },
  {
    slug: 'wan-2-2',
    id: 'wan2.2-t2v-plus',
    label: 'Wan 2.2',
    vendor: 'Alibaba',
    kind: 'video',
    tag: 'Text to Video',
    description:
      'Open source MoE video model with cinematic lighting control.',
    defaultPrompt:
      'Lanterns rising into the night sky over an ancient Chinese town, warm glow reflections on the river, cinematic wide shot',
    cover: coverImage(
      'Lanterns rising into the night sky over an ancient Chinese town, warm glow reflections on the river, cinematic wide shot',
      'landscape_16_9'
    ),
  },
  {
    slug: 'vidu-q1',
    id: 'vidu-q1',
    label: 'Vidu Q1',
    vendor: 'Shengshu',
    kind: 'video',
    tag: 'Text to Video',
    description:
      'Fast generation with strong anime and reference-to-video support.',
    defaultPrompt:
      'An anime girl with silver hair standing on a train platform as sakura petals fall, train arriving with wind gust, makoto shinkai style',
    cover: coverImage(
      'An anime girl with silver hair standing on a train platform as sakura petals fall, train arriving with wind gust, makoto shinkai style',
      'landscape_16_9'
    ),
  },
  {
    slug: 'runway-gen-4-turbo',
    id: 'gen4_turbo',
    label: 'Gen-4 Turbo',
    vendor: 'Runway',
    kind: 'video',
    tag: 'Text to Video',
    description:
      'Industry-standard creative suite with fast, controllable output.',
    defaultPrompt:
      'A fashion model walking through a brutalist concrete space, fabric flowing in wind, editorial cinematic slow motion',
    cover: coverImage(
      'A fashion model walking through a brutalist concrete space, fabric flowing in wind, editorial cinematic slow motion',
      'landscape_16_9'
    ),
  },
  {
    slug: 'pika-2-2',
    id: 'pika-2.2',
    label: 'Pika 2.2',
    vendor: 'Pika',
    kind: 'video',
    tag: 'Text to Video',
    description:
      'Fun, fast clips with Pikaffects and ingredient-based editing.',
    defaultPrompt:
      'A stack of pancakes inflating like a balloon then gently deflating, playful food video, bright studio lighting',
    cover: coverImage(
      'A stack of pancakes inflating like a balloon then gently deflating, playful food video, bright studio lighting',
      'landscape_16_9'
    ),
  },
  {
    slug: 'luma-ray-2',
    id: 'ray-2',
    label: 'Luma Ray 2',
    vendor: 'Luma',
    kind: 'video',
    tag: 'Text to Video',
    description:
      'Smooth, realistic motion with strong camera control. Dream Machine engine.',
    defaultPrompt:
      'A vintage car driving along a coastal cliff road at sunset, ocean waves crashing below, cinematic aerial follow shot',
    cover: coverImage(
      'A vintage car driving along a coastal cliff road at sunset, ocean waves crashing below, cinematic aerial follow shot',
      'landscape_16_9'
    ),
  },
  {
    slug: 'pixverse-v5',
    id: 'pixverse-v5',
    label: 'PixVerse V5',
    vendor: 'PixVerse',
    kind: 'video',
    tag: 'Text to Video',
    description:
      'Trending effects and templates for fast, social-ready clips.',
    defaultPrompt:
      'A couple dancing under falling confetti at a night festival, colorful lights, energetic camera movement, social media style',
    cover: coverImage(
      'A couple dancing under falling confetti at a night festival, colorful lights, energetic camera movement, social media style',
      'landscape_16_9'
    ),
  },
  {
    slug: 'grok-imagine-1',
    id: 'grok-imagine-1.0-video',
    label: 'Grok Imagine 1.0',
    vendor: 'xAI',
    kind: 'video',
    tag: 'Text to Video',
    description:
      "xAI's video model. Fast text and image to video with a bold style.",
    defaultPrompt:
      'A rocket launching through clouds at dawn, camera chasing the ascent, dramatic lighting, epic cinematic shot',
    cover: coverImage(
      'A rocket launching through clouds at dawn, camera chasing the ascent, dramatic lighting, epic cinematic shot',
      'landscape_16_9'
    ),
  },
]

export const SIZE_OPTIONS: StudioSizeOption[] = [
  { value: '1024x1024', label: '1:1', hint: '1024×1024' },
  { value: '1024x1536', label: '2:3', hint: '1024×1536' },
  { value: '1536x1024', label: '3:2', hint: '1536×1024' },
]

export function getStudioModelBySlug(slug: string): StudioModel | undefined {
  return STUDIO_MODELS.find((m) => m.slug === slug)
}

export function getStudioModelsByKind(kind: StudioModelKind): StudioModel[] {
  return STUDIO_MODELS.filter((m) => m.kind === kind)
}
