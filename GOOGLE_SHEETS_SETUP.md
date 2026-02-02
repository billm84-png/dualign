# Google Sheets Lead Capture Setup

This guide walks you through setting up Google Sheets to capture assessment leads and send email notifications.

## Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like "Dualign Assessment Leads"
3. In the first row, add these column headers (exactly as shown):

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| Timestamp | Name | Email | Company | Role | Heart Score | Head Score | Profile Type | Email Sent |

4. Note the spreadsheet ID from the URL. It's the long string between `/d/` and `/edit`:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID_HERE/edit
   ```

## Step 2: Create the Google Apps Script

1. In your Google Sheet, go to **Extensions > Apps Script**
2. Delete any code in the editor and paste the following:

```javascript
// Configuration - UPDATE THESE VALUES
const SPREADSHEET_ID = '1RWzPF8PjAMFBxr5apE2yIra4Y0hPWRqVfkEY1yuXAF4';  // From Step 1
const NOTIFICATION_EMAIL = 'bill@dualign.io'; // Your email for notifications
const SHEET_NAME = 'Sheet1'; // Change if you renamed the sheet

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

    // Append lead to spreadsheet
    sheet.appendRow([
      new Date().toISOString(),
      data.name,
      data.email,
      data.company || '',
      data.role || '',
      data.heartScore + '%',
      data.headScore + '%',
      data.profileType,
      data.sendCopy ? 'Requested' : 'No'
    ]);

    // Send notification email to you
    sendNotificationEmail(data);

    // Send copy to user if requested
    if (data.sendCopy) {
      sendResultsToUser(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendNotificationEmail(data) {
  const subject = `New Assessment Lead: ${data.name}`;

  const body = `
New Heart & Head Assessment Completed

Name: ${data.name}
Email: ${data.email}
Company: ${data.company || 'Not provided'}
Role: ${data.role || 'Not provided'}

RESULTS
-------
Heart Score: ${data.heartScore}%
Head Score: ${data.headScore}%
Profile Type: ${data.profileType}

User requested copy: ${data.sendCopy ? 'Yes' : 'No'}

---
View all leads: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}
  `.trim();

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
    subject: subject,
    body: body
  });
}

function sendResultsToUser(data) {
  const subject = 'Your Heart & Head Leadership Assessment Results | Dualign';

  const body = `
Hi ${data.name.split(' ')[0]},

Thank you for completing the Heart & Head Leadership Assessment. Here are your results:

YOUR LEADERSHIP PROFILE: ${data.profileType}
==========================================

Heart Score: ${data.heartScore}%
Head Score: ${data.headScore}%

INSIGHTS
--------
${data.insights}

WHAT'S NEXT?
------------
Your results reveal opportunities to strengthen your leadership approach. If you'd like to explore how to build on your strengths and address gaps, I'd welcome a conversation.

Schedule a call: https://dualign.io/contact

Best regards,
Bill Maggio
bill@dualign.io
Dualign | Leadership in Balance

---
This email was sent because you requested a copy of your assessment results.
  `.trim();

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: body
  });
}

// Test function - run this to verify email works
function testEmail() {
  sendNotificationEmail({
    name: 'Test User',
    email: 'test@example.com',
    company: 'Test Company',
    role: 'CEO',
    heartScore: 75,
    headScore: 65,
    profileType: 'Balanced Leader',
    sendCopy: false
  });
}
```

3. **Update the configuration values** at the top:
   - Replace `1RWzPF8PjAMFBxr5apE2yIra4Y0hPWRqVfkEY1yuXAF4` with your actual spreadsheet ID
   - Replace `bill@dualing.io` with your email address

4. Click **Save** (disk icon) and name the project "Dualign Assessment Handler"

## Step 3: Deploy as Web App

1. Click **Deploy > New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Configure:
   - **Description**: "Assessment Lead Handler"
   - **Execute as**: "Me"
   - **Who has access**: "Anyone"
4. Click **Deploy**
5. **Authorize** the app when prompted (click through the "unsafe" warning - this is your own script)
6. **Copy the Web app URL** - it will look like:
   ```
   https://script.google.com/macros/s/XXXXXXXXXXXXXXX/exec
   ```

**Save this URL!** You'll need it for the website configuration.

## Step 4: Test the Setup

1. In the Apps Script editor, select `testEmail` from the function dropdown
2. Click **Run**
3. Authorize when prompted
4. Check your email - you should receive a test notification

## Step 5: Configure the Website

Once you have the Web app URL, let me know and I'll update the website code to send leads to your Google Sheet.

---

## Troubleshooting

**"Authorization required" error**
- Make sure you authorized the script when deploying

**Emails not sending**
- Check that your email address is correct in the configuration
- Gmail has daily sending limits (100/day for free accounts)

**Data not appearing in sheet**
- Verify the SPREADSHEET_ID matches your sheet
- Make sure the SHEET_NAME matches (default is "Sheet1")

**Need to update the script?**
- Make changes in Apps Script
- Go to Deploy > Manage deployments
- Click the pencil icon and select "New version"
- Click Deploy
