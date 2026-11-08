
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

    const model = "gemini-3.8-flash";

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    let response;
    let data;

    // Maksimal 3 kali percobaan
    for (let attempt = 1; attempt <= 3; attempt++) {
      response = await fetch(endpoint, {
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
            responseMimeType: "application/json",
            maxOutputTokens: 8192
          }
        })
      });

      const raw = await response.text();

      try {
        data = JSON.parse(raw);
      } catch {
        data = {
          error: {
            message: "Respons Gemini bukan JSON."
          }
        };
      }

      // Jika berhasil, hentikan percobaan
      if (response.ok) {
        break;
      }

      // Ulangi hanya untuk error sementara
      const retryable = [429, 500, 503, 504];

      if (!retryable.includes(response.status)) {
        break;
      }

      if (attempt === 3) {
        break;
      }

      console.log(
        `Gemini error ${response.status}. Percobaan ${attempt}/3`
      );

      // Jeda sebelum mencoba kembali
      await new Promise(resolve =>
        setTimeout(resolve, attempt * 1500)
      );
    }

    if (!response.ok) {
      console.error("Gemini API error:", data.error);

      return res.status(502).json({
        error:
          data.error?.message ||
          `Gemini gagal memproses permintaan. HTTP ${response.status}`
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
      error: "Terjadi kesalahan pada server: " + error.message
    });
  }
}
