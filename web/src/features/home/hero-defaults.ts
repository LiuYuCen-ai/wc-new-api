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

// 首页 Hero 轮播的默认 JSON 配置。
// 系统设置里对应配置为空时，首页和系统设置编辑框都会使用这份默认值。

export const DEFAULT_HERO_CONTENT = JSON.stringify(
  {
    slides: [
      {
        title: '统一接入下一代 AI 图像模型',
        desc: '聚合 Gemini、GPT Image 等图像模型，通过统一兼容接口快速构建稳定、可观测、成本可控的生成服务。',
        model: 'gemini-3.1-flash-image-preview',
      },
      {
        title: '更快交付高质量图像生成能力',
        desc: '覆盖文生图、图像编辑、批量生成等生产场景，并内置密钥管理、请求日志与稳定路由。',
        model: 'gpt-image-2',
      },
      {
        title: '面向业务的高并发视觉 API',
        desc: '自动选择可用渠道，降低上游波动导致的失败率，让团队专注产品体验而非模型接入。',
        model: 'gemini-3-pro-image-preview',
      },
    ],
  },
  null,
  2
)

export const DEFAULT_HERO_I18N_CONTENT = JSON.stringify(
  {
    slides: [
      {
        title: {
          en: 'Unified access to next-gen AI image models',
          zhCN: '统一接入下一代 AI 图像模型',
          zhTW: '統一接入下一代 AI 圖像模型',
          fr: 'Accès unifié aux modèles d’images IA de nouvelle génération',
          ru: 'Единый доступ к AI-моделям изображений нового поколения',
          ja: '次世代 AI 画像モデルへの統合アクセス',
          vi: 'Truy cập thống nhất các mô hình hình ảnh AI thế hệ mới',
        },
        desc: {
          en: 'Aggregate Gemini, GPT Image, and more image models through one compatible endpoint to build stable, observable, cost-efficient generation services faster.',
          zhCN: '聚合 Gemini、GPT Image 等图像模型，通过统一兼容接口快速构建稳定、可观测、成本可控的生成服务。',
          zhTW: '聚合 Gemini、GPT Image 等圖像模型，透過統一相容介面快速構建穩定、可觀測、成本可控的生成服務。',
          fr: 'Regroupez Gemini, GPT Image et d’autres modèles d’images via un point d’accès compatible pour accélérer la mise en production.',
          ru: 'Объединяйте Gemini, GPT Image и другие модели изображений через единый совместимый endpoint.',
          ja: 'Gemini、GPT Image などの画像モデルを単一の互換エンドポイントで集約し、安定した生成サービスを素早く構築できます。',
          vi: 'Tổng hợp Gemini, GPT Image và nhiều mô hình hình ảnh qua một endpoint tương thích để triển khai nhanh hơn.',
        },
        model: 'gemini-3.1-flash-image-preview',
      },
      {
        title: {
          en: 'Ship high-quality image generation faster',
          zhCN: '更快交付高质量图像生成能力',
          zhTW: '更快交付高品質圖像生成能力',
          fr: 'Déployez plus vite une génération d’images de haute qualité',
          ru: 'Быстрее выводите в продакшен качественную генерацию изображений',
          ja: '高品質な画像生成をより速く提供',
          vi: 'Triển khai tạo ảnh chất lượng cao nhanh hơn',
        },
        desc: {
          en: 'Cover production scenarios like text-to-image, image editing, and batch generation with key management, request logs, and stable routing built in.',
          zhCN: '覆盖文生图、图像编辑、批量生成等生产场景，并内置密钥管理、请求日志与稳定路由。',
          zhTW: '覆蓋文生圖、圖像編輯、批量生成等生產場景，並內建密鑰管理、請求日誌與穩定路由。',
          fr: 'Couvrez la génération texte-image, l’édition et le batch avec gestion des clés, journaux et routage stable.',
          ru: 'Покрывайте text-to-image, редактирование и пакетную генерацию с управлением ключами, логами и стабильной маршрутизацией.',
          ja: 'テキストから画像、編集、バッチ生成などの本番シナリオを、鍵管理・ログ・安定ルーティング込みでカバーします。',
          vi: 'Bao phủ text-to-image, chỉnh sửa ảnh và tạo hàng loạt với quản lý khóa, log và định tuyến ổn định.',
        },
        model: 'gpt-image-2',
      },
      {
        title: {
          en: 'High-concurrency visual APIs for business',
          zhCN: '面向业务的高并发视觉 API',
          zhTW: '面向業務的高併發視覺 API',
          fr: 'Des API visuelles à haute concurrence pour les entreprises',
          ru: 'Высоконагруженные визуальные API для бизнеса',
          ja: 'ビジネス向けの高並列ビジュアル API',
          vi: 'API hình ảnh hiệu năng cao cho doanh nghiệp',
        },
        desc: {
          en: 'Automatically select available channels to reduce failures caused by provider volatility, so teams can focus on product experience instead of model integration.',
          zhCN: '自动选择可用渠道，降低上游波动导致的失败率，让团队专注产品体验而非模型接入。',
          zhTW: '自動選擇可用渠道，降低上游波動導致的失敗率，讓團隊專注產品體驗而非模型接入。',
          fr: 'Sélectionnez automatiquement les canaux disponibles pour réduire les échecs liés à la volatilité des fournisseurs.',
          ru: 'Автоматически выбирайте доступные каналы, чтобы снизить сбои из-за нестабильности провайдеров.',
          ja: '利用可能なチャネルを自動選択し、プロバイダーの変動による失敗を減らします。',
          vi: 'Tự động chọn kênh khả dụng để giảm lỗi do nhà cung cấp không ổn định.',
        },
        model: 'gemini-3-pro-image-preview',
      },
    ],
  },
  null,
  2
)
