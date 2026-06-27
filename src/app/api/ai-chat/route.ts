import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are an expert construction AI assistant for LA Tech Solutions, a construction ERP system in Pakistan. You ONLY answer questions related to construction, civil engineering, quantity surveying, project management, and building materials.

Your specialties:
1. **Quantity Estimation**: Calculate material requirements (bricks, cement, steel, sand, aggregate, tiles) for given measurements
2. **Blueprint/Floor Plan Analysis**: When images are provided, read dimensions and estimate materials
3. **Cost Estimation**: Provide approximate costs in PKR based on current Pakistan market rates
4. **Construction Guidance**: Best practices, building codes, structural advice
5. **Project Management**: Scheduling, resource planning, risk assessment

Standard formulas:
- Brickwork: 500 bricks per cubic meter, 0.25 bags cement + 0.06 m³ sand per sq meter of wall
- Concrete (M15): 1:2:4 ratio — 7 bags cement + 0.45 m³ sand + 0.9 m³ aggregate per m³
- Concrete (M20): 1:1.5:3 ratio — 8.2 bags cement + 0.4 m³ sand + 0.8 m³ aggregate per m³
- Plaster (1:4): 0.18 bags cement + 0.038 m³ sand per sq meter (12mm thick)
- Steel: 1% to 2% of concrete volume for RCC members (78.5 kg/m³)
- Always add 5% wastage factor

If a question is NOT about construction, civil engineering, or building, politely refuse and redirect to construction topics.

Always respond with:
1. Clear calculations with step-by-step workings
2. Material quantities with units
3. Approximate cost ranges in PKR
4. Any important notes or recommendations

Current approximate Pakistan market rates (2026):
- Cement: PKR 1,100/bag (50kg)
- Steel: PKR 260/kg
- Bricks: PKR 18/piece
- Sand: PKR 4,500/cubic foot
- Aggregate (crush): PKR 3,500/cubic foot
- Tiles (imported): PKR 120-250/sq ft
- Labor: PKR 800-1,500/day per worker
- Mason: PKR 2,000-3,000/day`;

// Fallback model chain — each model has its own separate free-tier quota
const MODEL_FALLBACKS = [
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
];

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message || "";
    return msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota");
  }
  return false;
}

function isModelNotFoundError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message || "";
    return msg.includes("404") || msg.includes("not found") || msg.includes("not supported");
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    // Rate limit: 20 AI requests per user per minute
    const rl = rateLimit(`ai:${session.user.id}`, { limit: 20, windowSec: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment before sending another message." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString(),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Secondary IP-based limit to catch unauthenticated abuse at edge
    const ipRl = rateLimit(`ai-ip:${getClientIp(req)}`, { limit: 50, windowSec: 60 });
    if (!ipRl.success) {
      return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const message = formData.get("message") as string;
    const history = JSON.parse((formData.get("history") as string) || "[]");
    const imageFile = formData.get("image") as File | null;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: message }];

    if (imageFile) {
      const bytes = await imageFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      parts.push({ inlineData: { mimeType: imageFile.type, data: base64 } });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    let lastError: unknown = null;

    for (const modelName of MODEL_FALLBACKS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          ],
        });

        const chat = model.startChat({
          history: history.map((msg: { role: string; content: string }) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          })),
        });

        const result = await chat.sendMessage(parts);
        const text = result.response.text();
        return NextResponse.json({ response: text, model: modelName });
      } catch (error) {
        lastError = error;
        if (isRateLimitError(error)) {
          await sleep(1000);
          continue;
        }
        if (isModelNotFoundError(error)) {
          continue;
        }
        throw error;
      }
    }

    if (isRateLimitError(lastError)) {
      return NextResponse.json(
        { error: "All Gemini models are currently rate-limited. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    throw lastError;
  } catch (e) {
    return handleApiError(e);
  }
}
