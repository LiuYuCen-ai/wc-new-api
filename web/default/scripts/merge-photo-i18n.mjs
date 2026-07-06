/*
Copyright (C) 2023-2026 QuantumNous

Merge Experience Hub (photo) i18n keys into locale files.
Run from web/default: node scripts/merge-photo-i18n.mjs
*/
import fs from 'node:fs/promises'
import path from 'node:path'

const LOCALES_DIR = path.resolve('src/i18n/locales')

const PHOTO_KEYS = {
  '512px · fast preview': {
    en: '512px · fast preview',
    zh: '512px · 快速预览',
    ja: '512px · 高速プレビュー',
    fr: '512px · aperçu rapide',
    vi: '512px · xem trước nhanh',
    ru: '512px · быстрый предпросмотр',
  },
  'Aspect ratio': {
    en: 'Aspect ratio',
    zh: '宽高比',
    ja: 'アスペクト比',
    fr: "Ratio d'aspect",
    vi: 'Tỉ lệ khung hình',
    ru: 'Соотношение сторон',
  },
  'Banana 2': {
    en: 'Banana 2',
    zh: 'Banana 2',
    ja: 'Banana 2',
    fr: 'Banana 2',
    vi: 'Banana 2',
    ru: 'Banana 2',
  },
  'Classic aspect ratios': {
    en: 'Classic aspect ratios',
    zh: '常规宽高比',
    ja: '標準アスペクト比',
    fr: 'Ratios classiques',
    vi: 'Tỉ lệ khung hình thông thường',
    ru: 'Классические соотношения сторон',
  },
  'Configure the parameters on the left and click Generate. Gemini image models support aspect ratio and image size.':
    {
      en: 'Configure the parameters on the left and click Generate. Gemini image models support aspect ratio and image size.',
      zh: '在左侧配置参数后点击「生成」。Gemini 图像模型支持宽高比与图片尺寸。',
      ja: '左側でパラメータを設定し、「生成」をクリックしてください。Gemini 画像モデルはアスペクト比と画像サイズに対応しています。',
      fr: 'Configurez les paramètres à gauche puis cliquez sur Générer. Les modèles Gemini prennent en charge le ratio et la taille.',
      vi: 'Cấu hình tham số bên trái và nhấn Tạo. Mô hình Gemini hỗ trợ tỉ lệ khung hình và kích thước ảnh.',
      ru: 'Настройте параметры слева и нажмите «Создать». Модели Gemini поддерживают соотношение сторон и размер изображения.',
    },
  'Configure the parameters on the left and click Generate. OpenAI image models support resolution and quality.':
    {
      en: 'Configure the parameters on the left and click Generate. OpenAI image models support resolution and quality.',
      zh: '在左侧配置参数后点击「生成」。OpenAI 图像模型支持清晰度与画质。',
      ja: '左側でパラメータを設定し、「生成」をクリックしてください。OpenAI 画像モデルは解像度と品質に対応しています。',
      fr: 'Configurez les paramètres à gauche puis cliquez sur Générer. Les modèles OpenAI prennent en charge la résolution et la qualité.',
      vi: 'Cấu hình tham số bên trái và nhấn Tạo. Mô hình OpenAI hỗ trợ độ phân giải và chất lượng.',
      ru: 'Настройте параметры слева и нажмите «Создать». Модели OpenAI поддерживают разрешение и качество.',
    },
  'DSLR · photography & print': {
    en: 'DSLR · photography & print',
    zh: '单反画幅 · 摄影印刷',
    ja: '一眼レフ · 写真・印刷',
    fr: 'Reflex · photo et impression',
    vi: 'DSLR · nhiếp ảnh & in ấn',
    ru: 'Зеркалка · фото и печать',
  },
  'Enable to add local images as image input for image editing.': {
    en: 'Enable to add local images as image input for image editing.',
    zh: '开启后可添加本地图片作为图像编辑输入。',
    ja: '有効にすると、ローカル画像を画像編集の入力として追加できます。',
    fr: "Activez pour ajouter des images locales en entrée d'édition.",
    vi: 'Bật để thêm ảnh cục bộ làm đầu vào chỉnh sửa ảnh.',
    ru: 'Включите, чтобы добавить локальные изображения для редактирования.',
  },
  'Experience Hub': {
    en: 'Experience Hub',
    zh: '体验中心',
    ja: '体験センター',
    fr: "Centre d'expérience",
    vi: 'Trung tâm trải nghiệm',
    ru: 'Центр возможностей',
  },
  'Extreme aspect ratios · Banana 2 exclusive': {
    en: 'Extreme aspect ratios · Banana 2 exclusive',
    zh: '极致宽高比 · Banana 2 专属',
    ja: '極端アスペクト比 · Banana 2 限定',
    fr: 'Ratios extrêmes · exclusif Banana 2',
    vi: 'Tỉ lệ cực đoan · chỉ Banana 2',
    ru: 'Экстремальные соотношения · только Banana 2',
  },
  'Flash speed · 14 aspect ratios incl. extreme · 0.5K–4K': {
    en: 'Flash speed · 14 aspect ratios incl. extreme · 0.5K–4K',
    zh: 'Flash 高速 · 14 种宽高比含极致比例 · 0.5K–4K',
    ja: 'Flash 高速 · 極端比を含む14種 · 0.5K–4K',
    fr: 'Vitesse Flash · 14 ratios dont extrêmes · 0.5K–4K',
    vi: 'Tốc độ Flash · 14 tỉ lệ gồm cực đoan · 0.5K–4K',
    ru: 'Скорость Flash · 14 соотношений, вкл. экстремальные · 0.5K–4K',
  },
  'Generation History': {
    en: 'Generation History',
    zh: '生成历史',
    ja: '生成履歴',
    fr: 'Historique de génération',
    vi: 'Lịch sử tạo ảnh',
    ru: 'История генераций',
  },
  'Generation failed': {
    en: 'Generation failed',
    zh: '生成失败',
    ja: '生成に失敗しました',
    fr: 'Échec de la génération',
    vi: 'Tạo ảnh thất bại',
    ru: 'Ошибка генерации',
  },
  'HD · design draft': {
    en: 'HD · design draft',
    zh: '高清 · 设计稿',
    ja: 'HD · デザイン稿',
    fr: 'HD · maquette',
    vi: 'HD · bản thiết kế',
    ru: 'HD · макет',
  },
  'HD aspect ratios': {
    en: 'HD aspect ratios',
    zh: '高清宽高比',
    ja: 'HD アスペクト比',
    fr: 'Ratios HD',
    vi: 'Tỉ lệ khung hình HD',
    ru: 'HD соотношения сторон',
  },
  'Image Input': {
    en: 'Image Input',
    zh: '图片输入',
    ja: '画像入力',
    fr: "Entrée d'image",
    vi: 'Đầu vào ảnh',
    ru: 'Ввод изображения',
  },
  'Image added to image input': {
    en: 'Image added to image input',
    zh: '已添加到图片输入',
    ja: '画像入力に追加しました',
    fr: "Image ajoutée à l'entrée",
    vi: 'Đã thêm vào đầu vào ảnh',
    ru: 'Изображение добавлено во ввод',
  },
  'Image to image': {
    en: 'Image to image',
    zh: '图生图',
    ja: '画像から画像',
    fr: 'Image vers image',
    vi: 'Ảnh sang ảnh',
    ru: 'Изображение в изображение',
  },
  'Image to image prompt placeholder': {
    en: 'e.g. Change the background to a sunset beach, keep the subject unchanged',
    zh: '例如：将背景改为日落海滩，保持主体不变',
    ja: '例：背景を夕日のビーチに変更し、被写体はそのまま',
    fr: 'ex. : Changer le fond en plage au coucher du soleil, garder le sujet',
    vi: 'VD: Đổi nền thành bãi biển hoàng hôn, giữ nguyên chủ thể',
    ru: 'напр.: сменить фон на закатный пляж, сохранить объект',
  },
  'Images in this generation': {
    en: 'Images in this generation',
    zh: '本组图片',
    ja: 'この生成の画像',
    fr: 'Images de cette génération',
    vi: 'Ảnh trong lần tạo này',
    ru: 'Изображения этой генерации',
  },
  'Adjust output size and aspect ratio before generating.': {
    en: 'Adjust output size and aspect ratio before generating.',
    zh: '生成前可调整输出尺寸与宽高比。',
    ja: '生成前に出力サイズとアスペクト比を調整できます。',
    fr: "Ajustez la taille et le ratio avant de générer.",
    vi: 'Có thể chỉnh kích thước và tỉ lệ trước khi tạo.',
    ru: 'Настройте размер и соотношение сторон перед генерацией.',
  },
  'Uses the model from this generation by default. You can change it before generating.': {
    en: 'Uses the model from this generation by default. You can change it before generating.',
    zh: '默认使用本次生成时的模型，生成前可手动切换。',
    ja: '既定ではこの生成時のモデルを使用します。生成前に変更できます。',
    fr: 'Utilise par défaut le modèle de cette génération. Modifiable avant de générer.',
    vi: 'Mặc định dùng mô hình của lần tạo này. Có thể đổi trước khi tạo.',
    ru: 'По умолчанию используется модель этой генерации. Можно сменить перед созданием.',
  },
  'Add to image input': {
    en: 'Add to image input',
    zh: '添加到图片输入',
    ja: '画像入力に追加',
    fr: "Ajouter à l'entrée d'image",
    vi: 'Thêm vào đầu vào ảnh',
    ru: 'Добавить во ввод изображения',
  },
  'Describe how you want to transform this image. The current image will be used as reference input.':
    {
      en: 'Describe how you want to transform this image. The current image will be used as reference input.',
      zh: '描述你希望如何变换这张图片，当前图片将作为参考输入。',
      ja: 'この画像をどのように変換するか記述してください。現在の画像が参照入力として使われます。',
      fr: "Décrivez la transformation souhaitée. L'image actuelle servira de référence.",
      vi: 'Mô tả cách bạn muốn biến đổi ảnh này. Ảnh hiện tại sẽ được dùng làm tham chiếu.',
      ru: 'Опишите, как преобразовать изображение. Текущее изображение будет использовано как референс.',
    },
  'Generate from image': {
    en: 'Generate from image',
    zh: '以此图生成',
    ja: 'この画像から生成',
    fr: "Générer à partir de l'image",
    vi: 'Tạo từ ảnh',
    ru: 'Создать из изображения',
  },
  'Generating image...': {
    en: 'Generating image...',
    zh: '正在生成图片...',
    ja: '画像を生成中...',
    fr: "Génération de l'image...",
    vi: 'Đang tạo ảnh...',
    ru: 'Генерация изображения...',
  },
  'Download': {
    en: 'Download',
    zh: '下载',
    ja: 'ダウンロード',
    fr: 'Télécharger',
    vi: 'Tải xuống',
    ru: 'Скачать',
  },
  'Image preview': {
    en: 'Image preview',
    zh: '图片预览',
    ja: '画像プレビュー',
    fr: "Aperçu de l'image",
    vi: 'Xem trước ảnh',
    ru: 'Предпросмотр изображения',
  },
  'Image size': {
    en: 'Image size',
    zh: '图片尺寸',
    ja: '画像サイズ',
    fr: "Taille de l'image",
    vi: 'Kích thước ảnh',
    ru: 'Размер изображения',
  },
  'Let the model pick the best output size': {
    en: 'Let the model pick the best output size',
    zh: '由模型自动选择最佳输出尺寸',
    ja: 'モデルが最適な出力サイズを自動選択',
    fr: 'Laisser le modèle choisir la meilleure taille',
    vi: 'Để mô hình tự chọn kích thước đầu ra phù hợp',
    ru: 'Пусть модель выберет лучший размер вывода',
  },
  'Nano Banana 2': {
    en: 'Nano Banana 2',
    zh: 'Nano Banana 2',
    ja: 'Nano Banana 2',
    fr: 'Nano Banana 2',
    vi: 'Nano Banana 2',
    ru: 'Nano Banana 2',
  },
  'Nano Banana Pro': {
    en: 'Nano Banana Pro',
    zh: 'Nano Banana Pro',
    ja: 'Nano Banana Pro',
    fr: 'Nano Banana Pro',
    vi: 'Nano Banana Pro',
    ru: 'Nano Banana Pro',
  },
  'Next image': {
    en: 'Next image',
    zh: '下一张',
    ja: '次の画像',
    fr: 'Image suivante',
    vi: 'Ảnh tiếp theo',
    ru: 'Следующее изображение',
  },
  'No images yet': {
    en: 'No images yet',
    zh: '暂无图片',
    ja: 'まだ画像がありません',
    fr: 'Pas encore d’images',
    vi: 'Chưa có ảnh',
    ru: 'Пока нет изображений',
  },
  'Panorama · stage display': {
    en: 'Panorama · stage display',
    zh: '极限全景 · 舞台大屏',
    ja: 'パノラマ · ステージ表示',
    fr: 'Panorama · écran de scène',
    vi: 'Toàn cảnh · màn hình sân khấu',
    ru: 'Панорама · сценический экран',
  },
  'Photo print · fine art': {
    en: 'Photo print · fine art',
    zh: '照片打印 · 艺术输出',
    ja: '写真プリント · ファインアート',
    fr: 'Tirage photo · beaux-arts',
    vi: 'In ảnh · nghệ thuật',
    ru: 'Фотопечать · изобразительное искусство',
  },
  'Portrait · mobile & short video': {
    en: 'Portrait · mobile & short video',
    zh: '竖屏 · 手机壁纸与短视频',
    ja: '縦向き · モバイル・ショート動画',
    fr: 'Portrait · mobile et vidéo courte',
    vi: 'Dọc · hình nền & video ngắn',
    ru: 'Портрет · мобильные и короткие видео',
  },
  'Portrait · poster': {
    en: 'Portrait · poster',
    zh: '竖版 · 海报',
    ja: '縦向き · ポスター',
    fr: 'Portrait · affiche',
    vi: 'Dọc · poster',
    ru: 'Портрет · постер',
  },
  'Portrait · photo prints': {
    en: 'Portrait · photo prints',
    zh: '竖版 · 摄影作品',
    ja: '縦向き · 写真作品',
    fr: 'Portrait · tirages photo',
    vi: 'Dọc · ảnh nhiếp ảnh',
    ru: 'Портрет · фотопечать',
  },
  'Portrait · product showcase': {
    en: 'Portrait · product showcase',
    zh: '竖版 · 商品展示',
    ja: '縦向き · 商品展示',
    fr: 'Portrait · vitrine produit',
    vi: 'Dọc · trưng bày sản phẩm',
    ru: 'Портрет · витрина товара',
  },
  'Previous image': {
    en: 'Previous image',
    zh: '上一张',
    ja: '前の画像',
    fr: 'Image précédente',
    vi: 'Ảnh trước',
    ru: 'Предыдущее изображение',
  },
  'Select an image size to view aspect ratio options.': {
    en: 'Select an image size to view aspect ratio options.',
    zh: '请先选择图片尺寸以查看可用宽高比。',
    ja: '画像サイズを選択すると、利用可能なアスペクト比が表示されます。',
    fr: "Sélectionnez une taille d'image pour voir les ratios disponibles.",
    vi: 'Chọn kích thước ảnh để xem các tỉ lệ khung hình.',
    ru: 'Выберите размер изображения, чтобы увидеть доступные соотношения сторон.',
  },
  'Sign in to save and view your generation history.': {
    en: 'Sign in to save and view your generation history.',
    zh: '登录后可保存并查看生成历史。',
    ja: 'ログインすると生成履歴を保存・表示できます。',
    fr: 'Connectez-vous pour enregistrer et consulter votre historique.',
    vi: 'Đăng nhập để lưu và xem lịch sử tạo ảnh.',
    ru: 'Войдите, чтобы сохранять и просматривать историю генераций.',
  },
  'Social poster · art prints': {
    en: 'Social poster · art prints',
    zh: '社交海报 · 艺术微喷',
    ja: 'SNSポスター · アートプリント',
    fr: 'Affiche sociale · tirages artistiques',
    vi: 'Poster mạng xã hội · in nghệ thuật',
    ru: 'Соцпостер · арт-принты',
  },
  'Square · avatar & social posts': {
    en: 'Square · avatar & social posts',
    zh: '正方形 · 头像与社交贴图',
    ja: '正方形 · アバター・SNS投稿',
    fr: 'Carré · avatar et posts sociaux',
    vi: 'Vuông · avatar & bài đăng',
    ru: 'Квадрат · аватар и соцсети',
  },
  'Standard · social media': {
    en: 'Standard · social media',
    zh: '标准 · 社交媒体',
    ja: '標準 · ソーシャルメディア',
    fr: 'Standard · réseaux sociaux',
    vi: 'Tiêu chuẩn · mạng xã hội',
    ru: 'Стандарт · соцсети',
  },
  'Standard photo · e-commerce': {
    en: 'Standard photo · e-commerce',
    zh: '标准摄影 · 电商主图',
    ja: '標準写真 · ECメイン画像',
    fr: 'Photo standard · e-commerce',
    vi: 'Ảnh chuẩn · thương mại điện tử',
    ru: 'Стандартное фото · e-commerce',
  },
  'Studio-grade fidelity · 10 classic aspect ratios · up to 4K': {
    en: 'Studio-grade fidelity · 10 classic aspect ratios · up to 4K',
    zh: '工作室级高保真 · 10 种常规宽高比 · 最高 4K',
    ja: 'スタジオ級品質 · 標準10種 · 最大4K',
    fr: 'Fidélité studio · 10 ratios classiques · jusqu’à 4K',
    vi: 'Chất lượng studio · 10 tỉ lệ thông thường · tối đa 4K',
    ru: 'Студийное качество · 10 классических соотношений · до 4K',
  },
  'Ultra detail · film footage': {
    en: 'Ultra detail · film footage',
    zh: '极致细节 · 影视素材',
    ja: '超高精細 · 映像素材',
    fr: 'Ultra-détail · footage cinéma',
    vi: 'Siêu chi tiết · footage phim',
    ru: 'Ультрадетализация · киноматериалы',
  },
  'Ultra HD aspect ratios': {
    en: 'Ultra HD aspect ratios',
    zh: '超高清宽高比',
    ja: 'Ultra HD アスペクト比',
    fr: 'Ratios Ultra HD',
    vi: 'Tỉ lệ khung hình Ultra HD',
    ru: 'Ultra HD соотношения сторон',
  },
  'Ultra-tall · vertical feed': {
    en: 'Ultra-tall · vertical feed',
    zh: '超长纵向 · 信息流素材',
    ja: '超縦長 · 縦スクロール',
    fr: 'Ultra-vertical · flux vertical',
    vi: 'Siêu dọc · feed dọc',
    ru: 'Ультравысокий · вертикальная лента',
  },
  'Ultra-wide banner · comic strip': {
    en: 'Ultra-wide banner · comic strip',
    zh: '超长横向 · 横幅与漫画',
    ja: '超横長 · バナー・漫画',
    fr: 'Ultra-large · bannière et bande dessinée',
    vi: 'Siêu ngang · banner & truyện tranh',
    ru: 'Ультраширокий · баннер и комикс',
  },
  'Ultrawide · cinematic': {
    en: 'Ultrawide · cinematic',
    zh: '超宽屏 · 电影感画幅',
    ja: 'ウルトラワイド · シネマ',
    fr: 'Ultra-large · cinématique',
    vi: 'Siêu rộng · điện ảnh',
    ru: 'Ультраширокий · кинематографичный',
  },
  'Vertical signage · narrow billboard': {
    en: 'Vertical signage · narrow billboard',
    zh: '极限竖屏 · 户外灯箱',
    ja: '縦型サイネージ · 細長看板',
    fr: 'Signalétique verticale · panneau étroit',
    vi: 'Biển dọc · hộp đèn hẹp',
    ru: 'Вертикальная вывеска · узкий билборд',
  },
  'View image': {
    en: 'View image',
    zh: '查看图片',
    ja: '画像を表示',
    fr: "Voir l'image",
    vi: 'Xem ảnh',
    ru: 'Просмотреть изображение',
  },
  'Widescreen · landscape': {
    en: 'Widescreen · landscape',
    zh: '横屏 · 风景',
    ja: '横長 · 風景',
    fr: 'Paysage · format large',
    vi: 'Ngang · phong cảnh',
    ru: 'Широкоформатный · пейзаж',
  },
  'Widescreen · wallpaper & video': {
    en: 'Widescreen · wallpaper & video',
    zh: '横屏 · 壁纸与视频',
    ja: 'ワイドスクリーン · 壁紙・動画',
    fr: 'Écran large · fond d’écran et vidéo',
    vi: 'Ngang · hình nền & video',
    ru: 'Широкоэкранный · обои и видео',
  },
  'Your recent generations are saved here and can be previewed anytime.': {
    en: 'Your recent generations are saved here and can be previewed anytime.',
    zh: '最近的生成记录会保存在这里，可随时预览。',
    ja: '最近の生成結果はここに保存され、いつでもプレビューできます。',
    fr: 'Vos générations récentes sont enregistrées ici et consultables à tout moment.',
    vi: 'Các ảnh tạo gần đây được lưu tại đây và có thể xem lại bất cứ lúc nào.',
    ru: 'Недавние генерации сохраняются здесь и доступны для просмотра в любое время.',
  },
}

function sortTranslation(obj) {
  return Object.fromEntries(
    Object.keys(obj)
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, obj[k]])
  )
}

async function main() {
  const locales = ['en', 'zh', 'ja', 'fr', 'vi', 'ru']
  for (const locale of locales) {
    const file = path.join(LOCALES_DIR, `${locale}.json`)
    const json = JSON.parse(await fs.readFile(file, 'utf8'))
    const translation = { ...(json.translation ?? {}) }
    for (const [key, values] of Object.entries(PHOTO_KEYS)) {
      translation[key] = values[locale] ?? values.en
    }
    json.translation = sortTranslation(translation)
    await fs.writeFile(file, `${JSON.stringify(json, null, 2)}\n`, 'utf8')
    console.log(`Updated ${locale}.json`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
