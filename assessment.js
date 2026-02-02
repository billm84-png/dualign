// Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxkmFC0nt4N0U7Bxhb_b_0g128wkbv9rbr5xvo43WINbn-EjFDGMvvA4f9XbfbR2c5RIw/exec';

// Assessment Questions
const questions = [
    // Heart Questions (5)
    {
        category: 'heart',
        text: 'Our leadership team actively invests time in developing and mentoring team members.',
        icon: '&#9829;'
    },
    {
        category: 'heart',
        text: 'People feel psychologically safe to voice concerns and share ideas without fear of judgment.',
        icon: '&#9829;'
    },
    {
        category: 'heart',
        text: 'Leaders in our organization demonstrate empathy and emotional intelligence in difficult situations.',
        icon: '&#9829;'
    },
    {
        category: 'heart',
        text: 'We prioritize building trust and authentic relationships across all levels of the organization.',
        icon: '&#9829;'
    },
    {
        category: 'heart',
        text: 'Change initiatives are communicated with consideration for how they impact people emotionally.',
        icon: '&#9829;'
    },
    // Head Questions (5)
    {
        category: 'head',
        text: 'Our strategic decisions are consistently informed by data and rigorous analysis.',
        icon: '&#9881;'
    },
    {
        category: 'head',
        text: 'We have clear metrics and KPIs that everyone understands and can act upon.',
        icon: '&#9881;'
    },
    {
        category: 'head',
        text: 'Our leadership team has established regular operating rhythms (meetings, reviews, planning cycles).',
        icon: '&#9881;'
    },
    {
        category: 'head',
        text: 'We systematically evaluate and optimize our processes for efficiency and effectiveness.',
        icon: '&#9881;'
    },
    {
        category: 'head',
        text: 'Strategy is clearly articulated and cascaded into actionable plans with accountability.',
        icon: '&#9881;'
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
    const profile = getProfile(heartPct, headPct);

    // Check if user wants a copy
    const sendCopyCheckbox = document.getElementById('sendCopy');
    const sendCopy = sendCopyCheckbox ? sendCopyCheckbox.checked : false;

    leadData = {
        name: document.getElementById('leadName').value,
        email: document.getElementById('leadEmail').value,
        company: document.getElementById('leadCompany').value,
        role: document.getElementById('leadRole').value,
        heartScore: heartPct,
        headScore: headPct,
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

    // Update greeting
    const firstName = leadData.name.split(' ')[0];
    document.getElementById('resultsGreeting').textContent = `${firstName}, here's how your organization balances Heart and Head`;

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
    const profile = getProfile(heartPct, headPct);
    document.getElementById('profileType').textContent = profile.type;
    document.getElementById('insightsText').textContent = profile.insights;
}

function getProfile(heart, head) {
    if (heart >= 60 && head >= 60) {
        return {
            type: 'Balanced Leader',
            insights: `Your organization demonstrates strength in both people-centered leadership and analytical rigor. This balance positions you well for sustainable transformation. Consider how you can leverage this foundation to drive innovation and navigate complex challenges. The opportunity lies in maintaining this balance during periods of rapid growth or change.`
        };
    } else if (heart >= 60 && head < 60) {
        return {
            type: 'Heart-Forward Leader',
            insights: `Your organization excels at building trust, developing people, and creating psychological safety. These are critical foundations for high-performance. To accelerate results, consider strengthening your operating rhythms, data-driven decision making, and strategic clarity. The combination of your people strength with enhanced analytical discipline can be transformational.`
        };
    } else if (heart < 60 && head >= 60) {
        return {
            type: 'Head-Forward Leader',
            insights: `Your organization shows strong analytical capabilities and systematic approaches to execution. This provides a solid operational foundation. To unlock greater engagement and innovation, consider investing in psychological safety, leadership development, and authentic connection. Teams with both analytical strength and high trust dramatically outperform those with only one.`
        };
    } else {
        return {
            type: 'Emerging Leader',
            insights: `Your organization has significant opportunities to strengthen both dimensions of effective leadership. This is common during periods of rapid growth, transition, or when scaling beyond founder-led operations. Focused investment in leadership capability, operating rhythms, and culture can drive meaningful improvement. Consider which dimension to prioritize first based on your most pressing challenges.`
        };
    }
}
