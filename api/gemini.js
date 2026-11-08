
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method tidak diizinkan."
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API Key Gemini belum dikonfigurasi."
      });
    }

    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Prompt tidak valid."
      });
    }

    if (prompt.length > 100000) {
      return res.status(413).json({
        error: "Materi terlalu panjang."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data.error);

      return res.status(502).json({
        error: data.error?.message ||
          "Gemini gagal memproses permintaan."
      });
    }

    const output = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("");

    if (!output) {
      return res.status(502).json({
        error: "Gemini tidak memberikan jawaban."
      });
    }

    let result;

    try {
      result = JSON.parse(output);
    } catch {
      return res.status(502).json({
        error: "Format jawaban AI tidak valid."
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "Terjadi kesalahan pada server."
    });
  }
}
