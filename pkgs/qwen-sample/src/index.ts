import { Agent, MCPServerStdio, OpenAIProvider, run, setOpenAIAPI, withTrace } from "@openai/agents";
import dotenv from "dotenv";

dotenv.config();

setOpenAIAPI("chat_completions");

/**
 * メイン関数
 */
async function main() {
  // MCPサーバーを起動
  const mcpServer = new MCPServerStdio({
    name: "x402 MCP Server",
    command: "node",
    args: ["./../mcp/dist/index.js"],
    env: {
      PRIVATE_KEY: process.env.PRIVATE_KEY || "",
      RESOURCE_SERVER_URL: process.env.RESOURCE_SERVER_URL || "",
      ENDPOINT_PATH: process.env.ENDPOINT_PATH || "",
    },
  });

  await mcpServer.connect();

  try {
    await withTrace("x402 MCP", async () => {
      // カスタムモデルプロバイダーを作成
      const provider = new OpenAIProvider({
        apiKey: process.env.DASHSCOPE_API_KEY || "",
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      });
      // エージェントを作成
      const agent = new Agent({
        name: "Assistant",
        instructions:
          "ツールを使ってステーブルコイン決済を行い、天気予報情報をユーザーに返却してください！",
        mcpServers: [mcpServer],
        model: await provider.getModel("qwen3-vl-32b-instruct"),
      });

      let message = "天気予報を教えて！";
      console.log(`実行中: ${message}`);
      // エージェントを実行
      let result = await run(agent, message);
      console.log(result.finalOutput ?? result.output ?? result);
    });
  } finally {
    await mcpServer.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
