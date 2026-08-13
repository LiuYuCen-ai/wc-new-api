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

// 首页模型轮播的默认 JSON 配置。
// 系统设置里对应配置为空时，首页和系统设置编辑框都会使用这份默认值。

// 中文（模型轮播）默认配置
export const DEFAULT_MODEL_CAROUSEL_CONTENT = JSON.stringify(
  {
    slides: [
      {
        name: 'GPT-5.6-sol',
        description:
          'ChatGPT API 为开发者提供 OpenAI 模型家族的接入能力，覆盖旗舰推理模型、轻量快速模型和原生图像生成。OpenAI 模型以通用能力强、工具调用稳定、结构化输出成熟而著称，适合聊天产品、智能体和创意工作流。',
        models: ['gpt-image-2', 'gpt-5.6-sol', 'gpt-5.6-luna'],
      },
      {
        name: 'Gemini-3.5-flash',
        description:
          'Gemini API 将 Google DeepMind 模型家族带给开发者。Gemini 原生支持多模态，能够理解文本、图片、音频和视频，并支持超长上下文，适合分析大文档和代码库。产品线覆盖深度推理的 Pro 模型与低延迟的 Flash 模型，在能力、速度和成本之间保持平衡。',
        models: [
          'gemini-3-pro-image-preview',
          'gemini-3.1-flash-lite-image',
          'gemini-3.5-flash',
        ],
      },
      {
        name: 'Grok-imagine',
        description:
          'Grok API 提供 xAI 模型家族的接入。Grok 模型将强推理和编程能力与来自 X 平台的实时信息结合起来，能够跟进快速变化的热点话题。除聊天外，产品线还包含用于图像和视频生成的 Grok Imagine，整体风格直接、对话感强。',
        models: ['grok-imagine--video', 'grok-imageine-video-1.5-preview', ''],
      },
      {
        name: 'Claude-fable-5',
        description:
          'Claude API 提供 Anthropic 模型家族的接入。Claude 在复杂推理、软件工程和智能体工作流方面表现突出，擅长长上下文文档和代码库分析，输出清晰可靠，并强调安全性与稳定性，适合对质量要求较高的实际业务。',
        models: ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5'],
      },
      {
        name: 'DeepSeek-v4-pro',
        description:
          'DeepSeek API 提供 DeepSeek AI 的开源权重模型家族。其高效的 Mixture-of-Experts 架构带来接近前沿水平的推理、数学和编程能力，同时保持较低成本，适合生产环境和高吞吐、成本敏感型应用。',
        models: ['DeepSeek-v4-flash', 'DeepSeek-v4-pro', 'DeepSeek-v3.2'],
      },
      {
        name: 'MiniMax-M3',
        description:
          'MiniMax API 提供 MiniMax AI 的多模态模型家族。文本模型在长上下文理解、智能体能力和工具调用方面表现均衡，成本也较有竞争力；同时还覆盖拟真语音合成和视频生成，适合内容创作、语音应用和交互式体验。',
        models: ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed'],
      },
      {
        name: 'GLM-5.2',
        description:
          'GLM API 为开发者带来智谱 AI 模型家族，是领先的中英双语模型之一，并提供开源权重版本。GLM 在编程、推理和智能体工具使用方面表现突出，兼顾效果与成本，适合客服、代码助手和自动化工作流等场景。',
        models: ['glm-5.2', 'glm-5.1', 'glm-5-turbo'],
      },
    ],
  },
  null,
  2
)

// 多语言（模型多语言）默认配置，覆盖站点全部支持语言
export const DEFAULT_MODEL_CAROUSEL_I18N_CONTENT = JSON.stringify(
  {
    slides: [
      {
        name: {
          en: 'GPT-5.6-sol',
          zhCN: 'GPT-5.6-sol',
          fr: 'GPT-5.6-sol',
          ru: 'GPT-5.6-sol',
          ja: 'GPT-5.6-sol',
          vi: 'GPT-5.6-sol',
          zhTW: 'GPT-5.6-sol',
        },
        description: {
          en: 'The ChatGPT API gives developers access to the OpenAI model family, spanning flagship reasoning models, fast lightweight variants, and native image generation. OpenAI models are known for strong general-purpose capability, reliable tool calling and structured output, and a mature ecosystem, making them a dependable choice for chat products, agents, and creative workflows.',
          zhCN: 'ChatGPT API 为开发者提供 OpenAI 模型家族的接入能力，覆盖旗舰推理模型、轻量快速模型和原生图像生成。OpenAI 模型以通用能力强、工具调用稳定、结构化输出成熟而著称，适合聊天产品、智能体和创意工作流。',
          fr: 'L’API ChatGPT donne accès à la famille de modèles OpenAI, allant des modèles de raisonnement phares aux variantes légères et rapides, ainsi qu’à la génération d’images native. Les modèles OpenAI sont réputés pour leurs performances générales, leur fiabilité dans l’appel d’outils et les sorties structurées, ainsi que pour leur écosystème mature.',
          ru: 'API ChatGPT предоставляет разработчикам доступ к семейству моделей OpenAI: от флагманских моделей рассуждений до быстрых облегчённых вариантов и встроенной генерации изображений. Модели OpenAI известны сильными универсальными возможностями, стабильным вызовом инструментов и зрелой экосистемой.',
          ja: 'ChatGPT API は、OpenAI モデルファミリーへのアクセスを提供します。フラッグシップの推論モデル、高速な軽量版、ネイティブな画像生成まで幅広く対応し、汎用性能、安定したツール呼び出し、構造化出力、成熟したエコシステムが特長です。',
          vi: 'API ChatGPT cung cấp quyền truy cập vào họ mô hình OpenAI, bao gồm các mô hình suy luận chủ lực, biến thể nhẹ tốc độ cao và tạo ảnh gốc. Mô hình OpenAI nổi bật với năng lực tổng quát mạnh, gọi công cụ ổn định và hệ sinh thái trưởng thành.',
          zhTW: 'ChatGPT API 為開發者提供 OpenAI 模型家族的接入能力，涵蓋旗艦推理模型、輕量快速模型與原生圖像生成。OpenAI 模型以通用能力強、工具呼叫穩定、結構化輸出成熟而著稱。',
        },
        models: ['gpt-image-2', 'gpt-5.6-sol', 'gpt-5.6-luna'],
      },
      {
        name: {
          en: 'Gemini-3.5-flash',
          zhCN: 'Gemini-3.5-flash',
          fr: 'Gemini-3.5-flash',
          ru: 'Gemini-3.5-flash',
          ja: 'Gemini-3.5-flash',
          vi: 'Gemini-3.5-flash',
          zhTW: 'Gemini-3.5-flash',
        },
        description: {
          en: 'The Gemini API brings the Google DeepMind model family to developers. Natively multimodal, Gemini understands text, images, audio, and video in a single model and supports ultra-long context windows for analyzing large documents and codebases. The lineup ranges from deep-reasoning Pro models to low-latency Flash tiers, balancing capability, speed, and cost.',
          zhCN: 'Gemini API 将 Google DeepMind 模型家族带给开发者。Gemini 原生支持多模态，能够理解文本、图片、音频和视频，并支持超长上下文，适合分析大文档和代码库。产品线覆盖深度推理的 Pro 模型与低延迟的 Flash 模型，在能力、速度和成本之间保持平衡。',
          fr: 'L’API Gemini apporte la famille de modèles Google DeepMind aux développeurs. Nativement multimodal, Gemini comprend le texte, les images, l’audio et la vidéo dans un seul modèle, avec des fenêtres de contexte très longues.',
          ru: 'API Gemini открывает разработчикам доступ к семейству моделей Google DeepMind. Gemini изначально мультимодален, понимает текст, изображения, аудио и видео в одной модели и поддерживает очень длинный контекст.',
          ja: 'Gemini API は Google DeepMind のモデルファミリーを開発者に提供します。Gemini はネイティブなマルチモーダル対応で、テキスト、画像、音声、動画を 1 つのモデルで理解し、非常に長いコンテキストも扱えます。',
          vi: 'API Gemini mang họ mô hình Google DeepMind đến với nhà phát triển. Gemini hỗ trợ đa phương thức nguyên bản, hiểu văn bản, hình ảnh, âm thanh và video trong một mô hình duy nhất, đồng thời hỗ trợ ngữ cảnh rất dài.',
          zhTW: 'Gemini API 將 Google DeepMind 模型家族帶給開發者。Gemini 原生支援多模態，能理解文字、圖片、音訊與影片，並支援超長上下文。',
        },
        models: [
          'gemini-3-pro-image-preview',
          'gemini-3.1-flash-lite-image',
          'gemini-3.5-flash',
        ],
      },
      {
        name: {
          en: 'Grok-imagine',
          zhCN: 'Grok-imagine',
          fr: 'Grok-imagine',
          ru: 'Grok-imagine',
          ja: 'Grok-imagine',
          vi: 'Grok-imagine',
          zhTW: 'Grok-imagine',
        },
        description: {
          en: 'The Grok API provides access to the xAI model family. Grok models combine strong reasoning and coding ability with real-time knowledge drawn from the X platform, keeping answers current on fast-moving topics. Beyond chat, the lineup includes Grok Imagine for image and video generation, and the models are known for a direct, conversational style.',
          zhCN: 'Grok API 提供 xAI 模型家族的接入。Grok 模型将强推理和编程能力与来自 X 平台的实时信息结合起来，能够跟进快速变化的热点话题。除聊天外，产品线还包含用于图像和视频生成的 Grok Imagine，整体风格直接、对话感强。',
          fr: 'L’API Grok fournit un accès à la famille de modèles xAI. Les modèles Grok combinent de solides capacités de raisonnement et de code avec des connaissances en temps réel issues de la plateforme X.',
          ru: 'API Grok предоставляет доступ к семейству моделей xAI. Модели Grok сочетают сильные способности к рассуждению и программированию с данными в реальном времени с платформы X.',
          ja: 'Grok API は xAI モデルファミリーへのアクセスを提供します。Grok モデルは強い推論力とコーディング能力に加え、X プラットフォーム由来のリアルタイム知識を組み合わせ、変化の速い話題にも対応します。',
          vi: 'API Grok cung cấp quyền truy cập vào họ mô hình xAI. Mô hình Grok kết hợp khả năng suy luận và lập trình mạnh với tri thức thời gian thực từ nền tảng X.',
          zhTW: 'Grok API 提供 xAI 模型家族的接入。Grok 模型將強推理與編程能力結合來自 X 平台的即時資訊。',
        },
        models: ['grok-imagine--video', 'grok-imageine-video-1.5-preview', ''],
      },
      {
        name: {
          en: 'Claude-fable-5',
          zhCN: 'Claude-fable-5',
          fr: 'Claude-fable-5',
          ru: 'Claude-fable-5',
          ja: 'Claude-fable-5',
          vi: 'Claude-fable-5',
          zhTW: 'Claude-fable-5',
        },
        description: {
          en: 'The Claude API offers the Anthropic model family, widely regarded as a leader in complex reasoning, software engineering, and agentic workflows. Claude models excel at long-context analysis of large documents and codebases, produce clear and dependable writing, and are built with a strong emphasis on safety and reliability, with tiers trading peak capability against speed and cost.',
          zhCN: 'Claude API 提供 Anthropic 模型家族的接入。Claude 在复杂推理、软件工程和智能体工作流方面表现突出，擅长长上下文文档和代码库分析，输出清晰可靠，并强调安全性与稳定性，适合对质量要求较高的实际业务。',
          fr: 'L’API Claude donne accès à la famille de modèles Anthropic, largement reconnue pour le raisonnement complexe, l’ingénierie logicielle et les workflows agentiques.',
          ru: 'API Claude предоставляет доступ к семейству моделей Anthropic, широко известному лидерством в сложных рассуждениях, разработке ПО и агентных сценариях.',
          ja: 'Claude API は Anthropic のモデルファミリーへのアクセスを提供します。Claude は複雑な推論、ソフトウェアエンジニアリング、エージェント型ワークフローで高く評価され、長文やコードベースの分析に強みがあります。',
          vi: 'API Claude cung cấp quyền truy cập vào họ mô hình Anthropic, được đánh giá cao trong suy luận phức tạp, kỹ thuật phần mềm và quy trình tác tử.',
          zhTW: 'Claude API 提供 Anthropic 模型家族的接入。Claude 在複雜推理、軟體工程與智能體工作流方面表現突出。',
        },
        models: ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5'],
      },
      {
        name: {
          en: 'DeepSeek-v4-pro',
          zhCN: 'DeepSeek-v4-pro',
          fr: 'DeepSeek-v4-pro',
          ru: 'DeepSeek-v4-pro',
          ja: 'DeepSeek-v4-pro',
          vi: 'DeepSeek-v4-pro',
          zhTW: 'DeepSeek-v4-pro',
        },
        description: {
          en: 'The DeepSeek API delivers the open-weight model family from DeepSeek AI. Built on an efficient Mixture-of-Experts architecture, DeepSeek models offer frontier-level reasoning, mathematics, and coding performance at a fraction of the typical cost, which has made them a popular choice for production workloads and cost-sensitive, high-volume applications.',
          zhCN: 'DeepSeek API 提供 DeepSeek AI 的开源权重模型家族。其高效的 Mixture-of-Experts 架构带来接近前沿水平的推理、数学和编程能力，同时保持较低成本，适合生产环境和高吞吐、成本敏感型应用。',
          fr: 'L’API DeepSeek fournit la famille de modèles open-weight de DeepSeek AI. Basés sur une architecture Mixture-of-Experts efficace, ces modèles offrent d’excellentes performances à coût réduit.',
          ru: 'API DeepSeek предоставляет семейство open-weight моделей DeepSeek AI. Эффективная архитектура Mixture-of-Experts даёт уровень возможностей, близкий к передовому, при гораздо меньшей стоимости.',
          ja: 'DeepSeek API は DeepSeek AI のオープンウェイトモデルファミリーを提供します。効率的な Mixture-of-Experts アーキテクチャにより、高い推論・数学・コーディング性能を低コストで実現します。',
          vi: 'API DeepSeek cung cấp họ mô hình open-weight từ DeepSeek AI. Kiến trúc Mixture-of-Experts hiệu quả mang lại năng lực suy luận, toán học và lập trình ở mức cao với chi phí thấp.',
          zhTW: 'DeepSeek API 提供 DeepSeek AI 的開源權重模型家族。其高效的 Mixture-of-Experts 架構帶來接近前沿水平的能力，同時保持較低成本。',
        },
        models: ['DeepSeek-v4-flash', 'DeepSeek-v4-pro', 'DeepSeek-v3.2'],
      },
      {
        name: {
          en: 'MiniMax-M3',
          zhCN: 'MiniMax-M3',
          fr: 'MiniMax-M3',
          ru: 'MiniMax-M3',
          ja: 'MiniMax-M3',
          vi: 'MiniMax-M3',
          zhTW: 'MiniMax-M3',
        },
        description: {
          en: 'The MiniMax API opens up a versatile multimodal model family from MiniMax AI. Its text models pair long-context understanding with strong agent and tool-use ability at competitive cost, while the wider lineup covers lifelike speech synthesis and video generation, fitting content creation, voice applications, and interactive experiences.',
          zhCN: 'MiniMax API 提供 MiniMax AI 的多模态模型家族。文本模型在长上下文理解、智能体能力和工具调用方面表现均衡，成本也较有竞争力；同时还覆盖拟真语音合成和视频生成，适合内容创作、语音应用和交互式体验。',
          fr: 'L’API MiniMax ouvre l’accès à une famille de modèles multimodaux polyvalente de MiniMax AI.',
          ru: 'API MiniMax открывает доступ к универсальному мультимодальному семейству моделей MiniMax AI.',
          ja: 'MiniMax API は MiniMax AI の多機能なマルチモーダルモデルファミリーを提供します。テキストモデルは長文理解、エージェント能力、ツール利用に強みがあります。',
          vi: 'API MiniMax mở ra một họ mô hình đa phương thức linh hoạt từ MiniMax AI. Các mô hình văn bản kết hợp hiểu ngữ cảnh dài với khả năng tác tử và dùng công cụ tốt.',
          zhTW: 'MiniMax API 提供 MiniMax AI 的多模態模型家族。文字模型在長上下文理解、智能體能力與工具調用方面表現均衡。',
        },
        models: ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed'],
      },
      {
        name: {
          en: 'GLM-5.2',
          zhCN: 'GLM-5.2',
          fr: 'GLM-5.2',
          ru: 'GLM-5.2',
          ja: 'GLM-5.2',
          vi: 'GLM-5.2',
          zhTW: 'GLM-5.2',
        },
        description: {
          en: 'The GLM API brings the Zhipu AI model family to developers, one of the leading Chinese-English bilingual lineups with open-weight releases. GLM models stand out for strong coding, reasoning, and agentic tool-use ability, and their combination of quality and low cost makes them well suited to real-world applications from customer service to autonomous agent workflows.',
          zhCN: 'GLM API 为开发者带来智谱 AI 模型家族，是领先的中英双语模型之一，并提供开源权重版本。GLM 在编程、推理和智能体工具使用方面表现突出，兼顾效果与成本，适合客服、代码助手和自动化工作流等场景。',
          fr: 'L’API GLM apporte la famille de modèles Zhipu AI aux développeurs, avec des versions open-weight et un fort support bilingue chinois-anglais.',
          ru: 'API GLM приносит разработчикам семейство моделей Zhipu AI, одно из лидирующих двуязычных китайско-английских решений с открытыми весами.',
          ja: 'GLM API は Zhipu AI のモデルファミリーを開発者に提供します。中英バイリンガルで、オープンウェイト版もある主要なモデル群の一つです。',
          vi: 'API GLM mang đến họ mô hình Zhipu AI cho nhà phát triển, là một trong những dòng mô hình song ngữ Trung - Anh hàng đầu và có bản open-weight.',
          zhTW: 'GLM API 為開發者帶來智譜 AI 模型家族，是領先的中英雙語模型之一，並提供開源權重版本。',
        },
        models: ['glm-5.2', 'glm-5.1', 'glm-5-turbo'],
      },
    ],
  },
  null,
  2
)
