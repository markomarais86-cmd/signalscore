import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractTextFromXml(xml: string): string {
  const texts: string[] = [];
  // Match all <a:t>...</a:t> tags (PowerPoint text nodes)
  const regex = /<a:t>([\s\S]*?)<\/a:t>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    texts.push(match[1]);
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

async function parsePptx(data: Uint8Array): Promise<{ text: string; pages: number }> {
  const zip = await JSZip.loadAsync(data);
  const slideFiles: string[] = [];

  zip.forEach((path: string) => {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
      slideFiles.push(path);
    }
  });

  // Sort slides numerically
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
    return numA - numB;
  });

  const slideTexts: string[] = [];
  for (const slidePath of slideFiles) {
    const xml = await zip.file(slidePath)!.async("string");
    const text = extractTextFromXml(xml);
    if (text) {
      slideTexts.push(text);
    }
  }

  return {
    text: slideTexts.join("\n\n"),
    pages: slideFiles.length,
  };
}

async function parsePdf(data: Uint8Array): Promise<{ text: string; pages: number }> {
  // Use pdf-parse via npm
  const pdfParse = (await import("npm:pdf-parse@1.1.1")).default;
  const result = await pdfParse(Buffer.from(data));
  return {
    text: result.text || "",
    pages: result.numpages || 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "Expected multipart/form-data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    let result: { text: string; pages: number };
    let format: string;

    if (fileName.endsWith(".pptx") || fileName.endsWith(".ppt")) {
      format = "pptx";
      result = await parsePptx(data);
    } else if (fileName.endsWith(".pdf")) {
      format = "pdf";
      result = await parsePdf(data);
    } else {
      // Plain text fallback
      format = "text";
      const text = new TextDecoder().decode(data);
      result = { text, pages: 1 };
    }

    if (!result.text.trim()) {
      return new Response(
        JSON.stringify({
          error: "No text could be extracted from this file. It may be image-based or encrypted. Try pasting the content directly.",
          format,
          pages: result.pages,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        text: result.text,
        pages: result.pages,
        format,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("parse-document error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to parse document" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
