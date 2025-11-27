import fs from "fs";
import axios from "axios";
import FormData from "form-data";

console.log("API Keys loaded:", {
  hasApiKey: !!process.env.API_KEY,
  hasApiSecret: !!process.env.API_SECRET
});

export const runOCR = async (req, res) => {
  try {
    console.log("OCR request received");
    
    if (!req.file) {
      return res.status(400).json({ error: "File missing!" });
    }

    console.log("File received:", {
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });
    
    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    
    // Ensure correct mimetype for PDFs
    let mimeType = req.file.mimetype;
    if (req.file.originalname.toLowerCase().endsWith('.pdf') && mimeType !== 'application/pdf') {
      mimeType = 'application/pdf';
    }
    
    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: req.file.originalname,
      contentType: mimeType,
      knownLength: fileBuffer.length
    });
    formData.append("language", "eng");
    
    console.log("Sending file:", {
      filename: req.file.originalname,
      contentType: mimeType,
      size: fileBuffer.length,
      bufferType: typeof fileBuffer,
      isBuffer: Buffer.isBuffer(fileBuffer)
    });

    console.log("Sending to RobotPDF API with keys:", {
      hasKey: !!process.env.API_KEY,
      hasSecret: !!process.env.API_SECRET,
      keyPrefix: process.env.API_KEY?.substring(0, 10)
    });
    
    const headers = {
      "x-api-key": process.env.API_KEY,
      "x-api-secret": process.env.API_SECRET,
      ...formData.getHeaders()
    };
    
    console.log("Request headers:", Object.keys(headers));
    
    const response = await axios.post(
      "https://api.robotpdf.com/api/v1/ocr",
      formData,
      {
        headers,
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log("RobotPDF response:", JSON.stringify(response.data, null, 2));
    
    fs.unlinkSync(filePath);
    
    // Extract text from nested data object
    const apiData = response.data.data || response.data;
    const result = {
      text: apiData.text || "",
      confidence: apiData.confidence,
      language: apiData.language,
      page_count: apiData.page_count
    };
    
    console.log("Sending result:", result);

    res.status(200).json(result);
  } catch (error) {
    console.error("OCR Error Details:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    if (req.file?.path) {
      fs.unlinkSync(req.file.path);
    }
    
    let errorMessage = error?.response?.data?.message || 
                       error?.response?.data?.error || 
                       error.message || 
                       "RobotPDF API error";
    
    // Provide helpful message for common errors
    if (errorMessage.includes("OCR failed for all image enhancement versions")) {
      errorMessage = "Unable to extract text from this PDF. The document may be empty, corrupted, or contain only images without readable text.";
    } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT") || errorMessage.includes("UND_ERR_HEADERS_TIMEOUT") || error.response?.status === 504) {
      errorMessage = "Request timed out. The file may be too large or the RobotPDF server is busy. Please try with a smaller file or try again later.";
    } else if (error.response?.status === 503) {
      errorMessage = "RobotPDF service is temporarily unavailable. Please try again later.";
    }
    
    res.status(error.response?.status || 500).json({
      error: "OCR failed",
      message: errorMessage
    });
  }
};
