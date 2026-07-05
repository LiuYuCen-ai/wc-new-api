/*
Copyright (C) 2025 QuantumNous

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
import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  InputNumber,
  Select,
  Spin,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { API, showError } from '../../helpers';
import { useTranslation } from 'react-i18next';
import {
  Download,
  Image as ImageIcon,
  Sparkles,
  Wand2,
} from '@douyinfe/semi-icons';

const { Title, Text } = Typography;

const GEMINI_MODEL_IDS = {
  BANANA_PRO: 'gemini-3-pro-image-preview',
  BANANA_2: 'gemini-3.1-flash-image-preview',
};

const PHOTO_MODELS = [
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    description: 'OpenAI 全新一代图像生成模型',
    type: 'openai',
  },
  {
    id: GEMINI_MODEL_IDS.BANANA_PRO,
    label: 'Nano Banana Pro',
    description: '工作室级高保真 · 10 种常规宽高比 · 最高 4K',
    type: 'gemini',
    kind: 'bananaPro',
  },
  {
    id: GEMINI_MODEL_IDS.BANANA_2,
    label: 'Nano Banana 2',
    description: 'Flash 高速 · 14 种宽高比含极致比例 · 0.5K–4K',
    type: 'gemini',
    kind: 'banana2',
  },
];

const GEMINI_CLASSIC_RATIOS = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '4:5',
  '5:4',
  '21:9',
];

const GEMINI_ASPECT_RATIO_GROUPS = [
  {
    id: 'classic',
    label: '常规宽高比',
    models: ['bananaPro', 'banana2'],
    items: [
      { ratio: '1:1', label: '1:1 · 头像与社交贴图' },
      { ratio: '16:9', label: '16:9 · 横屏壁纸与视频' },
      { ratio: '9:16', label: '9:16 · 手机壁纸与短视频' },
      { ratio: '4:3', label: '4:3 · 标准摄影与电商' },
      { ratio: '3:4', label: '3:4 · 竖版商品主图' },
      { ratio: '3:2', label: '3:2 · 单反画幅与印刷' },
      { ratio: '2:3', label: '2:3 · 竖版摄影作品' },
      { ratio: '4:5', label: '4:5 · 社交海报' },
      { ratio: '5:4', label: '5:4 · 艺术微喷' },
      { ratio: '21:9', label: '21:9 · 超宽电影画幅' },
    ],
  },
  {
    id: 'extreme',
    label: '极致宽高比 · Banana 2 专属',
    models: ['banana2'],
    items: [
      { ratio: '4:1', label: '4:1 · 横幅与横向漫画 [Banana 2]' },
      { ratio: '1:4', label: '1:4 · 垂直信息流 [Banana 2]' },
      { ratio: '8:1', label: '8:1 · 全景与舞台大屏 [Banana 2]' },
      { ratio: '1:8', label: '1:8 · 狭长竖屏展示 [Banana 2]' },
    ],
  },
];

const GEMINI_IMAGE_SIZE_OPTIONS = [
  { size: '0.5K', label: '0.5K · 512px 快速预览 [Banana 2]', models: ['banana2'] },
  { size: '1K', label: '1K · 标准', models: ['bananaPro', 'banana2'] },
  { size: '2K', label: '2K · 高清', models: ['bananaPro', 'banana2'] },
  { size: '4K', label: '4K · 极致细节', models: ['bananaPro', 'banana2'] },
];
const RESOLUTION_TIERS = ['1K', '2K', '4K'];
const RESOLUTION_SIZE_MAP = {
  // 1K – 标准 / 社交媒体
  '1K': [
    { size: 'auto', label: 'Auto（自动）' },
    { size: '1024x1024', label: '1024×1024（正方形）' },
    { size: '1024x1536', label: '1024×1536（竖版）' },
    { size: '1536x1024', label: '1536×1024（横版）' },
  ],
  // 2K – 高清壁纸 / 设计稿
  '2K': [
    { size: '2048x2048', label: '2048×2048（正方形）' },
    { size: '2048x1152', label: '2048×1152（16:9 宽屏）' },
  ],
  // 4K – 极致细节 / 影视素材
  '4K': [
    { size: '3840x2160', label: '3840×2160（4K 横屏）' },
    { size: '2160x3840', label: '2160×3840（4K 竖屏）' },
  ],
};

const isGemini = (id) => id.startsWith('gemini-');

const Photo = () => {
  const { t } = useTranslation();
  // 体验中心标题走 i18n key；其他展示文案这里直接使用中文，避免在 8 个 locale 文件中重复维护
  const [model, setModel] = useState(PHOTO_MODELS[0].id);
  const [prompt, setPrompt] = useState('');
  const [n, setN] = useState(1);
  const [resolution, setResolution] = useState('1K');
  const [size, setSize] = useState('1024x1024');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);

  const selected = useMemo(
    () => PHOTO_MODELS.find((m) => m.id === model) ?? PHOTO_MODELS[0],
    [model]
  );

  const geminiKind = selected.kind ?? null;

  const geminiAspectGroups = useMemo(() => {
    const extremeOnly = geminiKind === 'banana2';
    return GEMINI_ASPECT_RATIO_GROUPS.map((group) => ({
      ...group,
      items: group.items
        .filter(() => group.models.includes(geminiKind))
        .filter((item) => extremeOnly || group.id === 'classic'),
    })).filter((group) => group.items.length > 0);
  }, [geminiKind]);

  const geminiImageSizes = useMemo(
    () =>
      GEMINI_IMAGE_SIZE_OPTIONS.filter((item) =>
        item.models.includes(geminiKind)
      ),
    [geminiKind]
  );

  const handleImageSizeChange = (nextSize) => {
    setImageSize(nextSize);
    const allowedRatios = GEMINI_ASPECT_RATIO_GROUPS.flatMap((group) =>
      group.models.includes(geminiKind) &&
      (geminiKind === 'banana2' || group.id === 'classic')
        ? group.items
        : []
    ).map((item) => item.ratio);
    setAspectRatio((prev) =>
      allowedRatios.includes(prev) ? prev : allowedRatios[0] ?? '1:1'
    );
  };

  const handleModelChange = (nextModel) => {
    setModel(nextModel);
    const nextSelected = PHOTO_MODELS.find((m) => m.id === nextModel);
    if (!nextSelected?.kind) return;
    const allowedRatios = GEMINI_ASPECT_RATIO_GROUPS.flatMap((group) =>
      group.models.includes(nextSelected.kind) &&
      (nextSelected.kind === 'banana2' || group.id === 'classic')
        ? group.items
        : []
    ).map((item) => item.ratio);
    setAspectRatio((prev) =>
      allowedRatios.includes(prev) ? prev : allowedRatios[0] ?? '1:1'
    );
    const allowedSizes = GEMINI_IMAGE_SIZE_OPTIONS.filter((item) =>
      item.models.includes(nextSelected.kind)
    ).map((item) => item.size);
    setImageSize((prev) =>
      allowedSizes.includes(prev) ? prev : allowedSizes[0] ?? '1K'
    );
  };

  const sizeOptions = useMemo(
    () => RESOLUTION_SIZE_MAP[resolution] ?? RESOLUTION_SIZE_MAP['1K'],
    [resolution]
  );

  const handleResolutionChange = (tier) => {
    setResolution(tier);
    const sizes = (RESOLUTION_SIZE_MAP[tier] ?? []).map((item) => item.size);
    setSize((prev) => (sizes.includes(prev) ? prev : sizes[0]));
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      Toast.error('请输入提示词');
      return;
    }
    setLoading(true);
    setImages([]);
    try {
      let res;
      if (isGemini(model)) {
        res = await API.post('/v1/chat/completions', {
          model,
          stream: false,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: prompt }],
            },
          ],
          extra_body: {
            google: {
              image_config: {
                aspect_ratio: aspectRatio,
                image_size: imageSize,
              },
            },
          },
        });
        setImages(parseGeminiImages(res?.data));
      } else {
        res = await API.post('/v1/images/generations', {
          model,
          prompt,
          n,
          size,
          response_format: 'b64_json',
        });
        setImages(parseOpenAIImages(res?.data));
      }
    } catch (err) {
      showError(err?.response?.data?.error?.message || err.message || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mt-[60px] px-2 lg:px-6 pb-6'>
      <div className='mb-4 flex items-center gap-2'>
        <Sparkles style={{ color: 'var(--semi-color-primary)' }} />
        <Title heading={4} style={{ margin: 0 }}>
          {t('体验中心')}
        </Title>
        <Tag color='blue' shape='circle'>
          Beta
        </Tag>
      </div>
      <Text type='secondary'>
        统一接入 Gemini、GPT Image 等图像模型，自动按配额扣费。
      </Text>

      <div className='mt-4 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4'>
        {/* Left: parameters */}
        <Card className='h-fit'>
          <Form layout='vertical' onSubmit={handleSubmit}>
            <Form.Item label='模型'>
              <Select
                value={model}
                onChange={handleModelChange}
                style={{ width: '100%' }}
              >
                {PHOTO_MODELS.map((m) => (
                  <Select.Option key={m.id} value={m.id}>
                    {m.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            {selected.description ? (
              <Text type='tertiary' size='small'>
                {selected.description}
              </Text>
            ) : null}

            <Form.Item label='提示词' className='!mt-3'>
              <TextArea
                value={prompt}
                onChange={setPrompt}
                placeholder='描述你想要生成的内容，例如：一只可爱的猫坐在日落时的窗台上'
                rows={5}
                autosize={{ minRows: 5, maxRows: 12 }}
              />
            </Form.Item>

            {!isGemini(model) ? (
              <>
                <Form.Item label='生成数量'>
                  <InputNumber
                    value={n}
                    onChange={(v) => setN(Math.min(4, Math.max(1, v || 1)))}
                    min={1}
                    max={4}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item label='清晰度'>
                  <Select
                    value={resolution}
                    onChange={handleResolutionChange}
                    style={{ width: '100%' }}
                  >
                    {RESOLUTION_TIERS.map((tier) => (
                      <Select.Option key={tier} value={tier}>
                        {tier}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item label='尺寸'>
                  <Select
                    value={size}
                    onChange={setSize}
                    style={{ width: '100%' }}
                  >
                    {sizeOptions.map((item) => (
                      <Select.Option key={item.size} value={item.size}>
                        {item.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item label='图片尺寸'>
                  <Select
                    value={imageSize}
                    onChange={handleImageSizeChange}
                    style={{ width: '100%' }}
                  >
                    {geminiImageSizes.map((item) => (
                      <Select.Option key={item.size} value={item.size}>
                        {item.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item label='比例'>
                  <Select
                    value={aspectRatio}
                    onChange={setAspectRatio}
                    style={{ width: '100%' }}
                  >
                    {geminiAspectGroups.map((group) => (
                      <Select.OptGroup key={group.id} label={group.label}>
                        {group.items.map((item) => (
                          <Select.Option key={item.ratio} value={item.ratio}>
                            {item.label}
                          </Select.Option>
                        ))}
                      </Select.OptGroup>
                    ))}
                  </Select>
                </Form.Item>
              </>
            )}

            <Button
              type='primary'
              theme='solid'
              htmlType='submit'
              loading={loading}
              icon={<Wand2 />}
              block
            >
              生成
            </Button>
          </Form>
        </Card>

        {/* Right: results */}
        <div>
          {loading ? (
            <div className='flex justify-center items-center min-h-[300px]'>
              <Spin size='large' />
            </div>
          ) : images.length === 0 ? (
            <Card>
              <div className='flex flex-col items-center justify-center py-10 text-center'>
                <ImageIcon
                  size='extra-large'
                  style={{ color: 'var(--semi-color-text-2)' }}
                />
                <Text type='secondary' className='mt-3'>
                  在左侧配置参数后点击「生成」按钮开始创建图片。
                </Text>
              </div>
            </Card>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              {images.map((src, idx) => (
                <ResultImage key={idx} index={idx} src={src} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ResultImage = ({ index, src }) => {
  const handleDownload = () => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `photo-${Date.now()}-${index + 1}.png`;
    a.click();
  };
  return (
    <Card
      cover={
        <div
          style={{
            aspectRatio: '1 / 1',
            background: 'var(--semi-color-fill-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {src ? (
            <img
              src={src}
              alt={`generated-${index + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            <Text type='tertiary'>没有图片数据</Text>
          )}
        </div>
      }
    >
      <div className='flex items-center justify-between'>
        <Text type='tertiary' size='small'>
          图片 {index + 1}
        </Text>
        <Button
          size='small'
          icon={<Download />}
          onClick={handleDownload}
          disabled={!src}
        >
          下载
        </Button>
      </div>
    </Card>
  );
};

function parseOpenAIImages(data) {
  const list = data?.data ?? [];
  return (Array.isArray(list) ? list : []).map((item) => {
    if (item.b64_json) {
      return `data:image/png;base64,${item.b64_json}`;
    }
    return item.url || '';
  });
}

function parseGeminiImages(data) {
  const message = data?.choices?.[0]?.message;
  const content = message?.content;
  const images = [];
  if (Array.isArray(content)) {
    for (const part of content) {
      const url = part?.image_url?.url;
      if (typeof url === 'string') images.push(url);
    }
  } else if (typeof content === 'string') {
    const matches = content.match(/!\[[^\]]*\]\((data:[^)]+)\)/g) ?? [];
    for (const m of matches) {
      const dataUrl = m.replace(/^!\[[^\]]*\]\(/, '').replace(/\)$/, '');
      images.push(dataUrl);
    }
  }
  return images;
}

export default Photo;
