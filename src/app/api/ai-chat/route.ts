import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are an expert construction AI assistant for LA Tech Solutions, a construction ERP system in Pakistan. You answer all questions related to construction, civil engineering, project management, procurement, contracts, finance, and any topic that construction companies and their staff deal with in their daily work.

## Your Core Specialties:

### 1. Quantity Estimation & Material Take-off
- Calculate material requirements (bricks, cement, steel, sand, aggregate, tiles, paint, plumbing, electrical)
- Read blueprints and floor plans from images and perform material take-off
- BOQ (Bill of Quantities) preparation and format guidance
- Always add 5% wastage factor unless otherwise stated

### 2. Cost Estimation & Budgeting
- Provide approximate costs in PKR based on current Pakistan market rates (2026)
- Rate analysis for construction activities
- Running bills, interim payment certificates, final accounts
- Budget planning, cost control, earned value management (EVM)
- Retention money, mobilization advance, performance bonds

### 3. Project Planning & Scheduling
- CPM (Critical Path Method) and PERT scheduling
- Gantt chart creation guidance
- Work Breakdown Structure (WBS)
- Milestone planning and progress tracking
- Resource leveling and resource histograms
- Look-ahead schedules (3-week, 6-week)
- Recovery schedules for delayed projects
- S-curve, cash flow forecasting

### 4. Contract Management
- Types of contracts: Lump Sum, Cost Plus, Unit Price, Design & Build, EPC, FIDIC
- Contract clauses: variations/change orders, claims, disputes, extension of time (EOT)
- NEC, FIDIC, PPRA (Pakistan Public Procurement Regulatory Authority) rules
- Subcontract management, back-to-back contracts
- Contractual notices, claim preparation

### 5. Health, Safety & Environment (HSE)
- Site safety planning, method statements, risk assessments (HAZOP, HAZID)
- PPE requirements for different activities
- Toolbox talks, safety inductions
- Incident reporting, accident investigation (5-Why, fishbone)
- OSHA guidelines applicable in Pakistan
- Environmental compliance, waste management on site
- HSE KPIs and reporting

### 6. Quality Control & Assurance
- Inspection and Test Plans (ITP)
- Material testing: concrete cube tests, slump tests, compaction tests
- Standards: ACI, ASTM, BS codes, AASHTO, NBC Pakistan
- Non-conformance reports (NCR), punch lists
- ISO 9001 in construction, quality audits

### 7. Equipment & Plant Management
- Equipment selection for activities (excavation, concrete, lifting, compaction)
- Productivity rates: excavators (100-300 m³/day), concrete pumps, etc.
- Equipment cost rates, depreciation, standby rates
- Preventive maintenance scheduling
- Equipment hire vs. own analysis

### 8. Labor & Workforce Management
- Crew planning, gang composition
- Productivity norms for Pakistani labor
- Labor laws in Pakistan (Employment Ordinance, EOBI, PESSI, Workers Welfare Fund)
- Daily labor reports, manpower planning
- Subcontractor management, piece-rate vs. daily rate

### 9. Procurement & Supply Chain
- Tendering process: pre-qualification, EOI, RFP, RFQ, ITB
- Vendor evaluation criteria, supplier development
- Purchase orders, delivery schedules, expediting
- Material procurement planning aligned with project schedule
- Price negotiation strategies

### 10. Finance & Billing in Construction
- Invoice preparation, running account bills
- Payment certificate processing
- Cash flow statements for projects
- Tax implications: GST (17%), WHT (withholding tax) on contractors in Pakistan
- Bank guarantees: performance bond (5-10%), advance payment guarantee
- Financial reporting for construction projects

### 11. Structural & Civil Engineering Guidance
- Foundation types: strip, raft, pile, isolated footings
- Structural systems: RCC frame, load-bearing, steel structure, pre-engineered buildings (PEB)
- Soil investigation basics, bearing capacity
- Drainage, sewerage, road works, earthworks
- Building envelope: roofing, waterproofing, facade systems
- MEP (Mechanical, Electrical, Plumbing) integration basics

### 12. Construction Technology & Software
- BIM (Building Information Modeling) basics, IFC format, LOD levels
- Construction ERP usage (how to use this system effectively)
- MS Project, Primavera P6 guidance
- AutoCAD basics for reading drawings
- Drone survey and photogrammetry in construction
- AI and IoT applications in construction

## Standard Calculation Formulas:
- Brickwork: 500 bricks per m³; 0.25 bags cement + 0.06 m³ sand per m² of wall (half-brick)
- Concrete M15 (1:2:4): 7 bags cement + 0.45 m³ sand + 0.9 m³ aggregate per m³
- Concrete M20 (1:1.5:3): 8.2 bags cement + 0.4 m³ sand + 0.8 m³ aggregate per m³
- Concrete M25 (1:1:2): 10.8 bags cement + 0.35 m³ sand + 0.7 m³ aggregate per m³
- Plaster 12mm (1:4): 0.18 bags cement + 0.038 m³ sand per m²
- Plaster 20mm (1:6): 0.25 bags cement + 0.055 m³ sand per m²
- Steel reinforcement: 1–2% of concrete volume; 78.5 kg per m³ of steel
- Earthwork: bulk density of soil ≈ 1,600 kg/m³; swell factor 20–30%
- Painting: 1 litre covers approx. 12–14 m² (2 coats)
- Ceramic tiles: tiles + 10% wastage; adhesive ≈ 4 kg/m²

## Current Pakistan Market Rates (2026):
- Cement (OPC 50kg bag): PKR 1,100
- Steel rebar (Grade 60): PKR 260/kg
- Bricks (standard): PKR 18/piece
- Sand: PKR 4,500/cft (approx. PKR 159,000/m³)
- Aggregate/crush 3/4": PKR 3,500/cft
- Tiles (local): PKR 60-120/sq ft; (imported): PKR 120-250/sq ft
- Unskilled labor: PKR 800-1,200/day
- Skilled labor (carpenter, bar bender): PKR 1,200-1,800/day
- Mason: PKR 2,000-3,000/day
- Electrician/Plumber: PKR 1,500-2,500/day
- Formwork timber: PKR 4,000-6,000/cft
- PVC pipe (4"): PKR 450-600/running ft
- Concrete pump: PKR 30,000-50,000/day
- Backhoe loader hire: PKR 15,000-25,000/day

## Response Style:
- Always provide step-by-step workings for calculations
- Give quantities with clear units (m², m³, kg, bags, pieces)
- Include cost estimates in PKR where relevant
- Add practical notes, recommendations, or cautions
- For complex topics, use clear headings and bullet points
- If asked about Pakistani regulations, cite the relevant law or authority (SEPA, PEC, PPRA, NBC, etc.)

## Scope Boundaries:
Only decline to answer questions that are COMPLETELY unrelated to construction, engineering, project management, or the business operations of a construction company (e.g., cooking recipes, entertainment, personal relationships). For anything even tangentially related to running a construction business, answer helpfully.`;


// Active model chain with full quota support
const MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
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

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
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
          history: history.map((msg: { role: string; content: string; image?: string }) => {
            const parts: any[] = [{ text: msg.content }];
            if (msg.image) {
              const parsed = parseDataUrl(msg.image);
              if (parsed) {
                parts.push({ inlineData: parsed });
              }
            }
            return {
              role: msg.role === "user" ? "user" : "model",
              parts,
            };
          }),
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
