# Google Sheets & Apps Script Setup

This guide covers the full backend setup for Dualign's three flows:
1. **Assessment leads** — captured from the Heart & Head assessment on framework.html
2. **Contact inquiries** — captured from the contact form on contact.html
3. **Personal to-do list** — private task tracker at todo.html

All flows use the same Google Apps Script endpoint, which routes by `type` field.

---

## Prerequisites: Gmail Alias Setup (Send as bill@dualign.io)

By default, Google Apps Script sends email from your Gmail address (e.g. billm84@gmail.com). To send from bill@dualign.io instead, add it as a "Send mail as" alias in Gmail.

1. **Open Gmail** → Settings (gear icon) → **See all settings** → **Accounts and Import** tab
2. In the **"Send mail as"** section, click **"Add another email address"**
3. Enter:
   - **Name**: Bill Maggio
   - **Email address**: bill@dualign.io
   - Uncheck "Treat as an alias" (leave unchecked)
4. Click **Next Step** and enter Porkbun SMTP settings:
   - **SMTP Server**: `smtp.porkbun.com`
   - **Port**: `587`
   - **Username**: `bill@dualign.io`
   - **Password**: Your Porkbun email password
   - **Secured connection using TLS**: Selected
5. Click **Add Account**
6. Gmail will send a verification email to bill@dualign.io — open it and click the confirmation link (or enter the code)
7. Once verified, bill@dualign.io appears in your "Send mail as" list

**Note**: You do NOT need to set bill@dualign.io as the default — the Apps Script explicitly specifies the `from` address.

---

## Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it **"Dualign Leads"**

### Assessment Leads tab
3. Rename the default "Sheet1" tab to **"Assessment Leads"** (right-click the tab → Rename)
4. Add these column headers in row 1:

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| Timestamp | Name | Email | Company | Role | Phone | Heart Score | Head Score | Profile Type | Email Sent |

### Contact Inquiries tab
5. Click the **+** button to add a new sheet tab
6. Name it **"Contact Inquiries"**
7. Add these column headers in row 1:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Timestamp | Name | Email | Company | Phone | Message | Confirmation Sent |

### Tasks tab
8. Click the **+** button to add a new sheet tab
9. Name it **"Tasks"**
10. Add these column headers in row 1:

| A | B | C | D | E |
|---|---|---|---|---|
| ID | Task | Due Date | Status | Created |

11. Note the spreadsheet ID from the URL (the long string between `/d/` and `/edit`):
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID_HERE/edit
   ```

---

## Step 2: Create the Google Apps Script

1. In your Google Sheet, go to **Extensions > Apps Script**
2. Delete any existing code in the editor and paste the following:

```javascript
// Configuration - UPDATE THESE VALUES
const SPREADSHEET_ID = '1RWzPF8PjAMFBxr5apE2yIra4Y0hPWRqVfkEY1yuXAF4';
const NOTIFICATION_EMAIL = 'bill@dualign.io';
const FROM_EMAIL = 'bill@dualign.io';
const ASSESSMENT_SHEET_NAME = 'Assessment Leads';
const CONTACT_SHEET_NAME = 'Contact Inquiries';
const TASKS_SHEET_NAME = 'Tasks';

// ============================================================
// ROUTING — doPost (write operations) & doGet (read operations)
// ============================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.type === 'todo') {
      handleTodoAction(data);
    } else if (data.type === 'contact') {
      handleContactSubmission(data);
    } else {
      handleAssessmentSubmission(data);
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

function doGet(e) {
  try {
    var type = e.parameter.type;

    if (type === 'todo') {
      return getTasks();
    }

    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Unknown type' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// ASSESSMENT HANDLER
// ============================================================

function handleAssessmentSubmission(data) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ASSESSMENT_SHEET_NAME);

  sheet.appendRow([
    new Date().toISOString(),
    data.name,
    data.email,
    data.company || '',
    data.role || '',
    data.phone || '',
    data.heartScore + '%',
    data.headScore + '%',
    data.profileType,
    data.sendCopy ? 'Requested' : 'No'
  ]);

  sendAssessmentNotification(data);

  if (data.sendCopy) {
    sendAssessmentResultsToUser(data);
  }
}

function sendAssessmentNotification(data) {
  var subject = 'New Assessment Lead: ' + data.name;

  var body = 'New Heart & Head Assessment Completed\n\n' +
    'Name: ' + data.name + '\n' +
    'Email: ' + data.email + '\n' +
    'Company: ' + (data.company || 'Not provided') + '\n' +
    'Role: ' + (data.role || 'Not provided') + '\n' +
    'Phone: ' + (data.phone || 'Not provided') + '\n\n' +
    'RESULTS\n' +
    '-------\n' +
    'Heart Score: ' + data.heartScore + '%\n' +
    'Head Score: ' + data.headScore + '%\n' +
    'Profile Type: ' + data.profileType + '\n\n' +
    'User requested copy: ' + (data.sendCopy ? 'Yes' : 'No') + '\n\n' +
    '---\n' +
    'View all leads: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID;

  GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, body, {
    from: FROM_EMAIL,
    replyTo: data.email
  });
}

function sendAssessmentResultsToUser(data) {
  var subject = 'Your Heart & Head Leadership Assessment Results | Dualign';
  var firstName = data.name.split(' ')[0];

  var body = 'Hi ' + firstName + ',\n\n' +
    'Thank you for completing the Heart & Head Leadership Assessment. Here are your results:\n\n' +
    'YOUR LEADERSHIP PROFILE: ' + data.profileType + '\n' +
    '==========================================\n\n' +
    'Heart Score: ' + data.heartScore + '%\n' +
    'Head Score: ' + data.headScore + '%\n\n' +
    'INSIGHTS\n' +
    '--------\n' +
    data.insights + '\n\n' +
    'WHAT\'S NEXT?\n' +
    '------------\n' +
    'Your results reveal opportunities to strengthen your leadership approach. ' +
    'If you\'d like to explore how to build on your strengths and address gaps, I\'d welcome a conversation.\n\n' +
    'Schedule a call: https://dualign.io/contact\n\n' +
    'Best regards,\n' +
    'Bill Maggio\n' +
    'bill@dualign.io\n' +
    'Dualign | Leadership in Balance\n\n' +
    '---\n' +
    'This email was sent because you requested a copy of your assessment results.';

  GmailApp.sendEmail(data.email, subject, body, {
    from: FROM_EMAIL,
    name: 'Bill Maggio | Dualign'
  });
}

// ============================================================
// CONTACT FORM HANDLER
// ============================================================

function handleContactSubmission(data) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(CONTACT_SHEET_NAME);

  sheet.appendRow([
    new Date().toISOString(),
    data.name,
    data.email,
    data.company || '',
    data.phone || '',
    data.message,
    'Yes'
  ]);

  sendContactNotification(data);
  sendContactConfirmation(data);
}

function sendContactNotification(data) {
  var subject = 'New Contact Inquiry: ' + data.name;

  var body = 'New Contact Form Submission\n\n' +
    'Name: ' + data.name + '\n' +
    'Email: ' + data.email + '\n' +
    'Company: ' + (data.company || 'Not provided') + '\n' +
    'Phone: ' + (data.phone || 'Not provided') + '\n\n' +
    'MESSAGE\n' +
    '-------\n' +
    data.message + '\n\n' +
    '---\n' +
    'Reply directly to this email to respond to ' + data.name + '.\n' +
    'View all inquiries: https://docs.google.com/spreadsheets/d/' + SPREADSHEET_ID;

  GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, body, {
    from: FROM_EMAIL,
    replyTo: data.email
  });
}

function sendContactConfirmation(data) {
  var subject = 'Thanks for reaching out | Dualign';
  var firstName = data.name.split(' ')[0];

  var body = 'Hi ' + firstName + ',\n\n' +
    'Thank you for reaching out to Dualign. I\'ve received your message and will be in touch within one business day.\n\n' +
    'In the meantime, feel free to explore our Heart & Head Leadership Framework and take the free assessment:\n' +
    'https://dualign.io/framework\n\n' +
    'Best regards,\n' +
    'Bill Maggio\n' +
    'bill@dualign.io\n' +
    '(475) 239-4925\n' +
    'Dualign | Leadership in Balance';

  GmailApp.sendEmail(data.email, subject, body, {
    from: FROM_EMAIL,
    name: 'Bill Maggio | Dualign'
  });
}

// ============================================================
// TODO HANDLER
// ============================================================

function handleTodoAction(data) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(TASKS_SHEET_NAME);

  if (data.action === 'add') {
    var id = Date.now().toString();
    sheet.appendRow([
      id,
      data.task,
      data.dueDate || '',
      'pending',
      new Date().toISOString()
    ]);
  } else if (data.action === 'complete') {
    updateTaskStatus(sheet, data.id, data.status || 'completed');
  } else if (data.action === 'delete') {
    updateTaskStatus(sheet, data.id, 'deleted');
  }
}

function getTasks() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(TASKS_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var tasks = [];

  // Skip header row
  for (var i = 1; i < data.length; i++) {
    if (data[i][3] === 'deleted') continue; // Skip deleted tasks
    tasks.push({
      id: data[i][0].toString(),
      task: data[i][1],
      dueDate: data[i][2] ? Utilities.formatDate(new Date(data[i][2]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
      status: data[i][3] || 'pending',
      created: data[i][4]
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({ tasks: tasks }))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateTaskStatus(sheet, taskId, newStatus) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString() === taskId.toString()) {
      sheet.getRange(i + 1, 4).setValue(newStatus); // Column D = Status
      break;
    }
  }
}

// ============================================================
// TEST FUNCTIONS
// ============================================================

function testAssessmentNotification() {
  sendAssessmentNotification({
    name: 'Test User',
    email: 'test@example.com',
    company: 'Test Company',
    role: 'CEO',
    phone: '555-123-4567',
    heartScore: 75,
    headScore: 65,
    profileType: 'Balanced Leader',
    sendCopy: false
  });
}

function testContactNotification() {
  sendContactNotification({
    name: 'Test User',
    email: 'test@example.com',
    company: 'Test Company',
    phone: '555-123-4567',
    message: 'This is a test contact form submission.'
  });
}
```

3. **Update the configuration values** at the top:
   - Replace the `SPREADSHEET_ID` with your actual spreadsheet ID
4. Click **Save** (disk icon) and name the project **"Dualign Form Handler"**

### Important: GmailApp vs MailApp

This script uses `GmailApp.sendEmail()` instead of `MailApp.sendEmail()`. The key differences:
- **GmailApp** supports the `from` parameter, allowing emails to be sent from your bill@dualign.io alias
- **GmailApp** requires broader OAuth permissions — you will be prompted to re-authorize when deploying
- The Gmail alias (from Prerequisites above) must be configured before emails can send from bill@dualign.io

---

## Step 3: Deploy as Web App

1. Click **Deploy > New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Configure:
   - **Description**: "Dualign Form Handler"
   - **Execute as**: "Me"
   - **Who has access**: "Anyone"
4. Click **Deploy**
5. **Authorize** the app when prompted — you'll see a permission request for Gmail access (this is expected due to GmailApp). Click through the "unsafe" warning — this is your own script.
6. **Copy the Web app URL** — it will look like:
   ```
   https://script.google.com/macros/s/XXXXXXXXXXXXXXX/exec
   ```

**Save this URL!** It's already configured in `assessment.js`, `contact.html`, and `todo.html`.

### Updating an existing deployment

If you already have a deployment and are updating the script:
1. Go to **Deploy > Manage deployments**
2. Click the **pencil icon**
3. Under "Version", select **New version**
4. Click **Deploy**
5. Re-authorize if prompted (required when adding new functions like doGet)

---

## Step 4: Test

### Test assessment flow
1. In the Apps Script editor, select `testAssessmentNotification` from the function dropdown
2. Click **Run** and authorize when prompted
3. Check your email — you should receive a test notification from bill@dualign.io

### Test contact flow
1. Select `testContactNotification` from the function dropdown
2. Click **Run**
3. Check your email — you should receive a contact notification from bill@dualign.io

### Test to-do flow
1. Navigate to `dualign.io/todo.html`
2. Add a task with a due date — it should appear in the list and in the "Tasks" sheet tab
3. Check a task complete — status updates to "completed" in the sheet, task moves to "Completed" section
4. Delete a task — removed from view, marked "deleted" in the sheet

### End-to-end testing
1. Open the website and complete the assessment — verify the lead appears in the "Assessment Leads" tab
2. Submit the contact form — verify the inquiry appears in the "Contact Inquiries" tab
3. Confirm all emails show bill@dualign.io as the sender

---

## Troubleshooting

**"Authorization required" error**
- Make sure you authorized the script when deploying. GmailApp requires Gmail permissions.

**Emails sending from Gmail address instead of bill@dualign.io**
- Verify the Gmail alias is set up (Prerequisites section above)
- Confirm `FROM_EMAIL` is set to `'bill@dualign.io'` in the script
- Make sure you re-deployed after updating the script

**Emails not sending at all**
- Check that your email address is correct in the configuration
- Gmail has daily sending limits (100/day for free accounts, 1500/day for Workspace)

**Data not appearing in sheet**
- Verify the `SPREADSHEET_ID` matches your sheet
- Verify tab names match: "Assessment Leads", "Contact Inquiries", and "Tasks"

**Contact form submissions going to assessment sheet (or vice versa)**
- Make sure the website code includes `type: 'contact'` (contact.html) or `type: 'assessment'` (assessment.js) in the POST payload
- The `doPost()` function routes by `data.type`

**"Gmail alias not found" error**
- Complete the Prerequisites section — the alias must be verified in Gmail before GmailApp can use it

**To-do page shows "Could not load tasks"**
- Make sure `doGet()` is in the script and you deployed a new version after adding it
- Verify the "Tasks" tab exists in the spreadsheet with the exact name "Tasks"
