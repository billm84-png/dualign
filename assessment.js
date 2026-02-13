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
        text: 'Our high-potential performers clearly understand how their daily work impacts the company\'s valuation or exit strategy.',
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
        sendCopy: sendCopy
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
