import OpenAI from "openai";

/**
 * メイン関数
 */
async function main() {
  // OpenAIインスタンス化
  const openai = new OpenAI({
    // If the environment variable is not set, replace it with your Model Studio API key: apiKey: "sk-xxx"
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  });

  // AIに推論させる
  const response = await openai.chat.completions.create({
    model: "qwen3-vl-32b-instruct",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20241108/ctdzex/biaozhun.jpg",
            },
          },
          {
            type: "text",
            text: "Output the text in the image only and please in japanese.",
          },
        ],
      },
    ],
  });
  console.log(response.choices[0].message.content);
}

main();
