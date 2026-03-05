// Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkmFC0nt4N0U7Bxhb_b_0g128wkbv9rbr5xvo43WINbn-EjFDGMvvA4f9XbfbR2c5RIw/exec';

// Assessment Questions — Executive Alignment Risk Scan
const questions = [
    // Heart Questions (5) — Risk Management
    {
        category: 'heart',
        text: 'Critical operational failures are reported to the CEO/board immediately, without being polished or softened by middle management.',
        icon: '&#9829;',
        riskLabel: 'Bad News Velocity — Iceberg Risk'
    },
    {
        category: 'heart',
        text: 'Our high-potential performers clearly understand how their daily work impacts the company\'s profitability, valuation and/or exit strategy.',
        icon: '&#9829;',
        riskLabel: 'Talent/Strategy Bridge — Retention Risk'
    },
    {
        category: 'heart',
        text: 'When a project fails, the focus is entirely on process improvement, not finger-pointing or blame.',
        icon: '&#9829;',
        riskLabel: 'Post-Mortem Culture — Cultural Fracture'
    },
    {
        category: 'heart',
        text: 'Disagreements between C-suite peers are resolved directly and professionally within 48 hours, without requiring CEO intervention.',
        icon: '&#9829;',
        riskLabel: 'Conflict Resolution — Leadership Friction'
    },
    {
        category: 'heart',
        text: 'Our leadership team actively develops successors and builds bench strength for critical roles.',
        icon: '&#9829;',
        riskLabel: 'Succession Depth — Continuity Risk'
    },
    // Head Questions (5) — Decision Discipline
    {
        category: 'head',
        text: 'Every member of the C-suite would list the same top three strategic priorities for this quarter.',
        icon: '&#9881;',
        riskLabel: 'Strategic Alignment — Resource Waste'
    },
    {
        category: 'head',
        text: 'There is zero ambiguity about who has final decision authority on cross-functional initiatives like AI adoption or pricing changes.',
        icon: '&#9881;',
        riskLabel: 'Decision Rights — Decision Paralysis'
    },
    {
        category: 'head',
        text: 'We have a formal, board-vetted policy for how employees use generative AI with proprietary company data.',
        icon: '&#9881;',
        riskLabel: 'AI Governance — Legal/IP Liability'
    },
    {
        category: 'head',
        text: 'Our executive meetings are 80% future-facing strategic discussion and 20% status updates.',
        icon: '&#9881;',
        riskLabel: 'Meeting ROI — Operational Drift'
    },
    {
        category: 'head',
        text: 'Our current operating systems could handle a 2x increase in volume or headcount without the CEO working 80-hour weeks.',
        icon: '&#9881;',
        riskLabel: 'Scale Readiness — Founder Bottleneck'
    }
];

const ratingLabels = [
    'Strongly Disagree',
    'Disagree',
    'Neutral',
    'Agree',
    'Strongly Agree'
];

let currentQuestion = 0;
let answers = new Array(questions.length).fill(null);
let leadData = {};

function openAssessment() {
    document.getElementById('assessmentModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAssessment() {
    document.getElementById('assessmentModal').classList.remove('active');
    document.body.style.overflow = '';
    // Reset assessment
    currentQuestion = 0;
    answers = new Array(questions.length).fill(null);
    showStep('step-intro');
}

function showStep(stepId) {
    document.querySelectorAll('.assessment-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(stepId).classList.add('active');
}

function startAssessment() {
    showStep('step-questions');
    renderQuestion();
}

function renderQuestion() {
    const q = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;

    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('questionNumber').textContent = `Question ${currentQuestion + 1} of ${questions.length}`;

    const categoryEl = document.getElementById('questionCategory');
    categoryEl.className = 'question-category ' + q.category;
    document.getElementById('categoryIcon').innerHTML = q.icon;
    document.getElementById('categoryText').textContent = q.category.charAt(0).toUpperCase() + q.category.slice(1);

    document.getElementById('questionText').textContent = q.text;

    // Update category label with risk context
    document.getElementById('categoryLabel').textContent = q.riskLabel || '';

    // Render rating scale
    const scaleEl = document.getElementById('ratingScale');
    scaleEl.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const option = document.createElement('label');
        option.className = 'rating-option' + (answers[currentQuestion] === i ? ' selected' : '');
        option.innerHTML = `
            <input type="radio" name="rating" value="${i}">
            <span class="rating-number">${i}</span>
            <span class="rating-label">${ratingLabels[i-1]}</span>
        `;
        option.onclick = () => selectRating(i);
        scaleEl.appendChild(option);
    }

    // Update navigation
    document.getElementById('backBtn').style.visibility = currentQuestion === 0 ? 'hidden' : 'visible';
    document.getElementById('nextBtn').disabled = answers[currentQuestion] === null;
    document.getElementById('nextBtn').textContent = currentQuestion === questions.length - 1 ? 'See Results' : 'Next';
}

function selectRating(value) {
    answers[currentQuestion] = value;
    document.querySelectorAll('.rating-option').forEach((opt, idx) => {
        opt.classList.toggle('selected', idx === value - 1);
    });
    document.getElementById('nextBtn').disabled = false;
}

function nextQuestion() {
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        renderQuestion();
    } else {
        showStep('step-lead');
    }
}

function previousQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        renderQuestion();
    }
}

function submitLead(e) {
    e.preventDefault();

    // Calculate scores before showing results
    let heartScore = 0;
    let headScore = 0;
    questions.forEach((q, idx) => {
        if (q.category === 'heart') {
            heartScore += answers[idx];
        } else {
            headScore += answers[idx];
        }
    });
    const heartPct = Math.round((heartScore / 25) * 100);
    const headPct = Math.round((headScore / 25) * 100);
    const totalScore = heartScore + headScore;
    const profile = getProfile(heartPct, headPct, totalScore);

    // Check if user wants a copy
    const sendCopyCheckbox = document.getElementById('sendCopy');
    const sendCopy = sendCopyCheckbox ? sendCopyCheckbox.checked : false;

    // Build question responses array
    var responses = questions.map(function(q, idx) {
        return {
            category: q.category,
            riskLabel: q.riskLabel,
            question: q.text,
            rating: answers[idx],
            ratingLabel: ratingLabels[answers[idx] - 1]
        };
    });

    leadData = {
        type: 'assessment',
        name: document.getElementById('leadName').value,
        email: document.getElementById('leadEmail').value,
        company: document.getElementById('leadCompany').value,
        role: document.getElementById('leadRole').value,
        phone: document.getElementById('leadPhone').value,
        heartScore: heartPct,
        headScore: headPct,
        totalScore: totalScore,
        profileType: profile.type,
        insights: profile.insights,
        sendCopy: sendCopy,
        responses: responses
    };

    // Send data to Google Apps Script
    if (GOOGLE_SCRIPT_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(leadData)
        }).catch(error => {
            console.error('Error submitting lead:', error);
        });
    }

    showResults();
}

function showResults() {
    showStep('step-results');

    // Calculate scores
    let heartScore = 0;
    let headScore = 0;

    questions.forEach((q, idx) => {
        if (q.category === 'heart') {
            heartScore += answers[idx];
        } else {
            headScore += answers[idx];
        }
    });

    // Convert to percentage (max 25 per category)
    const heartPct = Math.round((heartScore / 25) * 100);
    const headPct = Math.round((headScore / 25) * 100);
    const totalScore = heartScore + headScore;

    // Update greeting
    const firstName = leadData.name.split(' ')[0];
    document.getElementById('resultsGreeting').textContent = `${firstName}, here's your executive alignment profile`;

    // Update score displays
    document.getElementById('heartScoreDisplay').textContent = heartPct + '%';
    document.getElementById('headScoreDisplay').textContent = headPct + '%';

    // Position dot on quadrant (with some padding)
    const dot = document.getElementById('resultDot');
    const xPos = 10 + (headPct * 0.8); // 10-90% range
    const yPos = 90 - (heartPct * 0.8); // Inverted for Y axis
    dot.style.left = xPos + '%';
    dot.style.top = yPos + '%';

    // Determine profile and insights
    const profile = getProfile(heartPct, headPct, totalScore);
    document.getElementById('profileType').textContent = profile.type;
    document.getElementById('insightsText').textContent = profile.insights;
}

function downloadResultsPDF() {
    // Calculate scores
    var heartScore = 0;
    var headScore = 0;
    questions.forEach(function(q, idx) {
        if (q.category === 'heart') {
            heartScore += answers[idx];
        } else {
            headScore += answers[idx];
        }
    });
    var heartPct = Math.round((heartScore / 25) * 100);
    var headPct = Math.round((headScore / 25) * 100);
    var totalScore = heartScore + headScore;
    var profile = getProfile(heartPct, headPct, totalScore);
    var firstName = leadData.name ? leadData.name.split(' ')[0] : '';

    // Flag PDF download in Google Sheet (no separate email — Bill gets full results on submit)
    if (GOOGLE_SCRIPT_URL !== 'YOUR_GOOGLE_SCRIPT_URL_HERE') {
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'assessment-download-flag',
                email: leadData.email || '',
                name: leadData.name || ''
            })
        }).catch(function() {});
    }

    // Helper to replace HTML entities with Unicode for Blob rendering
    function pdfSafe(str) {
        return str.replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013').replace(/&ldquo;/g, '\u201C').replace(/&rdquo;/g, '\u201D');
    }

    var profileTypeText = pdfSafe(profile.type);
    var insightsText = pdfSafe(profile.insights);

    // Build printable HTML
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Executive Alignment Results - ' + (leadData.name || 'Dualign') + '</title>' +
        '<style>' +
        'body { font-family: Arial, Helvetica, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 30px; color: #2d3748; }' +
        '.header { text-align: center; border-bottom: 3px solid #1a365d; padding-bottom: 20px; margin-bottom: 30px; }' +
        '.header h1 { color: #1a365d; font-size: 22px; margin: 0 0 4px; }' +
        '.header p { color: #718096; font-size: 13px; margin: 0; }' +
        '.greeting { font-size: 16px; margin-bottom: 24px; }' +
        '.scores { display: flex; justify-content: center; gap: 40px; margin: 24px 0; }' +
        '.score-box { text-align: center; padding: 16px 24px; border-radius: 8px; }' +
        '.score-box.heart { background: #fff5f5; border: 2px solid #e53e3e; }' +
        '.score-box.head { background: #ebf8ff; border: 2px solid #3182ce; }' +
        '.score-box .number { font-size: 36px; font-weight: 700; }' +
        '.score-box.heart .number { color: #e53e3e; }' +
        '.score-box.head .number { color: #3182ce; }' +
        '.score-box .label { font-size: 13px; color: #718096; margin-top: 4px; }' +
        '.profile-badge { display: inline-block; background: #1a365d; color: white; padding: 4px 12px; border-radius: 4px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }' +
        '.insights { background: #f7fafc; border-radius: 8px; padding: 20px; margin: 24px 0; }' +
        '.insights h3 { color: #1a365d; margin: 0 0 10px; font-size: 16px; }' +
        '.insights p { line-height: 1.6; font-size: 14px; margin: 0; }' +
        '.responses { margin: 24px 0; }' +
        '.responses h3 { color: #1a365d; font-size: 16px; margin: 0 0 14px; }' +
        '.response-group h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }' +
        '.response-group h4.heart { color: #e53e3e; }' +
        '.response-group h4.head { color: #3182ce; }' +
        '.response-item { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f0f0f0; }' +
        '.response-item:last-child { border-bottom: none; }' +
        '.response-q { flex: 1; line-height: 1.4; }' +
        '.response-risk { color: #718096; font-size: 11px; }' +
        '.response-rating { flex-shrink: 0; font-weight: 600; white-space: nowrap; font-size: 12px; padding: 2px 8px; border-radius: 4px; background: #f7fafc; }' +
        '.next-steps { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }' +
        '.next-steps h3 { color: #1a365d; font-size: 16px; margin: 0 0 10px; }' +
        '.next-steps p { font-size: 14px; line-height: 1.6; }' +
        '.footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #a0aec0; }' +
        '@media print { body { padding: 20px; } }' +
        '</style></head><body>' +
        '<div class="header"><h1>Executive Alignment Risk Scan</h1><p>Dualign | Leadership in Balance &mdash; dualign.io</p></div>' +
        '<p class="greeting">' + (firstName ? firstName + ', here' : 'Here') + '\'s your leadership alignment profile:</p>' +
        '<div class="scores">' +
        '<div class="score-box heart"><div class="number">' + heartPct + '%</div><div class="label">Heart Score</div></div>' +
        '<div class="score-box head"><div class="number">' + headPct + '%</div><div class="label">Head Score</div></div>' +
        '</div>' +
        '<div class="insights">' +
        '<span class="profile-badge">' + profileTypeText + '</span>' +
        '<h3>Your Insights</h3>' +
        '<p>' + insightsText + '</p>' +
        '</div>' +
        '<div class="responses">' +
        '<h3>Your Responses</h3>' +
        '<div class="response-group"><h4 class="heart">\u2665 Heart \u2014 Risk Management</h4>';

    questions.forEach(function(q, idx) {
        if (q.category === 'heart') {
            html += '<div class="response-item">' +
                '<div class="response-q">' + q.text + '<br><span class="response-risk">' + q.riskLabel + '</span></div>' +
                '<div class="response-rating">' + answers[idx] + '/5 \u2014 ' + ratingLabels[answers[idx] - 1] + '</div>' +
                '</div>';
        }
    });

    html += '</div><div class="response-group"><h4 class="head">\u2699 Head \u2014 Decision Discipline</h4>';

    questions.forEach(function(q, idx) {
        if (q.category === 'head') {
            html += '<div class="response-item">' +
                '<div class="response-q">' + q.text + '<br><span class="response-risk">' + q.riskLabel + '</span></div>' +
                '<div class="response-rating">' + answers[idx] + '/5 \u2014 ' + ratingLabels[answers[idx] - 1] + '</div>' +
                '</div>';
        }
    });

    html += '</div></div>' +
        '<div class="next-steps">' +
        '<h3>What\'s Next?</h3>' +
        '<p>Your results reveal opportunities to strengthen your leadership approach. If you\'d like to explore how to build on your strengths and address gaps, I\'d welcome a conversation.</p>' +
        '<p><strong>Bill Maggio</strong> | bill@dualign.io | (475) 284-5315<br>dualign.io/contact</p>' +
        '</div>' +
        '<div class="footer">Dualign &copy; 2026 | This assessment is for informational purposes only.</div>' +
        '</body></html>';

    // Use Blob URL to avoid popup blockers
    var blob = new Blob([html], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var printWindow = window.open(url, '_blank');

    if (printWindow) {
        printWindow.onload = function() {
            printWindow.focus();
            printWindow.print();
            URL.revokeObjectURL(url);
        };
    } else {
        // Fallback: download as HTML file if popup blocked
        var a = document.createElement('a');
        a.href = url;
        a.download = 'Dualign-Assessment-Results.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    }
}

function getProfile(heart, head, totalScore) {
    // Zone-based scoring: total score out of 50 (10 questions x max 5)
    // High-Performance Zone: 40-50 (80-100%)
    // Friction Zone: 25-39 (50-79%)
    // Fracture Zone: Under 25 (<50%)

    if (totalScore >= 40) {
        // High-Performance Zone — but check for imbalance
        if (heart >= 60 && head >= 60) {
            return {
                type: 'High-Performance Zone',
                insights: `Disciplined alignment across both dimensions. Your organization shows strong execution transparency and decision discipline. Your risk is complacency — this balance is hard-won and easy to lose during rapid growth, leadership transitions, or market disruption. Protect what you've built by stress-testing your systems against a 2x scale scenario.`
            };
        } else if (heart >= 60) {
            return {
                type: 'High-Performance Zone — Heart-Heavy',
                insights: `Strong cultural foundation, but your decision systems may not scale. You're likely making good decisions slowly. Focus on clarifying decision rights, formalizing AI governance, and ensuring your operating cadence matches your growth ambitions. The gap between your people strength and your systems maturity is a hidden friction tax.`
            };
        } else {
            return {
                type: 'High-Performance Zone — Head-Heavy',
                insights: `Strong systems and decision discipline, but your execution transparency scores suggest bad news may be traveling too slowly. High-performing teams with weak psychological safety eventually lose their best people — or worse, lose visibility into operational risks until it's too late. Invest in conflict resolution speed and succession depth.`
            };
        }
    } else if (totalScore >= 25) {
        // Friction Zone
        if (heart >= 60 && head < 60) {
            return {
                type: 'Friction Zone — Culture Strong, Systems Weak',
                insights: `Your team trusts each other, but you're successful despite your operating systems, not because of them. You're paying a friction tax on every cross-functional decision: unclear decision rights, meetings that rehash instead of resolve, and strategic priorities that shift quarterly. This is the classic pattern before a missed quarter surprises the board.`
            };
        } else if (heart < 60 && head >= 60) {
            return {
                type: 'Friction Zone — Systems Strong, Culture Fragile',
                insights: `Your operating rhythms and accountability structures are solid, but leadership friction is creating drag. When C-suite conflicts require CEO mediation, when bad news gets polished before it reaches you, and when your best people can't connect their work to the company's future — you have a retention and execution transparency problem that metrics alone won't solve.`
            };
        } else {
            return {
                type: 'Friction Zone',
                insights: `You're succeeding despite your leadership alignment, not because of it. Every misaligned decision, every unresolved C-suite conflict, and every ambiguous authority line is a tax on your EBITDA. The good news: focused alignment work on decision rights, operating cadence, and execution transparency typically shows measurable improvement within 90 days.`
            };
        }
    } else {
        // Fracture Zone
        return {
            type: 'Fracture Zone',
            insights: `High risk of cultural fracture or operational breakdown during the next scale-up, acquisition, or market shift. Your scores suggest significant gaps in both execution transparency and decision discipline. This is common during rapid growth, post-acquisition integration, or founder-to-professional-management transitions. The priority is stabilization: clarify the top three strategic priorities, establish decision rights, and create a safe channel for bad news to travel fast.`
        };
    }
}
