import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export const extractTextFromFile = async (req) => {
  try {
    const fileBuffer = req.file?.buffer;

    if (!fileBuffer) {
      throw new Error("File buffer missing — ensure multer upload.single('resume') is active");
    }

    const data = await pdfParse(fileBuffer);
    return data.text;
  } catch (err) {
    console.error("PDF Extract Error:", err);
    return "";
  }
};
