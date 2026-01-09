const { google } = require('googleapis');

// Initialize Google APIs
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
}

// Helper function to format content for Google Docs API
function formatContentForDoc(userData, generatedPlan) {
  const requests = [];
  let currentIndex = 1;

  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: `30-Day Social Media Content Plan\n`,
    },
  });

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userData, generatedPlan } = req.body;

    const auth = getAuth();
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    const createResponse = await docs.documents.create({
      requestBody: {
        title: `${userData.firstName} ${userData.lastName} - 30-Day Content Plan - ${new Date().toLocaleDateString()}`,
      },
    });

    const documentId = createResponse.data.documentId;
    const formattedContent = formatContentForDoc(userData, generatedPlan);

    await docs.documents.batchUpdate({
      documentId: documentId,
      requestBody: {
        requests: formattedContent,
      },
    });

    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const file = await drive.files.get({
      fileId: documentId,
      fields: 'webViewLink',
    });

    res.status(200).json({
      success: true,
      documentLink: file.data.webViewLink,
      documentId: documentId,
    });

  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
