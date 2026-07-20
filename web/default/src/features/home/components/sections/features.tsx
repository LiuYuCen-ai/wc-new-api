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
import { useEffect, useState } from 'react'
import { ArrowRight, Check, Copy } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { codeToHtml } from 'shiki'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

interface FeaturesProps {
  className?: string
}

const codeSnippets = [
  {
    key: 'Shell',
    language: 'bash',
    code: `curl "https://webchannel.ai/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $WEBCHANNEL_API_KEY" \\
  -d '{
    "model": "gemini-2.5-flash-image",
    "messages": [
      {
        "role": "user",
        "content": "Generate a futuristic cyberpunk city at night."
      }
    ]
  }'`,
  },
  {
    key: 'JavaScript',
    language: 'javascript',
    code: `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.WEBCHANNEL_API_KEY,
  baseURL: "https://webchannel.ai/v1",
});

const response = await client.chat.completions.create({
  model: "gemini-2.5-flash-image",
  messages: [
    {
      role: "user",
      content: "Generate a futuristic cyberpunk city at night.",
    },
  ],
});

console.log(response.choices[0].message.content);`,
  },
  {
    key: 'Java',
    language: 'java',
    code: `import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.chat.completions.ChatCompletion;
import com.openai.models.chat.completions.ChatCompletionCreateParams;

public class Main {
  public static void main(String[] args) {
    OpenAIClient client = OpenAIOkHttpClient.builder()
        .apiKey(System.getenv("WEBCHANNEL_API_KEY"))
        .baseUrl("https://webchannel.ai/v1")
        .build();

    ChatCompletionCreateParams params = ChatCompletionCreateParams.builder()
        .model("gemini-2.5-flash-image")
        .addUserMessage("Generate a futuristic cyberpunk city at night.")
        .build();

    ChatCompletion completion = client.chat().completions().create(params);
    System.out.println(completion.choices().get(0).message().content().orElse(""));
  }
}`,
  },
  {
    key: 'Swift',
    language: 'swift',
    code: `import Foundation

var request = URLRequest(url: URL(string: "https://webchannel.ai/v1/chat/completions")!)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")

let body: [String: Any] = [
  "model": "gemini-2.5-flash-image",
  "messages": [
    ["role": "user", "content": "Generate a futuristic cyberpunk city at night."]
  ],
]
request.httpBody = try JSONSerialization.data(withJSONObject: body)

let (data, _) = try await URLSession.shared.data(for: request)
print(String(data: data, encoding: .utf8) ?? "")`,
  },
  {
    key: 'Go',
    language: 'go',
    code: `package main

import (
	"context"
	"fmt"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

func main() {
	client := openai.NewClient(
		option.WithAPIKey("YOUR_API_KEY"),
		option.WithBaseURL("https://webchannel.ai/v1"),
	)

	resp, err := client.Chat.Completions.New(context.TODO(),
		openai.ChatCompletionNewParams{
			Model: "gemini-2.5-flash-image",
			Messages: []openai.ChatCompletionMessageParamUnion{
				openai.UserMessage("Generate a futuristic cyberpunk city at night."),
			},
		},
	)
	if err != nil {
		panic(err)
	}

	fmt.Println(resp.Choices[0].Message.Content)
}`,
  },
  {
    key: 'PHP',
    language: 'php',
    code: `<?php

$payload = [
    'model' => 'gemini-2.5-flash-image',
    'messages' => [
        [
            'role' => 'user',
            'content' => 'Generate a futuristic cyberpunk city at night.',
        ],
    ],
];

$ch = curl_init('https://webchannel.ai/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer YOUR_API_KEY',
    ],
    CURLOPT_POSTFIELDS => json_encode($payload),
]);

$response = curl_exec($ch);
curl_close($ch);

echo $response;`,
  },
  {
    key: 'Python',
    language: 'python',
    code: `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://webchannel.ai/v1",
)

response = client.chat.completions.create(
    model="gemini-2.5-flash-image",
    messages=[
        {
            "role": "user",
            "content": "Generate a futuristic cyberpunk city at night.",
        }
    ],
)

print(response.choices[0].message.content)`,
  },
  {
    key: 'HTTP',
    language: 'http',
    code: `POST /v1/chat/completions HTTP/1.1
Host: webchannel.ai
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "model": "gemini-2.5-flash-image",
  "messages": [
    {
      "role": "user",
      "content": "Generate a futuristic cyberpunk city at night."
    }
  ]
}`,
  },
  {
    key: 'C',
    language: 'c',
    code: `#include <stdio.h>
#include <curl/curl.h>

int main(void) {
  CURL *curl = curl_easy_init();
  if (!curl) return 1;

  const char *payload =
      "{\\"model\\":\\"gemini-2.5-flash-image\\","
      "\\"messages\\":[{\\"role\\":\\"user\\","
      "\\"content\\":\\"Generate a futuristic cyberpunk city at night.\\"}]}";

  struct curl_slist *headers = NULL;
  headers = curl_slist_append(headers, "Content-Type: application/json");
  headers = curl_slist_append(headers, "Authorization: Bearer YOUR_API_KEY");

  curl_easy_setopt(curl, CURLOPT_URL, "https://webchannel.ai/v1/chat/completions");
  curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
  curl_easy_setopt(curl, CURLOPT_POSTFIELDS, payload);

  CURLcode res = curl_easy_perform(curl);
  if (res != CURLE_OK)
    fprintf(stderr, "request failed: %s\\n", curl_easy_strerror(res));

  curl_slist_free_all(headers);
  curl_easy_cleanup(curl);
  return 0;
}`,
  },
  {
    key: 'C#',
    language: 'csharp',
    code: `using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;

var client = new HttpClient();
client.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", "YOUR_API_KEY");

var payload = """
{
  "model": "gemini-2.5-flash-image",
  "messages": [
    { "role": "user", "content": "Generate a futuristic cyberpunk city at night." }
  ]
}
""";

var response = await client.PostAsync(
    "https://webchannel.ai/v1/chat/completions",
    new StringContent(payload, Encoding.UTF8, "application/json"));

Console.WriteLine(await response.Content.ReadAsStringAsync());`,
  },
  {
    key: 'Objective-C',
    language: 'objective-c',
    code: `#import <Foundation/Foundation.h>

int main(void) {
  @autoreleasepool {
    NSURL *url = [NSURL URLWithString:@"https://webchannel.ai/v1/chat/completions"];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    request.HTTPMethod = @"POST";
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    [request setValue:@"Bearer YOUR_API_KEY" forHTTPHeaderField:@"Authorization"];

    NSDictionary *payload = @{
      @"model" : @"gemini-2.5-flash-image",
      @"messages" : @[
        @{@"role" : @"user",
          @"content" : @"Generate a futuristic cyberpunk city at night."}
      ]
    };
    request.HTTPBody = [NSJSONSerialization dataWithJSONObject:payload
                                                       options:0
                                                         error:nil];

    dispatch_semaphore_t sema = dispatch_semaphore_create(0);
    NSURLSessionDataTask *task = [[NSURLSession sharedSession]
        dataTaskWithRequest:request
          completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
            NSLog(@"%@", [[NSString alloc] initWithData:data
                                               encoding:NSUTF8StringEncoding]);
            dispatch_semaphore_signal(sema);
          }];
    [task resume];
    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
  }
  return 0;
}`,
  },
  {
    key: 'Ruby',
    language: 'ruby',
    code: `require "json"
require "net/http"
require "uri"

uri = URI("https://webchannel.ai/v1/chat/completions")

request = Net::HTTP::Post.new(uri)
request["Content-Type"] = "application/json"
request["Authorization"] = "Bearer YOUR_API_KEY"
request.body = JSON.generate({
  model: "gemini-2.5-flash-image",
  messages: [
    { role: "user", content: "Generate a futuristic cyberpunk city at night." }
  ]
})

response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
  http.request(request)
end

puts response.body`,
  },
] as const

function CodeShowcase() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
  const { copiedText, copyToClipboard } = useCopyToClipboard()
  const activeSnippet = codeSnippets[activeIndex]

  useEffect(() => {
    let cancelled = false
    setHighlightedHtml(null)
    codeToHtml(activeSnippet.code, {
      lang: activeSnippet.language,
      theme: 'github-light',
    })
      .then((html) => {
        if (!cancelled) {
          setHighlightedHtml(html)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlightedHtml(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeSnippet])

  return (
    <div className='flex h-full flex-col bg-white'>
      <div className='flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3'>
        <div className='flex flex-wrap items-center gap-2'>
          {codeSnippets.map((snippet, index) => (
            <button
              key={snippet.key}
              type='button'
              onClick={() => setActiveIndex(index)}
              className={`rounded-none border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                index === activeIndex
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {snippet.key}
            </button>
          ))}
        </div>
        <button
          type='button'
          aria-label='Copy code'
          onClick={() => copyToClipboard(activeSnippet.code)}
          className='flex size-8 shrink-0 items-center justify-center rounded-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900'
        >
          {copiedText === activeSnippet.code ? (
            <Check className='size-4 text-emerald-500' />
          ) : (
            <Copy className='size-4' />
          )}
        </button>
      </div>
      <div className='code-showcase min-h-0 flex-1 overflow-y-auto overflow-x-auto bg-[#fafafa] p-4'>
        {highlightedHtml ? (
          <div
            className='font-mono text-[13px] leading-6 [&_pre]:!bg-transparent [&_pre]:whitespace-pre'
            // eslint-disable-next-line react/no-danger -- shiki output is generated from local constants
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className='font-mono text-[13px] leading-6 whitespace-pre text-slate-800'>
            {activeSnippet.code}
          </pre>
        )}
      </div>
    </div>
  )
}

const letterParagraphs = [
  'What is truly hard is not calling a model once, but bringing model capabilities into real products in a stable, controllable, and billable way.',
  'WebChannel aims to bring complex provider integration, key management, routing policies, log tracing, and cost governance together into one clear entry point.',
  'You focus on building products; we make sure model capabilities arrive reliably.',
] as const

export function Features(props: FeaturesProps) {
  const { t } = useTranslation()

  return (
    <section
      className={`relative z-10 bg-[#f7f7f5] px-5 py-20 text-slate-950 sm:px-6 md:py-28 ${props.className ?? ''}`}
    >
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-20 flex flex-col items-center text-center'>
          <p className='mb-3 text-xs font-bold tracking-[0.22em] text-orange-500 uppercase'>
            {t('Advantages')}
          </p>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-5xl'>
            {t('One key to call all AI models')}
          </h2>
          <p className='mt-5 max-w-2xl text-sm leading-7 text-slate-600 md:text-base'>
            <span className='font-semibold text-purple-500'>Webchannel</span>
            {t('provides you with the most stable and comprehensive models')}
          </p>
          <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
            <Link
              to='/sign-up'
              className='inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-slate-800'
            >
              {t('Start Integrating')}
              <ArrowRight className='size-4' />
            </Link>
            <Link
              to='/pricing'
              className='inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50'
            >
              {t('View Models')}
            </Link>
          </div>
        </AnimateInView>

        <AnimateInView className='h-[410px] overflow-hidden rounded-none border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:h-[460px]'>
          <CodeShowcase />
        </AnimateInView>
      </div>

      <AnimateInView className='relative -mx-5 mt-24 overflow-hidden border-y border-slate-200 shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:-mx-6'>
        <img
          src='/landing/random/1.png'
          alt='WebChannel letter'
          className='absolute inset-0 size-full object-cover'
        />
        <div className='absolute inset-0 bg-slate-950/40' />
        <div className='relative flex flex-col items-center px-6 py-16 text-center sm:px-10 md:py-24'>
          <h2 className='max-w-2xl text-3xl leading-tight font-bold tracking-tight text-white drop-shadow-md md:text-4xl'>
            {t('To everyone building AI products')}
          </h2>
          <div className='mt-8 max-w-2xl space-y-6 text-sm leading-7 text-slate-100/90 md:text-base'>
            {letterParagraphs.map((paragraph) => (
              <p key={paragraph}>{t(paragraph)}</p>
            ))}
          </div>
          <p className='mt-9 text-sm font-semibold text-white'>
            WebChannel Team
          </p>
        </div>
      </AnimateInView>
    </section>
  )
}
