import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";

interface Env {
  EVREN_API_KEY: string;
}

const EVREN_BASE_URL = "https://evren-llmapi.ssyz.org.tr";

function createServer(env: Env) {
  const server = new McpServer({
    name: "EVREN MCP",
    version: "1.0.0",
  });

  server.registerTool(
    "evren_models",
    {
      description:
        "EVREN üzerinde kullanılabilen yapay zeka modellerini listeler.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const response = await fetch(`${EVREN_BASE_URL}/v1/models`, {
          headers: {
            Authorization: `Bearer ${env.EVREN_API_KEY}`,
          },
        });

        const text = await response.text();

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `EVREN API hatası (${response.status}): ${text}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `EVREN bağlantı hatası: ${String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "evren_chat",
    {
      description:
        "EVREN üzerinden bir yapay zeka modeline mesaj gönderir ve cevabını getirir.",
      inputSchema: z.object({
        message: z.string().describe("EVREN'e gönderilecek mesaj"),
        model: z
          .string()
          .optional()
          .describe("EVREN model adı. Belirtilmezse auto kullanılır."),
        max_tokens: z
          .number()
          .int()
          .min(1)
          .max(32768)
          .optional()
          .describe("Maksimum cevap token sayısı"),
      }),
    },
    async ({ message, model, max_tokens }) => {
      try {
        const response = await fetch(
          `${EVREN_BASE_URL}/v1/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.EVREN_API_KEY}`,
            },
            body: JSON.stringify({
              model: model || "auto",
              messages: [
                {
                  role: "user",
                  content: message,
                },
              ],
              max_tokens: max_tokens || 4096,
              stream: false,
            }),
          }
        );

        const text = await response.text();

        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: `EVREN API hatası (${response.status}): ${text}`,
              },
            ],
            isError: true,
          };
        }

        let answer = text;

        try {
          const data: any = JSON.parse(text);

          answer =
            data?.choices?.[0]?.message?.content ||
            data?.choices?.[0]?.message?.reasoning_content ||
            text;
        } catch {}

        return {
          content: [
            {
              type: "text",
              text: answer,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `EVREN bağlantı hatası: ${String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const handler = createMcpHandler(createServer(env));
    return handler(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
