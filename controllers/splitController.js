import fs from "fs";
import axios from "axios";
import FormData from "form-data";

console.log("Split Controller - API Keys loaded:", {
  hasApiKey: !!process.env.API_KEY,
  hasApiSecret: !!process.env.API_SECRET
});

export const splitPDF = async (req, res) => {
  try {
    console.log("Split PDF request received");
    
    if (!req.file) {
      return res.status(400).json({ error: "File missing!" });
    }

    const { pages } = req.body;
    
    if (!pages) {
      return res.status(400).json({ error: "Pages parameter is required!" });
    }

    console.log("File received:", {
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    });
    console.log("Pages to extract:", pages);
    
    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);
    
    const formData = new FormData();
    formData.append("file", fileBuffer, req.file.originalname);
    formData.append("pages", pages);
    
    console.log("Sending to RobotPDF Split API...");
    
    const headers = {
      "x-api-key": process.env.API_KEY,
      "x-api-secret": process.env.API_SECRET,
      ...formData.getHeaders()
    };
    
    const response = await axios.post(
      "https://api.robotpdf.com/api/v1/split",
      formData,
      {
        headers,
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    console.log("RobotPDF Split response received, page_count:", response.data?.data?.page_count);
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    // Extract result from response - API returns base64 data
    const apiData = response.data.data || response.data;
    // The API returns a ZIP file containing individual split PDFs
    const originalName = req.file.originalname.replace('.pdf', '');
    const result = {
      fileBase64: apiData.file_base64 || "",
      fileName: `${originalName}_split.zip`,
      pageCount: apiData.page_count || 0,
      fileSize: apiData.file_size || 0,
    };
    
    console.log("Sending result with base64 length:", result.fileBase64?.length);

    res.status(200).json(result);
  } catch (error) {
    console.error("Split Error Details:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Clean up file on error
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    let errorMessage = error?.response?.data?.message || 
                       error?.response?.data?.error || 
                       error.message || 
                       "RobotPDF API error";
    
    // Provide helpful messages for common errors
    if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT") || error.response?.status === 504) {
      errorMessage = "Request timed out. The file may be too large or the server is busy. Please try again.";
    } else if (error.response?.status === 503) {
      errorMessage = "RobotPDF service is temporarily unavailable. Please try again later.";
    } else if (error.response?.status === 400) {
      errorMessage = errorMessage || "Invalid page range or file format.";
    }
    
    res.status(error.response?.status || 500).json({
      error: "Split failed",
      message: errorMessage
    });
  }
};
