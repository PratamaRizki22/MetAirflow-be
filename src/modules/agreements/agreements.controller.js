const novitaService = require('../../utils/novita');
const pdfParse = require('pdf-parse'); // Ensure you run: npm install pdf-parse
const fs = require('fs');

class AgreementsController {
  // Endpoint: Analyze Text via LLM
  async analyze(req, res) {
    try {
      const { text } = req.body;
      if (!text) {
        return res
          .status(400)
          .json({ success: false, message: 'Text is required' });
      }

      // LIMIT: Truncate text to avoid token overflow (approx 15k chars ~ 3-4k tokens)
      const MAX_CHARS = 15000;
      const processedText =
        text.length > MAX_CHARS
          ? text.substring(0, MAX_CHARS) + '\n...(truncated)'
          : text;

      const response = await novitaService.analyzeAgreement(processedText);
      const analysis =
        response.choices[0]?.message?.content || 'No analysis generated';

      res.json({
        success: true,
        data: { analysis },
      });
    } catch (error) {
      console.error('Agreement analysis error:', error);
      res
        .status(500)
        .json({ success: false, message: 'Failed to analyze agreement' });
    }
  }

  // Endpoint: Q&A via LLM
  async ask(req, res) {
    try {
      const { text, question } = req.body;
      if (!text || !question) {
        return res
          .status(400)
          .json({ success: false, message: 'Text and question are required' });
      }

      // LIMIT: Truncate context text (keep question intact)
      const MAX_CHARS = 15000;
      const processedText =
        text.length > MAX_CHARS
          ? text.substring(0, MAX_CHARS) + '\n...(truncated context)'
          : text;

      const response = await novitaService.askQuestion(processedText, question);
      const answer =
        response.choices[0]?.message?.content || 'No answer generated';

      res.json({
        success: true,
        data: { answer },
      });
    } catch (error) {
      console.error('Agreement Q&A error:', error);
      res.status(500).json({ success: false, message: 'Failed to get answer' });
    }
  }

  // Endpoint: Extract text from File (PDF Only)
  async extractText(req, res) {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: 'No file uploaded' });
      }

      // LIMIT: Max File Size 5MB
      const MAX_SIZE_BYTES = 5 * 1024 * 1024;
      if (req.file.size > MAX_SIZE_BYTES) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          // Ignore cleanup errors
        }
        return res.status(400).json({
          success: false,
          message: 'File too large. Max size is 5MB.',
        });
      }

      // Verify PDF
      if (req.file.mimetype !== 'application/pdf') {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          // Ignore cleanup errors
        }
        return res
          .status(400)
          .json({ success: false, message: 'Only PDF files are supported.' });
      }

      // Parse PDF
      const dataBuffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(dataBuffer);
      let extractedText = data.text;

      if (!extractedText || extractedText.trim().length === 0) {
        extractedText =
          '[System Warning: Empty text extracted. Ensure PDF contains selectable text, not scanned images.]';
      }

      res.json({
        success: true,
        data: {
          text: extractedText,
          originalName: req.file.originalname,
        },
      });

      // Cleanup temp file
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.warn('Failed to delete temp file:', e);
      }
    } catch (error) {
      console.error('Extract text error:', error);
      res
        .status(500)
        .json({ success: false, message: 'Failed to extract text from file' });
    }
  }
}

module.exports = new AgreementsController();
