import fs from "fs";
import axios from "axios";
import FormData from "form-data";

console.log("PDF to Excel Controller - API Keys loaded:", {
  hasApiKey: !!process.env.API_KEY,
  hasApiSecret: !!process.env.API_SECRET
});

export const convertPDFToExcel = async (req, res) => {
  const file = req.file;
  
  try {
    console.log("PDF to Excel request received");
    
    // Validate file
    if (!file) {
      return res.status(400).json({ 
        success: false,
        error: "A PDF file is required" 
      });
    }

    // Check file size (50MB limit for single file)
    if (file.size > 50 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false,
        error: "File size exceeds 50MB limit" 
      });
    }

    console.log("File received:", {
      name: file.originalname,
      size: file.size,
      path: file.path,
      mimetype: file.mimetype
    });

    // Create form data for API request
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(file.path);
    formData.append("file", fileBuffer, file.originalname);

    console.log("Sending to RobotPDF PDF to Excel API...");

    const headers = {
      "x-api-key": process.env.API_KEY,
      "x-api-secret": process.env.API_SECRET,
      ...formData.getHeaders()
    };

    const response = await axios.post(
      "https://api.robotpdf.com/api/v1/convert/pdf-to-excel",
      formData,
      {
        headers,
        timeout: 180000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        responseType: 'arraybuffer'
      }
    );

    console.log("RobotPDF PDF to Excel response received");
    console.log("Response content-type:", response.headers['content-type']);

    // Clean up uploaded file
    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      console.error("Error deleting temp file:", err);
    }

    const contentType = response.headers['content-type'] || '';
    let result;

    if (contentType.includes('application/json')) {
      // API returned JSON (possibly with base64)
      const jsonData = JSON.parse(response.data.toString());
      const apiData = jsonData.data || jsonData;
      result = {
        success: true,
        fileBase64: apiData.file_base64 || "",
        fileName: file.originalname.replace(/\.pdf$/i, '.xlsx') || `converted_${Date.now()}.xlsx`,
        fileSize: apiData.file_size || 0,
        format: apiData.format || 'xlsx',
      };
    } else {
      // API returned binary data directly (Excel file)
      const fileBuffer = Buffer.from(response.data);
      const fileBase64 = fileBuffer.toString('base64');
      
      result = {
        success: true,
        fileBase64: fileBase64,
        fileName: file.originalname.replace(/\.pdf$/i, '.xlsx') || `converted_${Date.now()}.xlsx`,
        fileSize: fileBuffer.length,
        format: 'xlsx',
      };
    }

    console.log("Sending result with base64 length:", result.fileBase64?.length);
    console.log("File size:", result.fileSize);

    res.status(200).json(result);

  } catch (error) {
    console.error("PDF to Excel Error Details:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Clean up file on error
    if (file) {
      try {
        fs.unlinkSync(file.path);
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
      errorMessage = "Request timed out. The file may be too large or complex. Please try again.";
    } else if (error.response?.status === 503) {
      errorMessage = "RobotPDF service is temporarily unavailable. Please try again later.";
    } else if (error.response?.status === 400) {
      errorMessage = errorMessage || "Invalid PDF file or no tabular data found.";
    }
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: errorMessage,
    });
  }
};
