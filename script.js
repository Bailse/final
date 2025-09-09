// #################################################################################
// ### ส่วนจำลอง API (api.js)                                                     ###
// #################################################################################

const DataAPI = {
    // **UPDATED**: เปลี่ยนจากการอ่าน string มาเป็นการ fetch ไฟล์ JSON จริงๆ
    getAllQuizzes: function() {
        return fetch('quiz.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                return response.json();
            });
    },
    // ฟังก์ชันนี้ยังทำงานเหมือนเดิม คือการเพิ่มข้อมูลใหม่เข้าไปใน object ที่อยู่ในหน่วยความจำ (RAM)
    addQuiz: function(currentData, key, newQuiz) {
        currentData[key] = newQuiz;
        console.log("CREATE: Added new quiz with key:", key);
        return currentData;
    },
};

// #################################################################################
// ### ส่วนหลักของ Application Logic                                              ###
// #################################################################################

// Global state variables
let quizData = {};
let currentCategoryKey = null;
let currentQuestionIndex = 0;
let score = 0;
let answerHistory = [];

// State for the creator view
let customQuizQuestions = [];
let customQuizResults = [];

// DOM Element references
const views = {
    category: document.getElementById('category-selection-view'),
    quiz: document.getElementById('quiz-view'),
    result: document.getElementById('result-view'),
    creator: document.getElementById('creator-view'),
};
const categoryList = document.getElementById('category-list');
const loadingOverlay = document.getElementById('loading-overlay');


/**
 * Switches the active view.
 * @param {string} viewName - The key of the view to show ('category', 'quiz', 'result', 'creator').
 */
function switchView(viewName) {
    Object.values(views).forEach(view => view.classList.remove('active'));
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
}

/**
 * Resets the state and returns to the home (category selection) screen.
 */
function goHome() {
    currentCategoryKey = null;
    currentQuestionIndex = 0;
    score = 0;
    customQuizQuestions = [];
    customQuizResults = [];
    answerHistory = [];

    renderCategorySelection();
    switchView('category');
}

/**
 * Resets the creator form and switches to the creator view.
 */
function showCreatorView() {
    document.getElementById('category-name-input').value = '';
    customQuizQuestions = [];
    customQuizResults = [];
    renderCreatorQuestions();
    renderCreatorResults();
    switchView('creator');
}

/**
 * Starts a quiz for the selected category.
 * @param {string} categoryKey - The key for the selected quiz (e.g., "dog").
 */
function startQuiz(categoryKey) {
    currentCategoryKey = categoryKey;
    currentQuestionIndex = 0;
    score = 0;
    answerHistory = [];

    document.getElementById('quiz-category-title').innerText = quizData[categoryKey].title;

    renderQuestion();
    switchView('quiz');
}

/**
 * Renders the current question and its answers.
 */
function renderQuestion() {
    const quiz = quizData[currentCategoryKey];
    const question = quiz.questions[currentQuestionIndex];

    const prevButton = document.getElementById('prev-question-btn');
    prevButton.style.visibility = (currentQuestionIndex === 0) ? 'hidden' : 'visible';

    document.getElementById('question-text').innerText = question.question;

    const answersContainer = document.getElementById('answers-container');
    answersContainer.innerHTML = '';

    question.answers.forEach(answer => {
        const button = document.createElement('button');
        button.className = "btn btn-answer";
        button.innerText = answer.text;
        button.onclick = () => selectAnswer(answer.points);
        answersContainer.appendChild(button);
    });
}

/**
 * Processes a selected answer, updates the score, and moves to the next question or shows the result.
 * @param {number} points - The points associated with the selected answer.
 */
function selectAnswer(points) {
    score += points;
    answerHistory.push(points);
    currentQuestionIndex++;

    const quiz = quizData[currentCategoryKey];
    if (currentQuestionIndex < quiz.questions.length) {
        renderQuestion();
    } else {
        showResult();
    }
}

/**
 * Navigates to the previous question, adjusting the score accordingly.
 */
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        const lastPoints = answerHistory.pop();
        if (lastPoints !== undefined) {
            score -= lastPoints;
        }
        renderQuestion();
    }
}

/**
 * Calculates and displays the final result based on the total score.
 */
function showResult() {
    const quiz = quizData[currentCategoryKey];
    const sortedResults = [...quiz.results].sort((a, b) => a.score_threshold - b.score_threshold);
    let finalResult = sortedResults.find(result => score <= result.score_threshold);

    if (!finalResult) {
        finalResult = sortedResults[sortedResults.length - 1];
    }

    document.getElementById('result-title').innerText = finalResult.title;
    document.getElementById('result-description').innerText = finalResult.description;

    const resultImage = document.getElementById('result-image');
    if (finalResult.imageUrl) {
        resultImage.src = finalResult.imageUrl;
        resultImage.style.display = 'block';
    } else {
        resultImage.style.display = 'none';
    }

    switchView('result');
}

/**
 * Adds a manually entered question to the custom quiz list.
 */
function addManualQuestion() {
    const questionText = document.getElementById('manual-question-text').value.trim();
    const answerElements = document.querySelectorAll('.manual-answer-text');

    if (!questionText) {
        alert("กรุณาใส่คำถาม");
        return;
    }

    const answers = [];
    let allAnswersValid = true;
    answerElements.forEach((el, index) => {
        if (el.value.trim() === '') {
            allAnswersValid = false;
        }
        answers.push({
            text: el.value.trim(),
            points: index + 1
        });
    });

    if (!allAnswersValid) {
        alert("กรุณากรอกคำตอบให้ครบทั้ง 4 ข้อ");
        return;
    }

    customQuizQuestions.push({ question: questionText, answers: answers });
    renderCreatorQuestions();

    document.getElementById('manual-question-text').value = '';
    answerElements.forEach(el => el.value = '');
}

/**
 * Adds a manually entered result to the custom quiz list.
 */
function addManualResult() {
    const title = document.getElementById('manual-result-title').value.trim();
    const description = document.getElementById('manual-result-desc').value.trim();
    const score_threshold = parseInt(document.getElementById('manual-result-score').value, 10);
    const imageUrl = document.getElementById('manual-result-image').value.trim();

    if (!title || !description) {
        alert("กรุณากรอกชื่อและคำอธิบายผลลัพธ์");
        return;
    }
    if (isNaN(score_threshold) || score_threshold <= 0) {
        alert("กรุณากรอกคะแนนสูงสุดสำหรับผลลัพธ์นี้ (ต้องเป็นตัวเลขมากกว่า 0)");
        return;
    }

    customQuizResults.push({ title, description, score_threshold, imageUrl });
    renderCreatorResults();

    // Clear form
    document.getElementById('manual-result-title').value = '';
    document.getElementById('manual-result-desc').value = '';
    document.getElementById('manual-result-score').value = '';
    document.getElementById('manual-result-image').value = '';
}

/**
 * Generates content using the Gemini API.
 * @param {('category'|'questions'|'results')} type - The type of content to generate.
 */
async function generateWithLLM(type) {
    const categoryName = document.getElementById('category-name-input').value;
    let prompt = '';
    let isJsonExpected = false;

    if (type === 'category') {
        prompt = "จงสร้างหัวข้อสำหรับ 'แบบทดสอบทายนิสัย' 1 หัวข้อ เป็นคำสั้นๆ ไม่เกิน 4 คำ เช่น 'สไตล์การทำงานของคุณ', 'พลังที่ซ่อนอยู่ในตัวคุณ', 'คุณเป็นนักเดินทางแบบไหน'. ตอบแค่ชื่อหัวข้อเท่านั้น";
    } else if (type === 'questions') {
        if (!categoryName) { alert('กรุณาใส่ชื่อหมวดหมู่ก่อนสร้างคำถาม'); return; }
        isJsonExpected = true;
        prompt = `สำหรับแบบทดสอบทายนิสัยหัวข้อ "${categoryName}", จงสร้างคำถามเชิงสถานการณ์หรือความชอบ 2 ข้อเพื่อวิเคราะห์บุคลิกภาพ. แต่ละคำถามให้มีตัวเลือก 4 ข้อที่สะท้อนนิสัยที่ต่างกัน. แต่ละตัวเลือกต้องมีคะแนน (points) 1 ถึง 4. สำคัญมาก: ให้ตอบกลับมาในรูปแบบ JSON Array เท่านั้น ตามโครงสร้างนี้: [{"question":"...","answers":[{"text":"...","points":1}, ...]}, ... ]`;
    } else if (type === 'results') {
        if (!categoryName) { alert('กรุณาใส่ชื่อหมวดหมู่ก่อนสร้างผลลัพธ์'); return; }
        if (customQuizQuestions.length < 1) { alert('กรุณาสร้างคำถามอย่างน้อย 1 ข้อก่อน'); return; }
        isJsonExpected = true;
        const maxScore = customQuizQuestions.length * 4;
        prompt = `สำหรับแบบทดสอบทายนิสัยหัวข้อ "${categoryName}" ที่มี ${customQuizQuestions.length} คำถาม, จงสร้างผลลัพธ์บุคลิกภาพ 3 แบบ. แต่ละแบบต้องมี score_threshold, title, และ description ที่อธิบายลักษณะนิสัย. คะแนนสูงสุดที่เป็นไปได้คือ ${maxScore}. สำคัญมาก: ให้ตอบกลับมาเป็น JSON Array เท่านั้น ตามโครงสร้างนี้: [{"score_threshold":...,"title":"...","description":"..."}, ... ]`;
    } else {
        return;
    }

    loadingOverlay.style.display = 'flex';

    try {
        const apiKey = "AIzaSyBzFP8zaoQKH_i2-fXr1X_Z2Wpkp_r5gmU";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: isJsonExpected ? "application/json" : "text/plain" }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API error! status: ${response.status}`);

        const result = await response.json();
        const generatedText = result.candidates[0].content.parts[0].text;

        if (type === 'category') {
            document.getElementById('category-name-input').value = generatedText.trim();
        } else if (type === 'questions') {
            const newQuestions = JSON.parse(generatedText);
            customQuizQuestions.push(...newQuestions);
            renderCreatorQuestions();
        } else if (type === 'results') {
            const newResults = JSON.parse(generatedText);
            newResults.forEach(r => r.imageUrl = ''); // Add empty imageUrl property
            customQuizResults.push(...newResults);
            renderCreatorResults();
        }

    } catch (error) {
        console.error("Error calling LLM API:", error);
        alert("เกิดข้อผิดพลาดในการสร้างข้อมูล: " + error.message);
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Renders the list of custom questions in the creator view, making them editable.
 */
function renderCreatorQuestions() {
    const listContainer = document.getElementById('question-creator-list');
    listContainer.innerHTML = '';

    if (customQuizQuestions.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-muted" style="font-size: 0.875rem;">ยังไม่มีคำถาม...</p>';
        return;
    }

    customQuizQuestions.forEach((q, questionIndex) => {
        const item = document.createElement('div');
        item.className = 'creator-question-item';

        const header = document.createElement('div');
        header.className = 'creator-question-item-header';

        const questionWrapper = document.createElement('div');
        questionWrapper.style.flexGrow = '1';
        questionWrapper.innerHTML = `<p style="margin:0; font-weight:600; margin-bottom: 5px;">คำถามที่ ${questionIndex + 1}</p>`;

        const questionTextarea = document.createElement('textarea');
        questionTextarea.className = 'form-control';
        questionTextarea.value = q.question;
        questionTextarea.rows = 2;
        questionTextarea.oninput = (e) => updateCreatorQuestionText(questionIndex, e.target.value);
        questionWrapper.appendChild(questionTextarea);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.style.alignSelf = 'flex-start';
        deleteButton.innerHTML = '&times;';
        deleteButton.onclick = () => deleteCreatorQuestion(questionIndex);

        header.appendChild(questionWrapper);
        header.appendChild(deleteButton);

        const answersList = document.createElement('div');
        answersList.style.marginTop = '1rem';

        q.answers.forEach((a, answerIndex) => {
            const answerGroup = document.createElement('div');
            answerGroup.className = 'input-group';
            answerGroup.style.marginBottom = '0.5rem';

            const answerTextInput = document.createElement('input');
            answerTextInput.type = 'text';
            answerTextInput.className = 'form-control';
            answerTextInput.value = a.text;
            answerTextInput.placeholder = `คำตอบ ${answerIndex + 1}`;
            answerTextInput.oninput = (e) => updateCreatorAnswer(answerIndex, 'text', e.target.value, questionIndex);

            const answerPointsInput = document.createElement('input');
            answerPointsInput.type = 'number';
            answerPointsInput.className = 'form-control';
            answerPointsInput.value = a.points;
            answerPointsInput.title = 'คะแนน';
            answerPointsInput.style.maxWidth = '70px';
            answerPointsInput.oninput = (e) => updateCreatorAnswer(answerIndex, 'points', parseInt(e.target.value, 10) || 0, questionIndex);

            answerGroup.appendChild(answerTextInput);
            answerGroup.appendChild(answerPointsInput);
            answersList.appendChild(answerGroup);
        });

        item.appendChild(header);
        item.appendChild(answersList);
        listContainer.appendChild(item);
    });
}

/**
 * Updates the text of a specific question in the creator state.
 * @param {number} questionIndex - The index of the question.
 * @param {string} newText - The new text for the question.
 */
function updateCreatorQuestionText(questionIndex, newText) {
    if (customQuizQuestions[questionIndex]) {
        customQuizQuestions[questionIndex].question = newText;
    }
}

/**
 * Updates a field (text or points) of a specific answer in the creator state.
 * @param {number} answerIndex - The index of the answer within the question.
 * @param {('text'|'points')} field - The field to update.
 * @param {(string|number)} value - The new value.
 * @param {number} questionIndex - The index of the question.
 */
function updateCreatorAnswer(answerIndex, field, value, questionIndex) {
    if (customQuizQuestions[questionIndex] && customQuizQuestions[questionIndex].answers[answerIndex]) {
        customQuizQuestions[questionIndex].answers[answerIndex][field] = value;
    }
}

/**
 * Renders the list of custom results in the creator view.
 */
function renderCreatorResults() {
    const listContainer = document.getElementById('result-creator-list');
    listContainer.innerHTML = '';
    if (customQuizResults.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-muted" style="font-size: 0.875rem;">ยังไม่มีผลลัพธ์...</p>';
        return;
    }
    customQuizResults.sort((a, b) => a.score_threshold - b.score_threshold);

    customQuizResults.forEach((r, index) => {
        const item = document.createElement('div');
        item.className = 'creator-question-item';

        const itemFlexContainer = document.createElement('div');
        itemFlexContainer.style.display = 'flex';
        itemFlexContainer.style.justifyContent = 'space-between';
        itemFlexContainer.style.alignItems = 'flex-start';

        const mainContent = document.createElement('div');
        mainContent.style.flexGrow = '1';
        mainContent.innerHTML = `
            <p style="font-weight: 600; margin:0;">${r.title} (คะแนน <= ${r.score_threshold})</p>
            <p class="text-muted" style="font-size:0.9em; margin:0.25rem 0 0 0;">${r.description}</p>
        `;

        const sideContent = document.createElement('div');
        sideContent.style.display = 'flex';
        sideContent.style.alignItems = 'center';

        if (r.imageUrl) {
            const img = document.createElement('img');
            img.src = r.imageUrl;
            img.className = 'creator-preview-image';
            img.onerror = () => { img.src = `https://placehold.co/60x60/1f2937/9ca3af?text=Error`; };
            sideContent.appendChild(img);
        }

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = `&times;`;
        delBtn.onclick = () => deleteCreatorResult(index);
        sideContent.appendChild(delBtn);

        itemFlexContainer.appendChild(mainContent);
        itemFlexContainer.appendChild(sideContent);
        item.appendChild(itemFlexContainer);
        listContainer.appendChild(item);
    });
}

/**
 * Deletes a question from the custom quiz list.
 * @param {number} index - The index of the question to delete.
 */
function deleteCreatorQuestion(index) {
    customQuizQuestions.splice(index, 1);
    renderCreatorQuestions();
}

/**
 * Deletes a result from the custom quiz list.
 * @param {number} index - The index of the result to delete.
 */
function deleteCreatorResult(index) {
    customQuizResults.splice(index, 1);
    renderCreatorResults();
}

/**
 * Posts the newly created quiz, adding it to the main quiz data object.
 */
function postCustomQuiz() {
    const categoryName = document.getElementById('category-name-input').value.trim();
    if (!categoryName) { alert('กรุณาตั้งชื่อหมวดหมู่'); return; }
    if (customQuizQuestions.length === 0) { alert('กรุณาสร้างคำถามอย่างน้อย 1 ข้อ'); return; }
    if (customQuizResults.length === 0) { alert('กรุณาสร้างผลลัพธ์ก่อน Post'); return; }

    const newKey = `custom_${Date.now()}`;
    const newQuiz = {
        title: categoryName,
        questions: customQuizQuestions,
        results: customQuizResults
    };

    quizData = DataAPI.addQuiz(quizData, newKey, newQuiz);

    alert('สร้างแบบทดสอบสำเร็จ!');
    goHome();
}

/**
 * Initializes the application by fetching the initial quiz data.
 */
async function initializeApp() {
    try {
        quizData = await DataAPI.getAllQuizzes();
        renderCategorySelection();
        switchView('category');
    } catch (error) {
        console.error("Failed to initialize app:", error);
        document.getElementById('app').innerHTML = '<p style="color:red; text-align:center;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    }
}

/**
 * Renders the category selection buttons on the home screen.
 */
function renderCategorySelection() {
    categoryList.innerHTML = '';
    for (const key in quizData) {
        const category = quizData[key];
        const button = document.createElement('button');
        button.className = "btn";
        button.innerText = category.title;
        button.onclick = () => startQuiz(key);
        categoryList.appendChild(button);
    }
}

// Start the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', initializeApp);
