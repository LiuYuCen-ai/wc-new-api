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

const PHOTO_MODELS = [
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    description: 'OpenAI 全新一代图像生成模型',
    type: 'openai',
  },
  {
    id: 'gemini-3-pro-preview',
    label: 'Gemini 3 Pro Preview',
    description: 'Google 多模态生图（高质量）',
    type: 'gemini',
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash Image Preview',
    description: 'Google 多模态生图（高速）',
    type: 'gemini',
  },
];

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'];
const IMAGE_SIZES = ['1K', '2K', '4K'];
const RESOLUTIONS = ['1024x1024', '1024x1536', '1536x1024', 'auto'];

const isGemini = (id) => id.startsWith('gemini-');

const Photo = () => {
  const { t } = useTranslation();
  // 体验中心标题走 i18n key；其他展示文案这里直接使用中文，避免在 8 个 locale 文件中重复维护
  const [model, setModel] = useState(PHOTO_MODELS[0].id);
  const [prompt, setPrompt] = useState('');
  const [n, setN] = useState(1);
  const [size, setSize] = useState('1024x1024');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);

  const selected = useMemo(
    () => PHOTO_MODELS.find((m) => m.id === model) ?? PHOTO_MODELS[0],
    [model]
  );

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
                onChange={setModel}
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
                <Form.Item label='分辨率'>
                  <Select
                    value={size}
                    onChange={setSize}
                    style={{ width: '100%' }}
                  >
                    {RESOLUTIONS.map((r) => (
                      <Select.Option key={r} value={r}>
                        {r}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item label='比例'>
                  <Select
                    value={aspectRatio}
                    onChange={setAspectRatio}
                    style={{ width: '100%' }}
                  >
                    {ASPECT_RATIOS.map((a) => (
                      <Select.Option key={a} value={a}>
                        {a}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item label='图片尺寸'>
                  <Select
                    value={imageSize}
                    onChange={setImageSize}
                    style={{ width: '100%' }}
                  >
                    {IMAGE_SIZES.map((s) => (
                      <Select.Option key={s} value={s}>
                        {s}
                      </Select.Option>
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
