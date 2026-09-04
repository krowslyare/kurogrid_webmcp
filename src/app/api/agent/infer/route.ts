import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string; defaultDate?: string };
    const text = body.text?.trim();
    const defaultDate = body.defaultDate;

    if (!text) {
      return NextResponse.json({ error: "missing_text" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const petName = text.toLowerCase().includes("max") ? "Max" : "Luna";
      return NextResponse.json({
        petName,
        serviceSlug: "dermatology",
        date: defaultDate,
        summary: `Appointment for ${petName}`,
        model: "heuristic-fallback",
      });
    }

    const prompt = `You are the AI Assistant for Mimo Veterinary Care.
Analyze the user booking request: "${text}".
Available clinic services:
- "dermatology" (skin issues, rash, itching, allergies, fur loss, dermatología)
- "vaccination" (vaccines, shots, rabies, parvovirus, vacunas)
- "general-consultation" (routine checkup, exam, wellness, sick visit, general health, chequeo general)

Return strictly valid JSON with these fields:
{
  "petName": string,
  "serviceSlug": "dermatology" | "vaccination" | "general-consultation",
  "date": string | null,
  "summary": string
}
Rules:
- If no pet name is explicitly stated or can be inferred, default petName to "Luna".
- If no specific service is mentioned, default serviceSlug to "dermatology".
- Do not output markdown, fences, or commentary. Output raw JSON only.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      console.warn("Gemini API returned status:", geminiRes.status);
      const petName = text.toLowerCase().includes("max") ? "Max" : "Luna";
      return NextResponse.json({
        petName,
        serviceSlug: "dermatology",
        date: defaultDate,
        summary: `Appointment for ${petName}`,
        model: "heuristic-fallback",
      });
    }

    const data = (await geminiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) {
      throw new Error("Empty response from Gemini");
    }

    const parsed = JSON.parse(rawJson) as {
      petName?: string;
      serviceSlug?: string;
      date?: string | null;
      summary?: string;
    };

    const validServices = ["dermatology", "vaccination", "general-consultation"];
    const serviceSlug = typeof parsed.serviceSlug === "string" && validServices.includes(parsed.serviceSlug)
      ? parsed.serviceSlug
      : "dermatology";
    const petName = typeof parsed.petName === "string" && parsed.petName.trim()
      ? parsed.petName.trim()
      : "Luna";

    return NextResponse.json({
      petName,
      serviceSlug,
      date: parsed.date ?? defaultDate,
      summary: parsed.summary ?? `${serviceSlug} appointment for ${petName}`,
      model: "gemini-3.8-flash",
    });
  } catch (err: unknown) {
    console.error("Agent inference error:", err);
    return NextResponse.json({
      petName: "Luna",
      serviceSlug: "dermatology",
      summary: "Dermatology appointment for Luna",
      model: "error-fallback",
    });
  }
}
