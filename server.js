const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Google APIs
const auth = new google.auth.GoogleAuth({
  credentials: {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
  },
  scopes: [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file',
  ],
});

const docs = google.docs({ version: 'v1', auth });
const drive = google.drive({ version: 'v3', auth });

// Endpoint to create Google Doc with content plan
app.post('/api/create-content-plan', async (req, res) => {
  try {
    const { userData, generatedPlan } = req.body;

    // Step 1: Create a new Google Doc
    const createResponse = await docs.documents.create({
      requestBody: {
        title: `${userData.firstName} ${userData.lastName} - 30-Day Content Plan - ${new Date().toLocaleDateString()}`,
      },
    });

    const documentId = createResponse.data.documentId;

    // Step 2: Format the content for the document
    const formattedContent = formatContentForDoc(userData, generatedPlan);

    // Step 3: Insert content into the document
    await docs.documents.batchUpdate({
      documentId: documentId,
      requestBody: {
        requests: formattedContent,
      },
    });

    // Step 4: Set sharing permissions (anyone with link can view)
    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Step 5: Get the shareable link
    const file = await drive.files.get({
      fileId: documentId,
      fields: 'webViewLink',
    });

    const documentLink = file.data.webViewLink;

    // Step 6: Return the link
    res.json({
      success: true,
      documentLink: documentLink,
      documentId: documentId,
    });

  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Helper function to format content for Google Docs API
function formatContentForDoc(userData, generatedPlan) {
  const requests = [];
  let currentIndex = 1;

  // Add title
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: `30-Day Social Media Content Plan\n`,
    },
  });

  // Style the title
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: currentIndex,
        endIndex: currentIndex + 33,
      },
      paragraphStyle: {
        namedStyleType: 'HEADING_1',
        alignment: 'CENTER',
      },
      fields: 'namedStyleType,alignment',
    },
  });

  currentIndex += 34;

  // Add coach information section
  const coachInfo = `
Coach: ${userData.firstName} ${userData.lastName}
Type: ${userData.coachType}
Location: ${userData.location}
Date Created: ${new Date().toLocaleDateString()}

═══════════════════════════════════════════════════

COACHING PROFILE

Ideal Clients: ${userData.clientAvatar}

Brand Voice: ${Array.isArray(userData.brandVoice) ? userData.brandVoice.join(', ') : userData.brandVoice}

Platform(s): ${Array.isArray(userData.platforms) ? userData.platforms.join(', ') : userData.platforms}

Content Formats: ${Array.isArray(userData.contentFormats) ? userData.contentFormats.join(', ') : userData.contentFormats}

Posting Frequency: ${userData.postingFrequency}

CTA Style: ${userData.ctaStyle}

═══════════════════════════════════════════════════

YOUR 30-DAY CONTENT CALENDAR

${generatedPlan}

═══════════════════════════════════════════════════

IMPLEMENTATION TIPS

1. Schedule posts in advance using your platform's scheduling tool
2. Batch create content on your "content days" to stay ahead
3. Engage with comments within the first hour of posting
4. Track which posts perform best and create more of that content
5. Don't be afraid to repurpose top-performing content

Questions? Contact TurnKey Coach at jveach@barbell-logic.com

`;

  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: coachInfo,
    },
  });

  return requests;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
